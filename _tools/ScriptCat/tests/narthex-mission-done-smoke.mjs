// Проба 1.4.43: конец миссии — событие, возврат миссии — задача.
//
// 24.10 в 15:49 Координатор закрыл миссию NAR-1 (`Состояние = Завершена`,
// `next:done`), а ScriptCat написал в журнал только «Нет активной миссии —
// ждём»: ни зелёной строки, ни пуша, ни выключенного автоцикла. Мастер узнал
// о конце работы из чата.
//
// Здесь проверяется:
//   • конец миссии объявляется один раз: зелёная строка, громкий пуш, автоцикл
//     выключен, ожидание снято;
//   • обычное «миссии пока нет» (закрытая миссия недельной давности) остаётся
//     тишиной;
//   • «Возвращена» — активная миссия, замечания идут в план Координатора;
//   • возвращённую миссию нельзя закрыть без раздела «Возврат» в «Итоге»;
//   • закрытие плашки не даёт двух одинаковых строк в журнале.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

const sliceBetween = (startMarker, endMarker) => {
  const from = src.indexOf(startMarker);
  const to = src.indexOf(endMarker, from);
  assert.ok(from > 0 && to > from, `блок ${startMarker.slice(0, 40)} на месте`);
  return src.slice(from, to);
};

// ── 1. Цвет журнала ────────────────────────────────────────────────────────
const colorBlock = sliceBetween('const logColor = (e) =>', 'function renderLog()');
assert.match(colorBlock, /"#8ee28e"/, 'зелёный цвет есть');
assert.match(colorBlock, /"#ffd479"/, 'жёлтый цвет есть');
assert.match(colorBlock, /e\.error \? "#ff9a9a"/, 'ошибка остаётся красной');
assert.match(src, /tone: options\.tone \|\| ""/, 'тон строки сохраняется вместе с записью');
{
  const fn = new Function(`${colorBlock}; return logColor;`)();
  assert.equal(fn({ error: true, tone: 'ok' }), '#ff9a9a', 'ошибка важнее тона');
  assert.equal(fn({ error: false, tone: 'ok' }), '#8ee28e', 'успех — зелёный');
  assert.equal(fn({ error: false, tone: 'warn' }), '#ffd479', 'предупреждение — жёлтое');
  assert.equal(fn({ error: false }), 'inherit', 'рутина остаётся обычной');
}

// ── 2. Конец миссии: объявление события ────────────────────────────────────
const noticeBlock = sliceBetween('  async function missionDoneNotice(expect) {', '  /**\n   * Блок замечаний Мастера');
assert.match(noticeBlock, /autoSet\(false\)/, 'автоцикл выключается: цикл остановлен, а не «ждёт»');
assert.match(noticeBlock, /ntfy: "loud"/, 'пуш громкий');
assert.match(noticeBlock, /tone: failed \? "warn" : "ok"/, 'успех зелёный, провал жёлтый');
assert.match(noticeBlock, /cfn-mission-done:/, 'событие объявляется один раз на миссию');
assert.match(noticeBlock, /GM_setValue\(K\.expect, null\)/, 'ожидание снимается: ход вернуть некуда');

function makeNotice({ closed = null, store = new Map(), expect = null, now = Date.now() } = {}) {
  const logs = [];
  const fn = new Function(
    'GM_getValue', 'GM_setValue', 'K', 'log', 'lastClosedMission', 'autoSet', 'rt', 'missionKind', 'Date',
    `${noticeBlock}; return missionDoneNotice;`,
  );
  const call = fn(
    (k, d) => (store.has(k) ? store.get(k) : d),
    (k, v) => store.set(k, v),
    { expect: 'cfn-expect' },
    (t, e, o) => logs.push({ t, e, o }),
    async () => closed,
    () => store.set('auto', false),
    (prop) => (prop?.rich_text || []).map((x) => x.text?.content || '').join(''),
    (page) => page?.properties?.['Состояние']?.select?.name || '',
    class extends Date {
      constructor(...args) {
        super(...(args.length ? args : [now]));
      }
      static now() {
        return now;
      }
    },
  );
  return { call, logs, store };
}

const closedMission = (state = 'Завершена', at = '2026-10-24') => ({
  id: 'mission-1',
  properties: {
    'Миссия': { rich_text: [{ text: { content: 'NAR-1 · Ядро под паки' } }] },
    'Состояние': { select: { name: state } },
    'Завершена': { date: { start: at } },
  },
});

