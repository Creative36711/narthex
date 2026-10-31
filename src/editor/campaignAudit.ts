import type { CampaignAuditReport } from './campaignAuditTypes'

/** Media auditing (including frame/atmospherics and cutout-chromakey.py guidance) lives in campaignAuditMedia. */
export type { AuditSeverity, AuditFinding, CampaignAuditReport, PlaytestRecord } from './campaignAuditTypes'
export { collectCampaignMedia, campaignContentHash } from './campaignAuditMedia'
export { validateCampaign } from './campaignAuditValidation'

export function formatCampaignAuditReport(report: CampaignAuditReport): string {
  const lines = [
    `Проверка Narthex — ${new Date(report.checkedAt).toLocaleString()}`,
    '',
    'СТРУКТУРА И ССЫЛКИ',
    ...(report.structure.length ? report.structure.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ['ПРОБЛЕМ НЕТ']),
    'МЕДИА И ФАЙЛЫ',
    ...(report.media.length ? report.media.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ['ПРОБЛЕМ НЕТ']),
    'ПЛЕЙТЕСТ',
    ...(report.playtest.length ? report.playtest.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ['ИНФОРМАЦИЯ НЕ ЗАПИСАНА']),
  ]
  return lines.join('\n')
}

export function auditCounts(report: CampaignAuditReport): { errors: number; warnings: number; info: number } {
  const findings = [...report.structure, ...report.media, ...report.playtest]
  return {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
  }
}
