import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dispatch.user.js', import.meta.url), 'utf8');
assert.match(source, /@version\s+0\.13\.17/, 'userscript version is bumped');
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