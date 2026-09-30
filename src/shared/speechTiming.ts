/**
 * Запасной таймаут для Web Speech API. Он намеренно заметно длиннее
 * ожидаемого произнесения: это watchdog на потерянное событие onend, а не
 * расписание перехода к следующей реплике.
 */
export function speechCompletionTimeoutMs(text: string, rate = 1): number {
  const safeRate = Math.max(0.5, Math.min(2, rate))
  const estimate = text.length * (130 / safeRate) + 12_000
  return Math.min(10 * 60_000, Math.max(20_000, Math.ceil(estimate)))
}
