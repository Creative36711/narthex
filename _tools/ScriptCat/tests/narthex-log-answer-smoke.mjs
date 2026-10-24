// Проба 1.4.40: в журнал хода попадает весь ответ, а не одна строка маркера.
//
// История: NAR-1.8, 23.10.2026. Kernel отчитался по делу без маркера, получил
// Техническое напоминание «ответь ровно одной последней строкой» и прислал
// ровно её. В Drive-журнал записался только маркер, Координатор прочитал его,
// не увидел работы и поставил Rework при уже слитом PR #32.
//
// Что проверяется здесь:
//   1) журнал собирается из всех сообщений хода и не дублирует повторы;
//   2) маркер без отчёта не считается ответом (порог minAnswerChars);
//   3) напоминание больше не просит «одну строку», а требует отчёт целиком;
//   4) в коде нет записи `hit.text` в журнал — только собранный ответ.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
const V = '1.4.44';

assert.match(src, new RegExp(`@version\\s+${V.replace(/\./g, '\\.')}`), `версия ${V}`);

// ── 1. runAnswer + answerBody ───────────────────────────────────────────────
const runFrom = src.indexOf('function runAnswer(expect, hit) {');
const runTo = src.indexOf('async function markerMissing(');
assert.ok(runFrom > 0 && runTo > runFrom, 'блок сборки ответа найден');

const buildAnswer = new Function(
  'messagesAfter',
  `${src.slice(runFrom, runTo)}\nreturn { runAnswer, answerBody };`,
);

const marker = (dispatch, run) =>
  `CF_AGENT_RESULT {"dispatch_id":"${dispatch}","run_id":"${run}","status":"submitted","check":0,"pr":32,"merged":true}`;
const report =
  'Изменённые файлы PR #32: docs/decisions/NAR-1.8.md, src/core/engine.ts, src/core/meta.ts. ' +
  'wc -l src/core/engine.ts = 599. Все 50 smoke зелёные, exit 0. Новые модули: director 243, ' +
  'character 414, checks 374, economy 396, dialogue-runtime 360, encounters 352, meta 221, roguelike 103.';