// 2a. Конец миссии после запрошенного плана: это событие.
{
  const { call, logs, store } = makeNotice({
    closed: closedMission(),
    expect: { kind: 'plan', ref: 'mission-1' },
  });
  const handled = await call({ kind: 'plan', ref: 'mission-1' });
  assert.equal(handled, true, 'шаг считается обработанным');
  assert.equal(store.get('cfn-expect'), null, 'ожидание снято');
  assert.equal(store.get('auto'), false, 'автоцикл выключен');
  assert.equal(logs.length, 1, 'одна строка, а не две');
  assert.match(logs[0].t, /Миссия «NAR-1 · Ядро под паки» завершена/, 'видно, какая миссия');
  assert.match(logs[0].t, /цикл остановлен/, 'сказано, что дальше ничего не поедет');
  assert.equal(logs[0].o.tone, 'ok', 'строка зелёная');
  assert.equal(logs[0].o.ntfy, 'loud', 'и с громким пушем');
}

// 2b. Повторный шаг не повторяет пуш.
{
  const store = new Map();
  const closed = closedMission();
  const first = makeNotice({ closed, store, expect: { kind: 'plan' } });
  await first.call({ kind: 'plan' });
  const second = makeNotice({ closed, store, expect: { kind: 'plan' } });
  const handled = await second.call({ kind: 'plan' });
  assert.equal(handled, true, 'шаг по-прежнему обработан');
  assert.equal(second.logs.length, 0, 'второй раз пуш не уходит');
}

// 2c. Закрытая миссия недельной давности — не событие.
{
  const { call, logs } = makeNotice({ closed: closedMission('Завершена', '2026-10-15'), expect: null });
  const handled = await call(null);
  assert.equal(handled, false, 'шаг не считается особым событием');
  assert.equal(logs.length, 0, 'журнал молчит');
}

// 2d. «Провалена» называется своим словом.
{
  const { call, logs } = makeNotice({ closed: closedMission('Провалена'), expect: { kind: 'plan' } });
  await call({ kind: 'plan' });
  assert.match(logs[0].t, /закрыта как «Провалена»/, 'провал не выдаётся за успех');
  assert.equal(logs[0].o.tone, 'warn', 'строка жёлтая');
}

// ── 3. Возврат миссии ──────────────────────────────────────────────────────
assert.match(src, /select: \{ equals: "Возвращена" \}/, '«Возвращена» считается активной миссией');
const remarkItems = sliceBetween('  const remarkItems = (text) =>', '  /** Последняя закрытая миссия');
const returnBlock = sliceBetween('  function returnBlock(mission) {', '  const taskTitle =');
{
  const fn = new Function(
    'isReturned', 'missionRemarks',
    `${remarkItems}\n${returnBlock}; return returnBlock;`,
  );
  const block = fn(
    () => true,
    () => '- smoke:dialogue-transitions зелёный\n- в «Итоге» нет раздела «Возврат»',
  )({ properties: { 'Возвращена': { date: { start: '2026-10-25' } } } });
  assert.match(block, /МИССИЯ ВОЗВРАЩЕНА МАСТЕРОМ 2026-10-25 НА ДОРАБОТКУ/, 'шапка блока');
  assert.match(block, /- smoke:dialogue-transitions зелёный/, 'замечания построчно');
  assert.match(block, /на каждое замечание — отдельная карточка/, 'правила возврата в промпте');
}
assert.match(src, /returnBlock\(mission\),/, 'блок попадает в план Координатора');

// У возвращённой миссии «done» без раздела «Возврат» не принимается.
assert.match(src, /returned && !\/возврат\/i\.test\(rt\(mission\.properties\["Итог"\]\)\)/, 'проверка раздела «Возврат»');
assert.match(src, /done-with-remarks/, 'это пауза с понятной причиной');
assert.match(src, /return-empty/, 'пустые замечания тоже пауза, а не молчаливый ход');

// ── 4. Плашка: одна строка вместо двух ─────────────────────────────────────
const plaqueFrom = src.indexOf('    let plaqueClosed = 0;');
const plaqueTo = src.indexOf('if (!editor) {', plaqueFrom);
const plaqueBlock = src.slice(plaqueFrom, plaqueTo);
assert.ok(plaqueFrom > 0 && plaqueTo > plaqueFrom, 'блок закрытия плашки на месте');
assert.equal(
  (plaqueBlock.match(/log\(/g) || []).length,
  1,
  'о плашке говорится одной строкой за шаг',
);
assert.match(plaqueBlock, /plaqueClosed \+= closed/, 'второе закрытие прибавляется к первому');
assert.match(plaqueBlock, /«задача выполнена»/, 'формулировка осталась прежней');

console.log('OK: narthex 1.4.43 — конец миссии зелёной строкой и пушем, возврат доработкой, плашка одной строкой');
