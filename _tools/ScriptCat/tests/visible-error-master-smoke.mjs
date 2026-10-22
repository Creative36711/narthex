import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dispatch.user.js', import.meta.url), 'utf8');
const gatewaySource = await readFile(new URL('../drive-gateway.gs', import.meta.url), 'utf8');
assert.match(source, /@version\s+0\.14\.0/, 'userscript version is bumped');
assert(source.includes('b.textContent = enabled ? (paused ? "Возобновить автоочередь" : "Остановить автоочередь") : "Запустить автоочередь";'), 'mode toggle labels state-changing actions clearly');
assert(source.includes('exit.textContent = "Остановить автоматику";'), 'manual-mode exit button is an explicit stop action');
assert(source.includes('if (!confirm("Запустить автоматическую очередь?'), 'starting the automatic queue requires explicit confirmation');
assert(source.includes('const ACTIVE_CAMPAIGN_STATUSES = ["В работе", "На ревью", "Доработка", "Приёмка QA/TD"];'), 'Приёмка QA/TD is recognized as an active campaign status');
assert(source.includes('border-left:3px solid #ff7b6b;background:#4a1f1b88;color:#ffe2dc;font:600 12px/1.4 system-ui'), 'important/error log entries have distinct highlighted styling');
assert.equal((source.match(/GM_setValue\(C\.autoMode,\s*false\)/g) || []).length, 1, 'all stops of automated mode route through stopAutomation');
assert(source.includes('logEvent(reason, true, { urgent: true, title });'), 'stopAutomation logs with highlighted style and sends urgent ntfy push');
assert(source.includes('async function appendWithRunLogFallback('), 'submitAgent recovers automatically if Output Drive File ID was overwritten or changed to text/markdown');
assert(source.includes('const text = extractRenderedMessageProse(last) || (last.innerText || "").trim();'), 'monitorPending extracts rendered prose consistently with captureLatestRenderedAssistantMessage');
assert(source.includes('const onTargetExecutorPage = Boolean(retryRunning && rid && norm(currentAgentId) === norm(rid));'), 'retryRunning is permitted from the target Executor page as well as the active Coordinator page');
assert(source.includes('if (isUserTranscriptMessage(source))'), 'captureLatestRenderedAssistantMessage rejects user transcript messages');
assert(source.includes('if (isDispatchedPromptEcho(text))'), 'captureLatestRenderedAssistantMessage rejects dispatched prompt echoes');
assert(source.includes('(m) => !pending.baselineMessageIds?.includes(m.id) && !isUserTranscriptMessage(m)'), 'monitorPending excludes newly inserted user messages');
assert(source.includes('function classifyNtfyPush('), 'ntfy push classifier filters routine logs and separates quiet vs loud pushes');
assert(source.includes('function taskHasScriptCatSubmittedAnswer('), 'submitAgent and scheduleAutoSubmit distinguish ScriptCat-written Drive logs from premature MCP Submitted state');
assert(source.includes('if (completedForSameDispatch || (taskMatchesExecutorRole(task, role, id) && ["Submitted", "Accepted"].includes(state(task))))'), 'scheduleAutoSend hands off to scheduleAutoSubmit instead of pausing when Executor already finished or marked Submitted');
assert(gatewaySource.includes('if (!isRunLog || !mime.startsWith("text/"))'), 'Drive gateway append accepts any text/* MIME type in the Dispatch-Run log folder');
assert(!source.includes('The AI took too long to respond. Please try again.'), 'the special Arena timeout retry path and prompt text are removed');
assert(!source.includes('chatTimeoutRecovery'), 'timeout retry state is no longer persisted or consulted');
assert(!source.includes('location.reload()'), 'visible errors never trigger an automatic page reload');

