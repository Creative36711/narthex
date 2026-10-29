#!/usr/bin/env node
/** Import the pinned campaign-1 archive into .golden/karkas without touching repo data. */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

type ImportedTree = {
  archive_sha256: string
  sha256: string
  files: number
  directories: number
  size_bytes: number
}

type ImportManifest = {
  repository: string
  commit: string
  url: string
  sha256: string
  size_bytes: number
  tree?: ImportedTree
  [key: string]: unknown
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GOLDEN_DIR = join(ROOT, '.golden')
const TARGET_DIR = join(GOLDEN_DIR, 'karkas')
const MANIFEST_PATH = join(GOLDEN_DIR, 'manifest.json')
const CACHE_DIR = join(GOLDEN_DIR, '.cache')
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000
const MAX_DOWNLOAD_ATTEMPTS = 3
const REPOSITORY = 'Creative36711/campaign-1'
const TARBALL_PREFIX = `https://codeload.github.com/${REPOSITORY}/tar.gz/`

function fail(message: string): never {
  throw new Error(message)
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function cleanupScratch(clearArchiveCache: boolean): Promise<void> {
  for (const entry of await readdir(GOLDEN_DIR, { withFileTypes: true })) {
    const scratch = entry.name.startsWith('.karkas-stage-')
      || entry.name.startsWith('.karkas-backup-')
      || (entry.name.startsWith('.manifest-') && entry.name.endsWith('.tmp'))
    if (scratch || (clearArchiveCache && entry.name === '.cache')) {
      await rm(join(GOLDEN_DIR, entry.name), { recursive: true, force: true })
    }
  }
}

async function loadManifest(): Promise<ImportManifest> {
  const raw = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Partial<ImportManifest>
  const commit = String(raw.commit ?? '')
  const url = String(raw.url ?? '')
  const sha256 = String(raw.sha256 ?? '').toLowerCase()
  const sizeBytes = Number(raw.size_bytes)
  if (raw.repository !== REPOSITORY) fail(`manifest repository must be ${REPOSITORY}`)
  if (!/^[a-f0-9]{40}$/.test(commit)) fail('manifest commit must be a full 40-character SHA')
  if (url !== `${TARBALL_PREFIX}${commit}`) fail('manifest url must be the codeload tarball for its pinned commit')
  if (!/^[a-f0-9]{64}$/.test(sha256)) fail('manifest sha256 must be a 64-character hexadecimal digest')
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) fail('manifest size_bytes must be a positive integer')
  return { ...raw, repository: REPOSITORY, commit, url, sha256, size_bytes: sizeBytes } as ImportManifest
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function runCommand(command: string, args: string[], captureStdout: boolean): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => {
      if (captureStdout) stdout.push(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', (error) => rejectPromise(new Error(`cannot run ${command}: ${error.message}`)))
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString('utf8').trim()}`))
        return
      }
      resolvePromise(captureStdout ? Buffer.concat(stdout).toString('utf8') : '')
    })
  })
}

function runTar(args: string[], captureStdout: boolean): Promise<string> {
  return runCommand('tar', args, captureStdout)
}

async function listArchive(archivePath: string, commit: string): Promise<{ files: number; directories: number }> {
  const listing = await runTar(['-tzf', archivePath], true)
  const prefix = `campaign-1-${commit}/`
  const paths = listing.split('\n').filter(Boolean)
  const seen = new Set<string>()
  let files = 0
  let directories = 0
  for (const entry of paths) {
    if (entry === prefix) continue
    if (!entry.startsWith(prefix)) fail(`unexpected archive root entry: ${entry}`)
    const directory = entry.endsWith('/')
    const relativePath = entry.slice(prefix.length).replace(/\/$/, '')
    if (!relativePath || relativePath.startsWith('/') || relativePath.includes('\\')) fail(`unsafe archive path: ${entry}`)
    const segments = relativePath.split('/')
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) fail(`unsafe archive path: ${entry}`)
    if (seen.has(relativePath)) fail(`duplicate archive path: ${relativePath}`)
    seen.add(relativePath)
    if (directory) directories++
    else files++
  }
  if (files === 0) fail('archive contains no files')
  return { files, directories }
}

async function inspectTree(root: string): Promise<ImportedTree> {
  const entries: Array<{ type: 'file' | 'directory'; path: string; absolute: string; size: number }> = []
  const walk = async (directory: string): Promise<void> => {
    const children = await readdir(directory, { withFileTypes: true })
    children.sort((a, b) => compareText(a.name, b.name))
    for (const child of children) {
      const absolute = join(directory, child.name)
      const relativePath = relative(root, absolute).split(sep).join('/')
      const details = await lstat(absolute)
      if (details.isDirectory()) {
        entries.push({ type: 'directory', path: relativePath, absolute, size: 0 })
        await walk(absolute)
      } else if (details.isFile()) {
        entries.push({ type: 'file', path: relativePath, absolute, size: details.size })
      } else {
        fail(`unsupported filesystem entry in campaign tree: ${relativePath}`)
      }
    }
  }
  await walk(root)
  entries.sort((a, b) => compareText(a.path, b.path) || compareText(a.type, b.type))

  const hash = createHash('sha256')
  let files = 0
  let directories = 0
  let sizeBytes = 0
  for (const entry of entries) {
    if (entry.type === 'directory') {
      directories++
      hash.update(`directory\0${entry.path}\n`)
      continue
    }
    files++
    sizeBytes += entry.size
    hash.update(`file\0${entry.path}\0${entry.size}\0${await sha256File(entry.absolute)}\n`)
  }
  return {
    archive_sha256: '',
    sha256: hash.digest('hex'),
    files,
    directories,
    size_bytes: sizeBytes,
  }
}

async function validateCachedTree(manifest: ImportManifest): Promise<ImportedTree | null> {
  if (!manifest.tree || manifest.tree.archive_sha256 !== manifest.sha256 || !/^[a-f0-9]{64}$/.test(manifest.tree.sha256)) return null
  try {
    const targetStat = await lstat(TARGET_DIR)
    if (!targetStat.isDirectory()) return null
    const tree = await inspectTree(TARGET_DIR)
    tree.archive_sha256 = manifest.sha256
    if (
      tree.sha256 !== manifest.tree.sha256 ||
      tree.files !== manifest.tree.files ||
      tree.directories !== manifest.tree.directories ||
      tree.size_bytes !== manifest.tree.size_bytes
    ) return null
    return tree
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function downloadArchive(manifest: ImportManifest, archivePath: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
  const partialPath = `${archivePath}.partial`
  await rm(partialPath, { force: true })
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const httpStatus = await runCommand('curl', [
        '--fail', '--location', '--silent', '--show-error',
        '--connect-timeout', '60', '--max-time', String(DOWNLOAD_TIMEOUT_MS / 1000),
        '--output', partialPath, '--write-out', '%{http_code}', manifest.url,
      ], true)
      if (httpStatus !== '200') fail(`download returned HTTP ${httpStatus || '(unknown)'}`)
      const actualSize = (await stat(partialPath)).size
      if (actualSize !== manifest.size_bytes) {
        await rm(partialPath, { force: true })
        fail(`archive size mismatch: expected ${manifest.size_bytes}, received ${actualSize}`)
      }
      const actualSha256 = await sha256File(partialPath)
      if (actualSha256 !== manifest.sha256) {
        await rm(partialPath, { force: true })
        fail(`archive sha256 mismatch: expected ${manifest.sha256}, received ${actualSha256}`)
      }
      await rename(partialPath, archivePath)
      console.log(`download: verified ${actualSize} bytes from ${manifest.url}`)
      return
    } catch (error) {
      lastError = error
      await rm(partialPath, { force: true }).catch(() => undefined)
      if (String((error as Error)?.message ?? error).includes('sha256 mismatch') || String((error as Error)?.message ?? error).includes('size mismatch')) throw error
      if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
        console.error(`download attempt ${attempt}/${MAX_DOWNLOAD_ATTEMPTS} failed; retrying: ${String((error as Error)?.message ?? error)}`)
        await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1000))
      }
    }
  }
  throw new Error(`download failed after ${MAX_DOWNLOAD_ATTEMPTS} attempts: ${String((lastError as Error)?.message ?? lastError)}`)
}

async function writeManifestIfChanged(manifest: ImportManifest): Promise<boolean> {
  const content = `${JSON.stringify(manifest, null, 2)}\n`
  const current = await readFile(MANIFEST_PATH, 'utf8')
  if (current === content) return false
  const tempPath = join(GOLDEN_DIR, `.manifest-${process.pid}.tmp`)
  await writeFile(tempPath, content, { flag: 'wx' })
  await rename(tempPath, MANIFEST_PATH)
  return true
}

async function replaceCampaignTree(stagingDir: string, manifest: ImportManifest): Promise<boolean> {
  const backupDir = join(GOLDEN_DIR, `.karkas-backup-${process.pid}`)
  const hadTarget = await exists(TARGET_DIR)
  if (hadTarget) await rename(TARGET_DIR, backupDir)
  let installed = false
  try {
    await rename(stagingDir, TARGET_DIR)
    installed = true
    const manifestChanged = await writeManifestIfChanged(manifest)
    if (hadTarget) await rm(backupDir, { recursive: true, force: true })
    return manifestChanged
  } catch (error) {
    if (installed) await rm(TARGET_DIR, { recursive: true, force: true }).catch(() => undefined)
    if (hadTarget && await exists(backupDir)) await rename(backupDir, TARGET_DIR).catch(() => undefined)
    throw error
  }
}

async function importCampaign(): Promise<void> {
  await mkdir(GOLDEN_DIR, { recursive: true })
  await cleanupScratch(false)
  const manifest = await loadManifest()
  const cachedTree = await validateCachedTree(manifest)
  if (cachedTree) {
    await cleanupScratch(true)
    console.log(`GOLDEN import: extracted cache verified; download skipped`)
    console.log(`archive: commit=${manifest.commit} bytes=${manifest.size_bytes} sha256=${manifest.sha256}`)
    console.log(`tree: files=${cachedTree.files} directories=${cachedTree.directories} bytes=${cachedTree.size_bytes} sha256=${cachedTree.sha256}`)
    console.log('target: .golden/karkas/')
    console.log('manifest: unchanged')
    return
  }

  const archivePath = join(CACHE_DIR, `${manifest.sha256}.tar.gz`)
  let cachedArchive = false
  if (await exists(archivePath)) {
    const details = await lstat(archivePath)
    if (details.isFile() && details.size === manifest.size_bytes && await sha256File(archivePath) === manifest.sha256) {
      cachedArchive = true
      console.log(`archive-cache: verified ${manifest.size_bytes} bytes sha256=${manifest.sha256}`)
    } else {
      await rm(archivePath, { force: true })
      console.log('archive-cache: invalid cache removed')
    }
  }
  if (!cachedArchive) await downloadArchive(manifest, archivePath)

  let stagingDir: string | null = null
  try {
    const archiveEntries = await listArchive(archivePath, manifest.commit)
    stagingDir = await mkdtemp(join(GOLDEN_DIR, '.karkas-stage-'))
    await runTar([
      '--extract', '--gzip', '--file', archivePath,
      '--directory', stagingDir,
      '--strip-components=1',
      '--no-same-owner', '--no-same-permissions',
    ], false)
    const tree = await inspectTree(stagingDir)
    tree.archive_sha256 = manifest.sha256
    if (tree.files !== archiveEntries.files || tree.directories !== archiveEntries.directories) {
      fail(`extracted entry count mismatch: archive files=${archiveEntries.files}, dirs=${archiveEntries.directories}; tree files=${tree.files}, dirs=${tree.directories}`)
    }
    if (manifest.tree?.archive_sha256 === manifest.sha256 && manifest.tree.sha256 && tree.sha256 !== manifest.tree.sha256) {
      fail(`extracted tree sha256 mismatch: manifest=${manifest.tree.sha256}, actual=${tree.sha256}`)
    }
    const nextManifest: ImportManifest = {
      ...manifest,
      tree: {
        archive_sha256: manifest.sha256,
        sha256: tree.sha256,
        files: tree.files,
        directories: tree.directories,
        size_bytes: tree.size_bytes,
      },
    }
    const manifestChanged = await replaceCampaignTree(stagingDir, nextManifest)
    stagingDir = null
    await rm(archivePath, { force: true })
    await cleanupScratch(true)
    console.log(`GOLDEN import: complete`)
    console.log(`archive: commit=${manifest.commit} bytes=${manifest.size_bytes} sha256=${manifest.sha256}`)
    console.log(`tree: files=${tree.files} directories=${tree.directories} bytes=${tree.size_bytes} sha256=${tree.sha256}`)
    console.log(`target: .golden/karkas/`)
    console.log(`manifest: ${manifestChanged ? 'updated' : 'unchanged'}`)
  } finally {
    if (stagingDir) await rm(stagingDir, { recursive: true, force: true })
  }
}

try {
  await importCampaign()
} catch (error) {
  console.error(`golden:import: ${String((error as Error)?.message ?? error)}`)
  process.exitCode = 1
}
