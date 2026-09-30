import type { CampaignMeta } from '../shared/types'
import { ENGINE_VERSION, checkEngine, checkPackage, compareVersions } from '../shared/versions'

/**
 * Only offer to lower an engine requirement when it looks like the campaign's
 * own version was copied into min_engine, the package format is supported,
 * and content validation found no issues. Never silently rewrite a real
 * forward-compatibility requirement.
 */
export function canOfferEngineVersionRepair(meta: Pick<CampaignMeta, 'version' | 'engine_version' | 'min_engine' | 'package_format'>, contentIssues: string[]): boolean {
  const required = meta.min_engine ?? meta.engine_version
  return Boolean(
    required &&
    meta.version &&
    !checkEngine(required).ok &&
    checkPackage(meta.package_format).ok &&
    compareVersions(required, meta.version) === 0 &&
    contentIssues.length === 0,
  )
}

/** After the user confirms the above correction, keep both current and legacy fields aligned. */
export function setCurrentEngineRequirement(meta: CampaignMeta): void {
  meta.min_engine = ENGINE_VERSION
  meta.engine_version = ENGINE_VERSION
}