const errorMonitorStart = source.indexOf('  async function monitorVisibleChatError() {');
const errorMonitorEnd = source.indexOf('  let monitorPendingInFlight = false;', errorMonitorStart);
assert(errorMonitorStart >= 0 && errorMonitorEnd > errorMonitorStart, 'visible-error monitor exists');
const errorMonitor = source.slice(errorMonitorStart, errorMonitorEnd);
assert(errorMonitor.includes('latestUserMessageAlert()'), 'the latest chat-message alert is detected');
assert(errorMonitor.includes('detectVisibleErrorCard()'), 'other visible UI error cards are detected');
assert(!errorMonitor.includes('.click(') && !errorMonitor.includes('sendButton'), 'error monitor never resends any chat message');
assert.equal((errorMonitor.match(/await pauseAutomation\(/g) || []).length, 2, 'both error paths immediately pause and notify the Master');
assert(source.includes('if (await monitorVisibleChatError()) return;'), 'error monitoring precedes pending-answer recovery');
const pendingMonitorStart = source.indexOf('  async function monitorPending() {');
const errorCheckPosition = source.indexOf('if (await monitorVisibleChatError()) return;', pendingMonitorStart);
const automationGuardPosition = source.indexOf('if (!(await autoEnabled()) || (await autoIsPaused())) return;', pendingMonitorStart);
assert(errorCheckPosition >= 0 && errorCheckPosition < automationGuardPosition, 'visible errors notify the Master even when automation is in manual mode');
assert(source.includes('Видимая ошибка Arena в последнем сообщении'), 'chat errors include the visible error text in the Master alert');

const resetStart = source.indexOf('  function coordinatorMarkerResetEligible(');
const resetEnd = source.indexOf('  function coordinatorMarkerRecoveryPrompt(', resetStart);
assert(resetStart >= 0 && resetEnd > resetStart, 'Coordinator marker-limit reset eligibility helper exists');
const resetEligibility = new Function('AUTO', 'norm', `${source.slice(resetStart, resetEnd)}\nreturn coordinatorMarkerResetEligible;`) (
  { coordinatorMarkerRetries: 2 },
  (value) => String(value || '').replace(/-/g, '').toLowerCase(),
);
const exhaustedTurn = { coordinatorId: 'coord-1', campaignId: 'campaign-1', turnId: 'turn-1', dispatchId: 'dispatch-1', runId: 'run-1', markerRetryCount: 2 };
assert.equal(resetEligibility(exhaustedTurn, 'coord-1', null), true, 'legacy exhausted marker turns can be explicitly reset on their Coordinator page');
assert.equal(resetEligibility({ ...exhaustedTurn, markerRetryCount: 1 }, 'coord-1', null), false, 'unfinished marker budgets do not prompt for reset');
assert.equal(resetEligibility(exhaustedTurn, 'executor-1', null), false, 'marker-limit reset is scoped to the matching Coordinator page');
assert.equal(resetEligibility(exhaustedTurn, 'coord-1', { kind: 'generic' }), false, 'a different pause reason cannot be mistaken for marker exhaustion');
assert.equal(resetEligibility(exhaustedTurn, 'coord-1', { kind: 'coordinator-marker-limit', turnId: 'old-turn' }), false, 'a stale pause cannot reset a different Coordinator turn');
assert.equal(resetEligibility(exhaustedTurn, 'coord-1', { kind: 'coordinator-marker-limit', turnId: 'turn-1', dispatchId: 'dispatch-1', runId: 'run-1' }), true, 'persisted pause metadata must match the exact turn and Dispatch/Run');

const ntfyStart = source.indexOf('  const IMPORTANT_QUIET_NTFY_PATTERNS = [');
const ntfyEnd = source.indexOf('  function logEvent(', ntfyStart);
assert(ntfyStart >= 0 && ntfyEnd > ntfyStart, 'ntfy push classifier block exists');
const classifyNtfyPush = new Function(`${source.slice(ntfyStart, ntfyEnd)}\nreturn classifyNtfyPush;`)();
assert.equal(classifyNtfyPush('Проверяю роль и очередь в Notion…', false), null, 'routine step logs are not sent to ntfy');
assert.equal(classifyNtfyPush('Обнаружен маркер завершения в chat-message-123; проверяю Dispatch/Run в Notion.', false), null, 'intermediate marker checks are not sent to ntfy');
assert.equal(classifyNtfyPush('Автопередача ждёт: другое действие', true), null, 'transient lock wait is not sent as loud ntfy error');
const quietMilestone = classifyNtfyPush('Ответ TD записан в Dispatch-Run; Notion → Submitted. Открываю Координатора.', false);
assert.equal(quietMilestone?.level, 'quiet', 'submitted handoff sends a quiet ntfy push');
assert.equal(quietMilestone?.urgent, false, 'quiet ntfy push is non-urgent');
assert.equal(quietMilestone?.priority, '2', 'quiet ntfy push uses low priority 2');
const loudStop = classifyNtfyPush('Автоматизация остановлена: кампания завершена', true, { urgent: true });
assert.equal(loudStop?.level, 'loud', 'automation stop sends a loud ntfy push');
assert.equal(loudStop?.urgent, true, 'loud ntfy push is urgent');
assert.equal(loudStop?.priority, '5', 'loud ntfy push uses max priority 5');
const manualSendNotice = classifyNtfyPush('Кнопку Send не удалось подтвердить; нажмите Send вручную один раз.', true, { ntfy: 'quiet', title: 'Narthex: требуется ручной Send' });
assert.equal(manualSendNotice?.level, 'quiet', 'manual Send fallback is visible but does not create an urgent automation-stop alert');
assert.equal(manualSendNotice?.urgent, false, 'manual Send fallback is non-urgent');
const pauseFnStart = source.indexOf('  async function pauseAutomation(');
const pauseFnEnd = source.indexOf('  async function currentPendingForPage(', pauseFnStart);
assert(source.slice(pauseFnStart, pauseFnEnd).includes('GM_setValue(C.autoPauseContext'), 'pause reason and reset scope persist across reloads');
assert(source.includes('kind: "coordinator-marker-limit"'), 'marker-limit pause records a scoped reset reason');
assert(source.includes('Да — сбросить лимит и продолжить. Нет — оставить паузу.'), 'reset requires explicit Yes/No confirmation');
assert(source.includes('Сбросить лимит напоминаний'), 'a dedicated reset button is available in the automation console');
assert(source.includes('button.style.display = eligible ? "inline-flex" : "none"'), 'the dedicated reset button is shown only for an eligible matching paused turn');
assert(source.includes('resetButton.onclick = () => b.click();'), 'the dedicated button opens the explicit confirmation flow');
assert(source.includes('coordinatorTurn.markerRetryCount = 0;'), 'only Coordinator marker retry count is reset by the specialized confirmation');
assert(source.includes('pauseContext?.kind === "coordinator-marker-limit" && !resetCoordinatorLimit'), 'mismatched page/turn cannot fall through to a generic resume');

console.log('ScriptCat visible-error escalation and Coordinator reset smoke checks passed.');
