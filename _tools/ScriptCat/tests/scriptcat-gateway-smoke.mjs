import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dispatch.user.js', import.meta.url), 'utf8');
const helperStart = source.indexOf('  function normalizeRunLogResponse(');
const helperEnd = source.indexOf('  function runLogResponseShape(', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'run-log response normalizer exists');
const normalizeRunLogResponse = new Function(
  `${source.slice(helperStart, helperEnd)}\nreturn normalizeRunLogResponse;`,
)();

const driveId = '1AFhkcvDg9FnzONcEZFdpLvoNJtlpyYhh';
const name = 'dispatch-id_run-id.md';
assert.deepEqual(
  normalizeRunLogResponse({ ok: true, result: { fileId: driveId, name } }),
  { fileId: driveId, name },
  'current Apps Script result-wrapped response is recognized',
);
assert.deepEqual(
  normalizeRunLogResponse({ ok: true, fileId: driveId, name, result: { fileId: driveId, name } }),
  { fileId: driveId, name },
  'new top-level Apps Script response is recognized',
);
assert.deepEqual(
  normalizeRunLogResponse({ content: JSON.stringify({ result: { fileId: driveId, name } }) }),
  { fileId: driveId, name },
  'JSON-encoded nested response wrappers are recognized',
);
assert.deepEqual(
  normalizeRunLogResponse({ data: { file: { id: driveId, name } } }),
  { fileId: driveId, name },
  'generic file envelopes are recognized only with file metadata',
);
assert.deepEqual(
  normalizeRunLogResponse(`https://drive.google.com/file/d/${driveId}/view`),
  { fileId: driveId },
  'Drive links are normalized to their file ID',
);
assert.equal(normalizeRunLogResponse({ ok: true, result: 'duplicate' }), null, 'non-ID result is not mistaken for a log');
assert.equal(normalizeRunLogResponse({ id: driveId, name: 'unrelated-page' }), null, 'unrelated generic IDs are rejected');

assert(source.includes('resolve(action === "createLog" ? x : x.content ?? x.result ?? "")'), 'createLog keeps the full response envelope');
assert(source.includes('attempt <= 2'), 'createLog performs one bounded retry only');
assert(source.includes('Same Dispatch/Run pair is an idempotency key'), 'retry is protected by stable Dispatch/Run identity');
const retryableStart = source.indexOf('  function retryableRunLogError(');
const retryableEnd = source.indexOf('  async function createRunLog(', retryableStart);
const retryableRunLogError = new Function(
  `${source.slice(retryableStart, retryableEnd)}\nreturn retryableRunLogError;`,
)();
assert.equal(retryableRunLogError(new Error('Истекло время ожидания Google Apps Script шлюза.')), true);
assert.equal(retryableRunLogError(new Error('Неверный ключ шлюза.')), false, 'auth errors are not retried');
const shapeStart = source.indexOf('  function runLogResponseShape(');
const shapeEnd = source.indexOf('  function retryableRunLogError(', shapeStart);
const runLogResponseShape = new Function(
  `${source.slice(shapeStart, shapeEnd)}\nreturn runLogResponseShape;`,
)();
const createStart = source.indexOf('  async function createRunLog(');
const createEnd = source.indexOf('  async function recordRunLog(', createStart);
let calls = [];
const createRunLog = new Function(
  'gateway', 'C', 'normalizeRunLogResponse', 'retryableRunLogError', 'runLogResponseShape',
  `${source.slice(createStart, createEnd)}\nreturn createRunLog;`,
)((action, fileId, extra) => {
  calls.push({ action, fileId, extra });
  return Promise.resolve(calls.length === 1 ? { ok: true, result: 'created' } : { ok: true, result: { fileId: driveId, name } });
}, { runLogFolder: 'folder' }, normalizeRunLogResponse, retryableRunLogError, runLogResponseShape);
assert.deepEqual(await createRunLog('dispatch-id', 'run-id'), { fileId: driveId, name });
assert.equal(calls.length, 2, 'one malformed success gets one idempotent retry');
assert.deepEqual(calls[0].extra, calls[1].extra, 'retry reuses the same Dispatch/Run identity');
assert.equal(calls[1].extra.dispatchId, 'dispatch-id');
assert.equal(calls[1].extra.runId, 'run-id');

const gateway = await readFile(new URL('../drive-gateway.gs', import.meta.url), 'utf8');
const createLogStart = gateway.indexOf('if (request.action === "createLog")');
const createLogEnd = gateway.indexOf('if (request.action === "savePayload")', createLogStart);
assert(createLogStart > 0 && createLogEnd > createLogStart, 'gateway keeps a createLog branch');
const createLog = gateway.slice(createLogStart, createLogEnd);
assert.equal((createLog.match(/^\s*fileId: /gm) || []).length, 2, 'new and idempotent createLog results expose a top-level fileId');
assert.equal((createLog.match(/result: \{ fileId: /g) || []).length, 2, 'both createLog branches keep the nested result for older callers');
const version = gateway.match(/version: "(\d+)\.(\d+)"/);
assert(version, 'gateway source declares its contract version');
assert(
  Number(version[1]) > 1 || (Number(version[1]) === 1 && Number(version[2]) >= 2),
  `gateway version ${version[1]}.${version[2]} is older than the 1.2 response contract`,
);

console.log('ScriptCat Gateway run-log contract smoke checks passed.');
