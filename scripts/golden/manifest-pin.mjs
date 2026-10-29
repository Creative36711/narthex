import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { lstat, readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const REPOSITORY = 'Creative36711/campaign-1'
const ARCHIVE_PREFIX = `https://codeload.github.com/${REPOSITORY}/tar.gz/`

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Read and strictly validate the golden pin and its imported-tree manifest. */
export function readGoldenManifest(manifestPath, campaignRoot) {
  let raw
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    throw new Error(`Cannot read golden pin manifest ${manifestPath}: ${String(error?.message ?? error)}`)
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Pinned GOLD manifest validation failed: manifest must be a JSON object')
  }

  const commit = String(raw.commit ?? '')
  const url = String(raw.url ?? '')
  const sha256 = String(raw.sha256 ?? '').toLowerCase()
  const sizeBytes = raw.size_bytes
  const tree = raw.tree && typeof raw.tree === 'object' && !Array.isArray(raw.tree) ? raw.tree : {}
  const treeArchiveSha256 = String(tree.archive_sha256 ?? '').toLowerCase()
  const treeSha256 = String(tree.sha256 ?? '').toLowerCase()
  const treeFiles = tree.files
  const treeDirectories = tree.directories
  const treeSizeBytes = tree.size_bytes
  const errors = []

  if (raw.repository !== REPOSITORY) errors.push(`manifest repository must be ${REPOSITORY}`)
  if (!/^[a-f0-9]{40}$/.test(commit)) errors.push('manifest commit must be a full 40-character hexadecimal SHA')
  if (url !== `${ARCHIVE_PREFIX}${commit}`) errors.push('manifest URL must be the exact codeload tarball URL for manifest.commit')
  if (!/^[a-f0-9]{64}$/.test(sha256)) errors.push('manifest sha256 must be a 64-character hexadecimal digest')
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) errors.push('manifest size_bytes must be a positive safe integer')
  if (treeArchiveSha256 !== sha256) errors.push('manifest tree.archive_sha256 must equal manifest sha256')
  if (!/^[a-f0-9]{64}$/.test(treeSha256)) errors.push('manifest tree.sha256 must be a 64-character hexadecimal digest')
  if (!Number.isSafeInteger(treeFiles) || treeFiles <= 0) errors.push('manifest tree.files must be a positive integer')
  if (!Number.isSafeInteger(treeDirectories) || treeDirectories < 0) errors.push('manifest tree.directories must be a non-negative integer')
  if (!Number.isSafeInteger(treeSizeBytes) || treeSizeBytes <= 0) errors.push('manifest tree.size_bytes must be a positive safe integer')

  const importedManifestPath = join(campaignRoot, 'manifest.json')
  try {
    if (!existsSync(importedManifestPath) || !statSync(importedManifestPath).isFile()) {
      errors.push('imported .golden/karkas/manifest.json is missing or is not a regular file; run npm run golden:import')
    }
  } catch (error) {
    errors.push(`cannot inspect imported .golden/karkas/manifest.json: ${String(error?.message ?? error)}`)
  }

  if (errors.length) throw new Error(`Pinned GOLD manifest validation failed: ${errors.join('; ')}`)

  return {
    ...raw,
    repository: REPOSITORY,
    commit,
    url,
    sha256,
    size_bytes: sizeBytes,
    tree: {
      ...tree,
      archive_sha256: treeArchiveSha256,
      sha256: treeSha256,
      files: treeFiles,
      directories: treeDirectories,
      size_bytes: treeSizeBytes,
    },
  }
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

/** Recompute the imported tree digest using the golden-import canonical format. */
export async function verifyImportedTree(manifest, campaignRoot) {
  let rootStat
  try {
    rootStat = await lstat(campaignRoot)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Imported .golden/karkas tree is missing; run npm run golden:import (expected tree SHA-256 ${manifest.tree.sha256})`)
    }
    throw error
  }
  if (!rootStat.isDirectory()) throw new Error(`Imported .golden/karkas target is not a directory: ${campaignRoot}`)

  const entries = []
  const walk = async (directory) => {
    const children = await readdir(directory, { withFileTypes: true })
    children.sort((a, b) => compareText(a.name, b.name))
    for (const child of children) {
      const absolute = join(directory, child.name)
      const path = relative(campaignRoot, absolute).split(sep).join('/')
      const details = await lstat(absolute)
      if (details.isDirectory()) {
        entries.push({ type: 'directory', path, absolute, size: 0 })
        await walk(absolute)
      } else if (details.isFile()) {
        entries.push({ type: 'file', path, absolute, size: details.size })
      } else {
        throw new Error(`Unsupported filesystem entry in imported campaign tree: ${path}`)
      }
    }
  }
  await walk(campaignRoot)
  entries.sort((a, b) => compareText(a.path, b.path) || compareText(a.type, b.type))

  const hash = createHash('sha256')
  let files = 0
  let directories = 0
  let sizeBytes = 0
  for (const entry of entries) {
    if (entry.type === 'directory') {
      directories++
      hash.update(`directory\0${entry.path}\n`)
    } else {
      files++
      sizeBytes += entry.size
      hash.update(`file\0${entry.path}\0${entry.size}\0${await sha256File(entry.absolute)}\n`)
    }
  }
  const actual = { sha256: hash.digest('hex'), files, directories, size_bytes: sizeBytes }
  const expected = manifest.tree
  if (
    actual.sha256 !== expected.sha256 ||
    actual.files !== expected.files ||
    actual.directories !== expected.directories ||
    actual.size_bytes !== expected.size_bytes
  ) {
    throw new Error(`Imported campaign tree integrity mismatch: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`)
  }
  return actual
}
