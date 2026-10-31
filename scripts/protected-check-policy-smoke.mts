import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { scanBrandRoot } from './brand-guard.mts'
import { auditDevCampaigns } from './check-dev-campaigns.mts'
import { classifyCampaignCopyDelta, isUnchangedProtectedCampaign } from './protected-check-policy.mts'

const repoRoot = path.resolve(import.meta.dirname, '..')
const tempRoot = await mkdtemp(path.join(tmpdir(), 'narthex-protected-checks-'))
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex')

async function copyCampaigns(name: string): Promise<string> {
  const root = path.join(tempRoot, name)
  await mkdir(path.join(root, 'public'), { recursive: true })
  await cp(path.join(repoRoot, 'public/campaigns'), path.join(root, 'public/campaigns'), { recursive: true })
  return root
}

try {
  // The actual protected snapshots remain accepted, but a byte or path change
  // makes the dev-campaign gate strict again.
  const intactRoot = await copyCampaigns('intact')
  assert.equal(isUnchangedProtectedCampaign(intactRoot, 'ash-of-caerden'), true)
  assert.equal(isUnchangedProtectedCampaign(intactRoot, 'fmv-crossing'), true)
  const intactAudit = auditDevCampaigns(intactRoot)
  assert.deepEqual(intactAudit.problems, [])
  assert.equal(intactAudit.acceptedLegacy.length, 2)

  const changedTreeRoot = await copyCampaigns('changed-tree')
  await writeFile(path.join(changedTreeRoot, 'public/campaigns/fmv-crossing/unapproved.note'), 'unapproved path\n')
  assert.equal(isUnchangedProtectedCampaign(changedTreeRoot, 'fmv-crossing'), false)
  const changedTreeAudit = auditDevCampaigns(changedTreeRoot)
  assert.ok(changedTreeAudit.problems.some((problem) => problem.includes('fmv-crossing') && problem.includes('нет dev-fixture.json')))

  const changedAshRoot = await copyCampaigns('changed-ash')
  const ashMetadataPath = path.join(changedAshRoot, 'public/campaigns/ash-of-caerden/campaign.json')
  const ashMetadata = JSON.parse(await readFile(ashMetadataPath, 'utf8')) as Record<string, unknown>
  ashMetadata.title = `${String(ashMetadata.title)} changed`
  await writeFile(ashMetadataPath, `${JSON.stringify(ashMetadata, null, 2)}\n`)
  assert.equal(isUnchangedProtectedCampaign(changedAshRoot, 'ash-of-caerden'), false)
  assert.ok(auditDevCampaigns(changedAshRoot).problems.some((problem) => problem.includes('ash-of-caerden') && problem.includes('заголовок без префикса [DEV]')))

  const changedIndexRoot = await copyCampaigns('changed-index')
  const indexPath = path.join(changedIndexRoot, 'public/campaigns/index.json')
  await writeFile(indexPath, `${await readFile(indexPath, 'utf8')}\n`)
  assert.equal(isUnchangedProtectedCampaign(changedIndexRoot, 'ash-of-caerden'), false)

  // The campaign-copy exception is limited to the exact two historical JSON
  // blobs and to the exact publication identity; any extra path fails closed.
  const identity = { pack: 'narrative', data: 'ash-of-caerden', campaign: 'ash-of-caerden' }
  const source = new Map<string, string>([
    ['campaign.json', '8442a9a8647ec43bfa3256bfd37377e85c8d31e56bc1872f81de04c5d0f879e6'],
    ['world.json', 'world-sha'],
  ])
  const target = new Map<string, string>([
    ['campaign.json', '95ec991006e3023ae3885de302257c1d9e9321561c7386f672a89eea3a5f129d'],
    ['world.json', 'world-sha'],
  ])
  assert.equal(classifyCampaignCopyDelta(identity, source, target, [], [], ['campaign.json']), 'protected-legacy-metadata')
  assert.equal(classifyCampaignCopyDelta(identity, source, target, [], ['unapproved.note'], ['campaign.json']), 'mismatch')
  const changedMetadata = new Map(source)
  changedMetadata.set('campaign.json', 'not-the-pinned-source')
  assert.equal(classifyCampaignCopyDelta(identity, changedMetadata, target, [], [], ['campaign.json']), 'mismatch')
  assert.equal(classifyCampaignCopyDelta(
    { ...identity, campaign: 'renamed-copy' }, source, target, [], [], ['campaign.json'],
  ), 'mismatch')

  // Exact unchanged legacy content is exempt by path+hash only. A modified
  // snapshot and any newly introduced path with the same brand marker fail.
  const brandRoot = path.join(tempRoot, 'brand')
  await mkdir(path.join(brandRoot, 'docs'), { recursive: true })
  const oldProductTitle = ['Chronicle', 'Forge'].join(' ')
  const legacyText = `# ${oldProductTitle} historical note\n`
  await writeFile(path.join(brandRoot, 'docs/legacy.md'), legacyText)
  const pinned = { 'docs/legacy.md': hash(legacyText) }
  const intactBrandScan = scanBrandRoot(brandRoot, pinned)
  assert.deepEqual(intactBrandScan.hits, [])
  assert.equal(intactBrandScan.unchangedBaselineFiles, 1)

  await writeFile(path.join(brandRoot, 'docs/legacy.md'), `${legacyText}changed\n`)
  await writeFile(path.join(brandRoot, 'docs/unapproved.md'), `# ${oldProductTitle}\n`)
  await mkdir(path.join(brandRoot, 'dist-ai'), { recursive: true })
  await writeFile(path.join(brandRoot, 'dist-ai/generated.md'), `# ${oldProductTitle}\n`)
  await mkdir(path.join(brandRoot, 'docs/dist-ai'), { recursive: true })
  await writeFile(path.join(brandRoot, 'docs/dist-ai/unapproved.md'), `# ${oldProductTitle}\n`)
  const changedBrandScan = scanBrandRoot(brandRoot, pinned)
  assert.ok(changedBrandScan.hits.some((hit) => hit.startsWith('docs/legacy.md:')))
  assert.ok(changedBrandScan.hits.some((hit) => hit.startsWith('docs/unapproved.md:')))
  assert.ok(changedBrandScan.hits.some((hit) => hit.startsWith('docs/dist-ai/unapproved.md:')))
  assert.ok(!changedBrandScan.hits.some((hit) => hit.startsWith('dist-ai/generated.md:')))

  // The regenerated audit artifact is allowed only as this exact path+hash.
  // A changed bundle or the same content at a new path reactivates brand scanning.
  const auditBundle = await readFile(path.join(repoRoot, 'public/ai/campaign-audit.mjs'))
  const auditRoot = path.join(tempRoot, 'pinned-audit-bundle')
  const auditPath = path.join(auditRoot, 'public/ai/campaign-audit.mjs')
  await mkdir(path.dirname(auditPath), { recursive: true })
  await writeFile(auditPath, auditBundle)
  const exactAuditScan = scanBrandRoot(auditRoot)
  assert.deepEqual(exactAuditScan.hits, [])
  assert.equal(exactAuditScan.unchangedBaselineFiles, 1)

  await writeFile(auditPath, Buffer.concat([auditBundle, Buffer.from('\n')]))
  const changedAuditScan = scanBrandRoot(auditRoot)
  assert.ok(changedAuditScan.hits.some((hit) => hit.startsWith('public/ai/campaign-audit.mjs:')))

  await writeFile(auditPath, auditBundle)
  await writeFile(path.join(auditRoot, 'public/ai/unapproved.mjs'), auditBundle)
  const unapprovedAuditScan = scanBrandRoot(auditRoot)
  assert.ok(unapprovedAuditScan.hits.some((hit) => hit.startsWith('public/ai/unapproved.mjs:')))
  assert.ok(!unapprovedAuditScan.hits.some((hit) => hit.startsWith('public/ai/campaign-audit.mjs:')))

  console.log('✓ protected-check-policy smoke — exact snapshots accepted; changed trees, metadata deltas, and unauthorized brand paths rejected')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
