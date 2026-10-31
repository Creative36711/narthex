import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import baselines from './protected-legacy-baselines.json' with { type: 'json' }

type CopyIdentity = { pack: string; data: string; campaign: string }
type CopyDisposition = 'equal' | 'protected-legacy-metadata' | 'mismatch'

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

function sha256File(path: string): string | null {
  return existsSync(path) ? sha256(readFileSync(path)) : null
}

function sha256Tree(path: string): string | null {
  if (!existsSync(path)) return null
  const entries: Array<[string, Buffer]> = []
  const walk = (dir: string, relative = ''): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, rel)
      else if (entry.isFile()) entries.push([rel, readFileSync(full)])
    }
  }
  walk(path)
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const hash = createHash('sha256')
  for (const [rel, bytes] of entries) {
    hash.update(rel)
    hash.update(Buffer.from([0]))
    hash.update(bytes)
    hash.update(Buffer.from([0]))
  }
  return hash.digest('hex')
}

/**
 * A legacy result on protected campaign data is accepted only while both the
 * complete public tree and the real public index match the recorded main SHA.
 * Any edit or new file expires the exception and restores the ordinary rule.
 */
export function isUnchangedProtectedCampaign(root: string, id: string): boolean {
  const baseline = id === 'ash-of-caerden'
    ? baselines.protectedCampaigns['ash-of-caerden']
    : id === 'fmv-crossing'
      ? baselines.protectedCampaigns['fmv-crossing']
      : null
  if (!baseline) return false
  const indexHash = sha256File(join(root, 'public/campaigns/index.json'))
  if (indexHash !== baselines.protectedCampaigns.publicIndexSha256) return false
  return sha256Tree(join(root, 'public/campaigns', id)) === baseline.treeSha256
}

/**
 * Classify a publication-copy delta without broad path exclusions. The sole
 * accepted difference is the byte-pinned title/author metadata pair on the
 * unchanged protected Ash source and published snapshot.
 */
export function classifyCampaignCopyDelta(
  identity: CopyIdentity,
  source: ReadonlyMap<string, string>,
  target: ReadonlyMap<string, string>,
  added: readonly string[],
  removed: readonly string[],
  differing: readonly string[],
): CopyDisposition {
  if (added.length === 0 && removed.length === 0 && differing.length === 0) return 'equal'

  const expected = baselines.protectedCampaigns['ash-of-caerden']
  const isAshPair = identity.pack === 'narrative' && identity.data === 'ash-of-caerden' && identity.campaign === 'ash-of-caerden'
  const onlyPinnedMetadataDiffers =
    added.length === 0 && removed.length === 0 &&
    differing.length === 1 && differing[0] === 'campaign.json' &&
    source.get('campaign.json') === expected.packCampaignJsonSha256 &&
    target.get('campaign.json') === expected.publicCampaignJsonSha256

  return isAshPair && onlyPinnedMetadataDiffers ? 'protected-legacy-metadata' : 'mismatch'
}

export const PROTECTED_LEGACY_BASELINE_COMMIT = baselines.baselineCommit