// 1.1. Отчёт и маркер — два сообщения одного хода: в журнале оба.
{
  const msgs = [
    { id: 'm1', text: report },
    { id: 'm2', text: marker('d1', 'r1') },
  ];
  const { runAnswer } = buildAnswer(() => msgs);
  const answer = runAnswer({ watermark: 'w' }, msgs[1]);
  assert.equal(answer.parts, 2, 'обе части хода попали в журнал');
  assert.match(answer.text, /### Часть 1 из 2/, 'части подписаны');
  assert.match(answer.text, /engine\.ts = 599/, 'отчёт в журнале есть');
  assert.match(answer.text, /CF_AGENT_RESULT/, 'маркер тоже на месте');
  assert.ok(answer.body > 200, `отчёт длиннее порога (${answer.body})`);
}

// 1.2. Ответ одним маркером — это не ответ: тело короче порога.
{
  const msgs = [{ id: 'm1', text: marker('d1', 'r1') }];
  const { runAnswer } = buildAnswer(() => msgs);
  const answer = runAnswer({ watermark: 'w' }, msgs[0]);
  assert.equal(answer.parts, 1, 'одна часть');
  assert.ok(answer.body < 200, `маркер без отчёта короче порога (${answer.body})`);
  assert.ok(!/engine\.ts/.test(answer.text), 'отчёта нет — не выдумываем');
}

// 1.3. Агент повторил отчёт целиком: в журнале две части, а не три.
{
  const msgs = [
    { id: 'm1', text: report },
    { id: 'm2', text: marker('d1', 'r1') },
    { id: 'm3', text: report },
    { id: 'm4', text: marker('d1', 'r1') },
  ];
  const { runAnswer } = buildAnswer(() => msgs);
  const answer = runAnswer({ watermark: 'w' }, msgs[3]);
  assert.equal(answer.parts, 2, 'одинаковые части не дублируются');
  assert.equal((answer.text.match(/engine\.ts = 599/g) || []).length, 1, 'отчёт записан один раз');
}

// 1.4. Маркер нашёлся не в последнем сообщении: он всё равно попадёт в журнал.
{
  const msgs = [{ id: 'm1', text: marker('d1', 'r1') }];
  const { runAnswer } = buildAnswer(() => msgs);
  const answer = runAnswer({ watermark: 'w' }, { id: 'm9', text: marker('d1', 'r1') });
  assert.equal(answer.parts, 1, 'ответ не потерялся и не удвоился');
}

// 1.5. answerBody не считает служебные строки отчётом.
{
  const { answerBody } = buildAnswer(() => []);
  assert.equal(answerBody('### Часть 1 из 2\n\nCF_AGENT_RESULT {"pr":32}'), 0, 'подпись части и маркер — не текст');
  assert.ok(answerBody(report) > 200, 'настоящий отчёт считается');
}

// ── 2. Порог и запись в журнал в submitExecutor ─────────────────────────────
assert.match(src, /minAnswerChars: 200,/, 'порог ответа в конфиге');
const submitFrom = src.indexOf('async function submitExecutor(');
const submitBlock = src.slice(submitFrom, src.indexOf('// ───────────────────────────── PR', submitFrom));
assert.ok(submitFrom > 0 && submitBlock.length > 0, 'исполнитель найден');
assert.match(submitBlock, /const answer = runAnswer\(expect, hit\);/, 'журнал собирается из всего хода');
assert.match(
  submitBlock,
  /if \(answer\.body < C\.minAnswerChars\) \{/,
  'маркер без отчёта не проходит порог',
);
assert.match(
  submitBlock,
  /return markerMissing\(role, expect, "CF_AGENT_RESULT", manual, "thin"\);/,
  'вместо записи пустого журнала — напоминание про отчёт',
);
assert.match(
  submitBlock,
  /const partsNote = answer\.parts > 1 \? `_Ответ собран из \$\{answer\.parts\} сообщений хода\._\\n\\n` : "";/,
  'видно, что ответ собран из нескольких сообщений',
);
assert.match(
  submitBlock,
  /entry: `\\n\\n\$\{marker\}\\n## Ответ \$\{role\.name\}\\n\\n\$\{partsNote\}\$\{answer\.text\}\\n`/,
  'в журнал пишется собранный ответ',
);
assert.ok(!/## Ответ \$\{role\.name\}\\n\\n\$\{hit\.text\}/.test(src), 'запись одного `hit.text` больше не используется');

// ── 3. Напоминание требует отчёт, а не строку ──────────────────────────────
assert.ok(!/ответь ровно одной последней строкой/.test(src), 'формулировка «ровно одна последняя строка» убрана');

const remindFrom = src.indexOf('function markerReminder(role, expect, attempt, markerName, why = "") {');
const remindTo = src.indexOf('function stillWorking() {');
assert.ok(remindFrom > 0 && remindTo > remindFrom, 'напоминание найдено');
const roleContextStub = () => 'КОНТЕКСТ';
const remind = new Function(
  'C', 'roleContext',
  `${src.slice(remindFrom, remindTo)}\nreturn markerReminder;`,
)({ markerReminders: 2 }, roleContextStub);

const roleKernel = { name: 'Kernel', fn: 'Executor' };
const expect = { kind: 'dispatch', ref: 'd1', runId: 'r1', title: 'NAR-1.8' };

const plain = remind(roleKernel, expect, 1, 'CF_AGENT_RESULT');
assert.match(plain, /без обязательного маркера CF_AGENT_RESULT/, 'обычное напоминание про маркер');
assert.match(plain, /Пришли ответ ещё раз целиком/, 'просим отчёт целиком');
assert.match(plain, /одним маркером вместо отчёта отвечать нельзя/, 'прямой запрет на маркер вместо отчёта');

const thin = remind(roleKernel, expect, 2, 'CF_AGENT_RESULT', 'thin');
assert.match(thin, /ОТЧЁТ НЕ ЗАПИСАН \(2 из 2;/, 'видно, что отчёта нет');
assert.match(thin, /пришла только служебная строка CF_AGENT_RESULT, без отчёта/, 'причина названа');
assert.match(thin, /Маркер без фактов не считается ответом/, 'объяснено, почему не принято');
assert.match(thin, /что изменил, что показали команды, какие числа получились/, 'просим факты');

// ── 4. Ручной шаг и пауза знают про «маркер без отчёта» ────────────────────
assert.match(
  src,
  /`\$\{role\.name\} прислал только маркер \$\{markerName\}, без отчёта — напоминание \$\{sent \+ 1\} из \$\{C\.markerReminders\}\./,
  'журнал отличает маркер без отчёта',
);
assert.match(src, /"Narthex: маркер без отчёта"/, 'тихий пуш называет причину');
assert.match(
  src,
  /why === "thin"\s*\n\s*\? `\$\{role\.name\} присылает только маркер \$\{markerName\}, без отчёта, после \$\{C\.markerReminders\} напоминаний\./,
  'пауза объясняет, что агент присылает только маркер',
);

console.log(
  `OK: narthex ${V} — журнал хода собирается из всех ответов, маркер без отчёта не считается ответом, ` +
    'напоминание требует отчёт целиком',
);
