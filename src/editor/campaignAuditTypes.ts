export type AuditSeverity = 'error' | 'warning' | 'info'
export interface AuditFinding {
  severity: AuditSeverity
  message: string
}
export interface CampaignAuditReport {
  checkedAt: number
  structure: AuditFinding[]
  media: AuditFinding[]
  playtest: AuditFinding[]
}
export interface PlaytestRecord {
  startedAt: number
  finishedAt: number
  contentHash: string
  notes?: string
}
