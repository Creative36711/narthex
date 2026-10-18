import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dispatch.user.js', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README-авторизация.md', import.meta.url), 'utf8');
const autoBudget = source.match(/const AUTO = \{ maxSends: (\d+),/);
assert.ok(autoBudget, 'automatic send budget is declared');
assert.equal(Number(autoBudget[1]), 2, 'automatic mode allows two total sends: initial send plus one retry');
assert(source.includes('Достигнут предел в две отправки (исходная и один повтор) без маркера завершения.'), 'pause message matches the two-send budget');
assert(readme.includes('максимум две отправки всего'), 'README documents the two-send maximum');
assert(!/до трёх попыток|максимум три отправки|После третьей неудачи/.test(readme), 'README has no stale three-attempt limit');
const sendButtonStart = source.indexOf('  function normalizedButtonLabel(value) {');
const sendButtonEnd = source.indexOf('  function closeCompletionPanel()', sendButtonStart);
assert(sendButtonStart >= 0 && sendButtonEnd > sendButtonStart, 'send-button selector helpers exist');
const sendButtonHelpers = new Function('isVisible', `${source.slice(sendButtonStart, sendButtonEnd)}\nreturn { isSendButtonCandidate, isSendButtonDisabled, chooseSendButton, isSendButtonReady };`)(
  (button) => Boolean(button?.visible),
);
const fakeSendButton = ({ aria = '', title = '', testId = '', text = '', disabled = false, ariaDisabled = '', visible = true, isConnected = true } = {}) => ({
  disabled,
  isConnected,
  visible,
  textContent: text,
  getAttribute(name) {
    return ({ 'aria-label': aria, title, 'data-testid': testId, 'aria-disabled': ariaDisabled })[name] || null;
  },
});
const hiddenSendButton = fakeSendButton({ aria: 'Send message', visible: false });
const disabledSendButton = fakeSendButton({ aria: 'Send message', disabled: true });
const activeSendButton = fakeSendButton({ testId: 'composer-sendButton' });
assert.equal(sendButtonHelpers.isSendButtonCandidate(activeSendButton), true, 'send-button test IDs are recognized even without an aria-label');
assert.equal(sendButtonHelpers.chooseSendButton([hiddenSendButton, disabledSendButton, activeSendButton], (button) => button.visible), activeSendButton, 'visible enabled Send wins over an earlier hidden/disabled duplicate');
assert.equal(sendButtonHelpers.isSendButtonReady(activeSendButton), true, 'visible enabled Send candidate is actionable');
assert.equal(sendButtonHelpers.isSendButtonReady(fakeSendButton({ aria: 'Send message', ariaDisabled: 'true' })), false, 'aria-disabled Send is not clicked');
const dispatchStart = source.indexOf('  async function dispatch(task, roles, { retryRunning = false } = {}) {');
const dispatchEnd = source.indexOf('  async function submitAgent(', dispatchStart);
assert(dispatchStart >= 0 && dispatchEnd > dispatchStart, 'Dispatch helper exists for retry budget reset check');
assert(source.slice(dispatchStart, dispatchEnd).includes('await GM_setValue(autoCountKey(p.id), 0);'), 'fresh Ready dispatch resets the prior retry budget');
const retryStart = source.indexOf('  async function retryPending(pending, reason) {');
const retryEnd = source.indexOf('  async function monitorVisibleChatError()', retryStart);
assert(retryStart >= 0 && retryEnd > retryStart, 'automatic retry helper exists');
const retryBody = source.slice(retryStart, retryEnd);
assert(retryBody.indexOf('currentState !== "Running" || !sameRun') < retryBody.indexOf('const count ='), 'stale/non-Running attempts are discarded before retry-budget checks');
const freshnessStart = source.indexOf('  function isFreshExecutorMessage(');
const freshnessEnd = source.indexOf('  function agentResult(', freshnessStart);
assert(freshnessStart >= 0 && freshnessEnd > freshnessStart, 'Executor freshness helpers exist');
const freshnessHelpers = new Function(`${source.slice(freshnessStart, freshnessEnd)}\nreturn { isFreshExecutorMessage, uuidV7Timestamp, isFreshManualExecutorMessage, manualPreparedMatchesRun };`)();
const { isFreshExecutorMessage, uuidV7Timestamp, isFreshManualExecutorMessage, manualPreparedMatchesRun } = freshnessHelpers;
const submittedPrompt = { sentAt: 123, baselineMessageIds: ['chat-message-old-id'] };
assert.equal(isFreshExecutorMessage('old-id', submittedPrompt), false, 'a pre-send marker-bearing transcript message is stale');
assert.equal(isFreshExecutorMessage('new-id', submittedPrompt), true, 'a post-send message can be examined for a result marker');
assert.equal(isFreshExecutorMessage('new-id', { ...submittedPrompt, baselineMessageIds: ['new-id'] }), false, 'accepts baseline IDs with or without DOM prefix');
assert.equal(isFreshExecutorMessage('new-id', { ...submittedPrompt, baselineMessageIds: [] }), true, 'fresh message is permitted when send baseline was empty');
assert.equal(isFreshExecutorMessage('new-id', { baselineMessageIds: [] }), false, 'messages are not fresh without a confirmed send timestamp');
const makeUuidV7 = (ms) => {
  const hex = BigInt(ms).toString(16).padStart(12, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7000-8000-000000000000`;
};
const preparedAt = Date.now() - 1000;
const sentManual = { key: 'dispatch-1:run-1', sent: true, preparedAt };
assert.equal(uuidV7Timestamp(makeUuidV7(preparedAt - 1)), preparedAt - 1, 'UUIDv7 ID timestamp is decoded');
assert.equal(isFreshManualExecutorMessage(makeUuidV7(preparedAt - 1), sentManual), false, 'pre-send transcript response is rejected');
assert.equal(isFreshManualExecutorMessage(makeUuidV7(preparedAt + 1), sentManual), true, 'manual send can be recovered from a post-send UUIDv7 response');
assert.equal(isFreshManualExecutorMessage(makeUuidV7(preparedAt + 1), { ...sentManual, sent: false }), false, 'an unsent manual preparation is not treated as a reply');
assert.equal(manualPreparedMatchesRun(sentManual, 'dispatch-1', 'run-1'), true, 'manual send is correlated to its exact Dispatch/Run');
assert.equal(manualPreparedMatchesRun(sentManual, 'dispatch-1', 'run-old'), false, 'manual send cannot authorize another Run');
const manualSendStart = source.indexOf('  async function sendPreparedManualPrompt(');
const manualSendEnd = source.indexOf('  async function prepareManualPrompt(', manualSendStart);
const manualSendBody = source.slice(manualSendStart, manualSendEnd);
assert(manualSendBody.includes('baselineMessageIds') && manualSendBody.includes('await GM_setValue(C.pendingPrompt, sentPrompt);'), 'manual Send preserves post-send correlation and baseline');
assert(!manualSendBody.includes('await GM_setValue(C.pendingPrompt, null);'), 'manual Send does not erase the correlation before the reply arrives');
assert(!source.includes('copy(coordinatorNote)'), 'Coordinator dispatch notification is not copied to clipboard');
assert(!source.includes('Текст уведомления Координатору скопирован в буфер'), 'obsolete clipboard log is absent');
assert(!source.includes('GM_setClipboard'), 'userscript no longer writes Coordinator notifications to clipboard');

const start = source.indexOf('  function coordinatorTurnFooter(');
const end = source.indexOf('  function createCoordinatorTurn(', start);
assert(start >= 0 && end > start, 'Coordinator pure helper block exists');
const helpers = new Function(`${source.slice(start, end)}\nreturn { coordinatorResult, coordinatorTurnMatches };`)();
const { coordinatorResult, coordinatorTurnMatches } = helpers;

const turn = { campaignId: 'camp-1', turnId: 'turn-1', dispatchId: 'dispatch-1', runId: 'run-7' };
const validLine = 'CF_COORDINATOR_RESULT {"campaign_id":"camp-1","turn_id":"turn-1","status":"completed","dispatch_id":"dispatch-1","run_id":"run-7"}';
assert.deepEqual(coordinatorResult(`Done.\r\n${validLine}\r\n`), {
  campaign_id: 'camp-1', turn_id: 'turn-1', status: 'completed', dispatch_id: 'dispatch-1', run_id: 'run-7',
});
assert.equal(coordinatorTurnMatches(turn, coordinatorResult(validLine)), true);
assert.equal(coordinatorTurnMatches(turn, coordinatorResult(validLine.replace('run-7', 'run-old'))), false);
assert.equal(coordinatorTurnMatches(turn, coordinatorResult(validLine.replace('turn-1', 'turn-old'))), false);
assert.equal(coordinatorTurnMatches({ campaignId: 'camp-1', turnId: 'turn-1' }, coordinatorResult('CF_COORDINATOR_RESULT {"campaign_id":"camp-1","turn_id":"turn-1","status":"completed"}')), true, 'campaign queue turns do not require Dispatch/Run IDs');
assert.equal(coordinatorResult(`${validLine}\nДополнительный текст`), null, 'marker must be the final non-empty line');
assert.equal(coordinatorResult(`\u200b${validLine.replaceAll(' ', '\u00a0')}`)?.campaign_id, 'camp-1', 'normalizes invisible separators and NBSP');
assert.equal(coordinatorResult('CF_COORDINATOR_RESULT {broken'), null, 'rejects malformed JSON');

assert(source.includes('function coordinatorMarkerRecoveryPrompt(previousTurn, nextTurn, attempt, previousMessageId)'), 'Coordinator missing-marker recovery helper exists');
assert(source.includes('не повторяй уже выполненные изменения'), 'recovery prevents duplicate Coordinator mutations');
assert(source.includes('Dispatch ${previousTurn.dispatchId}'), 'recovery retains the original Dispatch correlation');
assert(source.includes('не является причиной просить участия Мастера'), 'missing marker alone does not ask for Master intervention');
assert(source.includes('kind: "coordinator-marker-recovery"'), 'missing-marker recovery is routed through automatic Coordinator handoff');
assert(source.includes('setTimeout(scheduleCoordinatorHandoff, 250)'), 'recovery handoff is scheduled automatically');
assert(source.includes('nextTurn.baselineMessageIds = Array.from(document.querySelectorAll'), 'recovery correlates only responses sent after its prompt');
assert(source.includes('coordinatorMarkerRetries: 2'), 'automatic reminders are bounded before pausing safely');
assert(!source.includes('вручную попросите Координатора завершить его точным маркером'), 'missing marker no longer instructs the Master to prompt manually');

const autoStart = source.indexOf('  async function scheduleCoordinatorAuto() {');
const autoEnd = source.indexOf('  let coordinatorResultTimer', autoStart);
const autoBody = source.slice(autoStart, autoEnd);
assert(autoBody.indexOf('if (await GM_getValue(C.pendingCoordinatorTurn, null)) return;') < autoBody.indexOf('const queued ='), 'pending Coordinator turn gates queue checks/dispatch');
assert(!source.includes('patch(campaign.id'), 'userscript must not mutate campaign fields automatically');
assert(source.includes('scheduleCoordinatorHandoff();'), 'Coordinator handoff remains scheduled');
console.log('Coordinator cycle smoke checks passed.');
assert(source.includes('async function queueDispatchPreflightRepair(coordinator, task, reason)'), 'invalid Ready tasks queue a scoped Coordinator repair');
assert(source.includes('kind: "dispatch-preflight"'), 'preflight repair is correlated as a Coordinator turn');
assert(source.includes('Координатор исправил preflight-задачу'), 'Coordinator reply is verified before retrying the Executor');
assert(source.includes('Координатор не устранил ошибку подготовки задачи'), 'automation gates a retry if the Coordinator did not repair the task');
console.log('Coordinator preflight repair smoke checks passed.');
const coordinatorAutoStart = source.indexOf('  async function scheduleCoordinatorAuto() {');
const coordinatorAutoEnd = source.indexOf('  let coordinatorResultTimer', coordinatorAutoStart);
assert(source.slice(coordinatorAutoStart, coordinatorAutoEnd).includes('let dispatchingTask = null;'), 'auto-dispatch failure handler keeps the current task in scope');
assert(source.slice(coordinatorAutoStart, coordinatorAutoEnd).includes('let roles = [];'), 'role registry remains available to dispatch error recovery');
assert(source.includes('async function clearForeignCoordinatorHandoffState(activeCoordinatorId)'), 'foreign Coordinator handoff state cleanup helper exists');
assert(source.slice(coordinatorAutoStart, coordinatorAutoEnd).includes('await clearForeignCoordinatorHandoffState(coordinator.id);'), 'Coordinator auto-dispatch clears stale handoff state from a replaced Coordinator agent');
const identityStart = source.indexOf('  function extractAgentIdFromUrl(');
const identityEnd = source.indexOf('  async function roleList()', identityStart);
assert(identityStart >= 0 && identityEnd > identityStart, 'role agent identity helpers exist');
const { extractAgentIdFromUrl, resolveRoleAgentIdentity } = new Function(`${source.slice(identityStart, identityEnd)}\nreturn { extractAgentIdFromUrl, resolveRoleAgentIdentity };`)();
assert.equal(extractAgentIdFromUrl('https://arena.ai/agent/01a14fa6-df25-71d3-8238-5bbbc91bd7a4'), '01a14fa6-df25-71d3-8238-5bbbc91bd7a4', 'extracts agent ID from Arena URL');
assert.deepEqual(
  resolveRoleAgentIdentity('01a14fa6-df25-ё-8238-5bbbc91bd7a4', 'https://arena.ai/agent/01a14fa6-df25-71d3-8238-5bbbc91bd7a4'),
  { id: '01a14fa6-df25-71d3-8238-5bbbc91bd7a4', url: 'https://arena.ai/agent/01a14fa6-df25-71d3-8238-5bbbc91bd7a4' },
  'URL takes precedence when Arena Agent ID is stale or mistyped',
);
assert.deepEqual(
  resolveRoleAgentIdentity('01a14fa6-df25-71d3-8238-5bbbc91bd7a4', ''),
  { id: '01a14fa6-df25-71d3-8238-5bbbc91bd7a4', url: 'https://arena.ai/agent/01a14fa6-df25-71d3-8238-5bbbc91bd7a4' },
  'synthesizes Arena Agent URL when only Arena Agent ID is provided',
);
assert.deepEqual(
  resolveRoleAgentIdentity('', 'https://arena.ai/agent/01a14fa6-df25-71d3-8238-5bbbc91bd7a4'),
  { id: '01a14fa6-df25-71d3-8238-5bbbc91bd7a4', url: 'https://arena.ai/agent/01a14fa6-df25-71d3-8238-5bbbc91bd7a4' },
  'derives Arena Agent ID when only Arena Agent URL is provided',
);
assert(source.includes('function findExecutorRoleForTask(task, roles)'), 'Executor lookup resolves by role name first');
assert(source.includes('function taskMatchesExecutorRole(task, role, pageAgentId = role?.id)'), 'Executor task matching supports replaced agents by role name');
assert(source.includes('async function isActionLockHeld()'), 'stale action locks auto-expire safely');
