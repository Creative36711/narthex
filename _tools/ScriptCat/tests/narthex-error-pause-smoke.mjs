/**
 * Структурная проба narthex.user.js 1.4.19: журнал, пауза, маркеры, ntfy.
 *
 * Проверяет инварианты, которые легко потерять при правке транспорта:
 *  - журнал ограничен и очищается кнопкой;
 *  - ответ без маркера даёт напоминание, а после лимита — паузу;
 *  - любая видимая ошибка Arena останавливает цикл и ждёт Мастера;
 *  - тихие и громкие пуши разделены, рутина в ntfy не уходит.
 *
 *   node _tools/ScriptCat/tests/narthex-error-pause-smoke.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// 1. Версия и новый адрес ntfy.
assert.match(src, /@version\s+1\.4\.82/, 'версия 1.4.82');
assert.match(src, /@connect\s+ntfy\.sh/, 'ntfy.sh разрешён в @connect');

// 2. Журнал: ограничен, очищается, счётчик виден.
assert.match(src, /maxLog:\s*200/, 'журнал ограничен 200 записями');
assert.match(src, /entries\s*=\s*entries\.slice\(-C\.maxLog\)/, 'старые записи отбрасываются при записи');
assert.match(src, /GM_getValue\(K\.log, \[\]\) \|\| \[\]\)\.slice\(-C\.maxLog\)/, 'хвост обрезается при загрузке');
assert.match(src, /function clearLog\(\)/, 'есть очистка журнала');
assert.match(src, /GM_setValue\(K\.log, \[\]\)/, 'очистка стирает сохранённый хвост');
assert.match(src, /title="Очистить журнал/, 'кнопка очистки есть в панели');
assert.match(src, /title="Сбросить очередь и ожидание прошлых попыток/, 'кнопка сброса состояния есть в панели');
assert.match(src, /id="\$\{ui\.count\}"/, 'в панели виден размер журнала');

// 3. Пауза — единственная точка остановки.
const pauseFn = src.slice(src.indexOf('function pause('), src.indexOf('function resume('));
assert.match(pauseFn, /GM_setValue\(K\.paused, info\.reason\)/, 'причина паузы видна в статусе');
assert.match(pauseFn, /GM_setValue\(K\.pause, info\)/, 'контекст паузы переживает перезагрузку');
assert.match(pauseFn, /priority: "5"/, 'пауза всегда громкая');
assert.match(pauseFn, /playAlert\(\)/, 'пауза дублируется звуком в браузере');
assert.match(src, /wasAuto: autoOn\(\)/, 'пауза помнит режим, чтобы не включать автоцикл молча');

// 4. Тик: сначала ошибка на экране, потом шаг; пауза не обходится.
const tickStart = src.indexOf('async function tick(');
const tickEnd = src.indexOf('// ───────────────────────────── старт', tickStart);
const tick = src.slice(tickStart, tickEnd);
assert.match(tick, /if \(isPaused\(\)\) \{/, 'пауза блокирует тик');
assert.match(tick, /if \(monitorVisibleErrors\(\)\) return;/, 'ошибка проверяется до любого шага');
assert.ok(tick.indexOf('monitorVisibleErrors') < tick.indexOf('await setup(false)'), 'проверка ошибки идёт первой');
assert.match(tick, /pause\(\s*`Цикл остановлен\. /, 'любое исключение превращается в паузу, а не в тихую запись');
assert.match(tick, /Технически: \$\{raw\}/, 'техническая строка сохраняется для разбора');
assert.doesNotMatch(tick, /Ошибка цикла: \$\{e\.message\}/, 'нечитаемой строки «Ошибка цикла: HTTP 400» больше нет');

// 5. Ошибки на экране: оба источника и защита от повторной паузы.
const monitor = src.slice(src.indexOf('function monitorVisibleErrors()'), src.indexOf('// ───────────────────────────── отправка'));
assert.ok(monitor.length > 0, 'монитор ошибок на месте');
assert.match(monitor, /latestUserMessageAlert\(\)/, 'алерт в последнем сообщении ловится');
assert.match(monitor, /detectVisibleErrorCard\(\)/, 'красная карточка интерфейса ловится');
assert.match(monitor, /alreadyReported\(key\)/, 'одна и та же ошибка не ставит паузу дважды');
assert.equal((monitor.match(/pause\(/g) || []).length, 3, 'алерт (повтор исчерпан и обычный) и красная карточка останавливают цикл');
assert.match(monitor, /Arena второй раз не приняла задание/, 'второй отказ подряд назван причиной паузы');
assert.ok(!monitor.includes('.click('), 'монитор ошибок ничего не нажимает');

// 6. Лестница маркера: напоминание, затем пауза.
const stepSrc = src.slice(src.indexOf('function markerStep('), src.indexOf('function markerReminder('));
const markerStep = new Function(`${stepSrc}\nreturn markerStep;`)();
assert.equal(markerStep(0, 2), 'remind', 'первый ответ без маркера — напоминание');
assert.equal(markerStep(1, 2), 'remind', 'второй ответ — ещё напоминание');
assert.equal(markerStep(2, 2), 'pause', 'после лимита — пауза');
assert.equal(markerStep(3, 2), 'pause', 'лимит не превышается молча');

assert.match(src, /markerIdleMs:\s*20000/, 'напоминание ждёт, пока ответ перестанет расти');
assert.match(src, /markerReminders:\s*2/, 'лимит напоминаний — два');
// 1.4.78: перед лестницей маркера проверяется отказ из-за слитой ветки —
// напоминания в мёртвую ветку ушли бы в никуда.
assert.match(
  src,
  /if \(!hit\) \{[\s\S]{0,1200}?return markerMissing\(role, expect, "CF_AGENT_RESULT", manual\);/,
  'исполнитель без маркера доходит до лестницы после проверки отказа pr_merged',
);
assert.match(src, /staleBranchRefusal\(lastReply\.raw\)/, 'отказ «ветка слита» распознаётся по тексту');
assert.match(src, /retryStaleBranchHandoff\(expect\)/, 'после отказа — одна повторная выдача в чистую ветку');
assert.match(src, /if \(!decision\) return markerMissing\(role, expect, "CF_COORDINATOR_RESULT", manual\)/, 'Координатор без маркера идёт в ту же лестницу');
assert.ok(!src.includes('Координатор ответил без маркера — ждём следующего хода'), 'старая тихая реакция удалена');
const missingFn = src.slice(src.indexOf('async function markerMissing('), src.indexOf('// ───────────────────────── ошибка на экране'));
assert.match(missingFn, /sendToRole\(role, markerReminder/, 'напоминание содержит шаблон маркера');
assert.match(missingFn, /pause\(/, 'после лимита — пауза для Мастера');
assert.match(missingFn, /tries/, 'счётчик попыток хранится в ожидании');
assert.match(src, /const watermark = lastMessageId\(\);/, 'водяной знак снимается на странице адресата до отправки');
assert.match(src, /watermark, sentAt: Date\.now\(\)/, 'отметка ставится после успешной доставки');

// 7. Классификатор ntfy: тихо / громко / молча.
const ntfyStart = src.indexOf('const QUIET_NTFY = [');
const ntfyEnd = src.indexOf('function notifyNtfy(', ntfyStart);
const classifyNtfy = new Function(`${src.slice(ntfyStart, ntfyEnd)}\nreturn classifyNtfy;`)();
assert.equal(classifyNtfy('Проверяю роль и очередь…', false), null, 'рутина не уходит в ntfy');
assert.equal(classifyNtfy('Выдан ход Kernel: «NAR-1.3».', false)?.priority, '2', 'выдача хода — тихий пуш');
assert.equal(classifyNtfy('Ответ Kernel записан, PR слит, задача → Submitted.', false)?.priority, '2', 'Submitted — тихий пуш');
assert.equal(classifyNtfy('Пауза снята Мастером (кнопка «Продолжить»). Продолжаю.', false)?.priority, '2', 'снятие паузы — тихий пуш');
assert.equal(classifyNtfy('Ошибка цикла: HTTP 502', true)?.priority, '5', 'ошибка — громкий пуш');
assert.equal(classifyNtfy('ПАУЗА: агент молчит', true)?.priority, '5', 'пауза — громкий пуш');
assert.equal(classifyNtfy('Ответ без маркера', true, { ntfy: 'quiet' })?.priority, '2', 'напоминание о маркере не будит ночью');

// 8. Панель: кнопки очистки и ntfy, без автоперезагрузки страницы.
assert.match(src, /ui\.ntfy\), onclick|getElementById\(ui\.ntfy\)\.onclick/, 'есть кнопка настроек ntfy');
assert.match(src, /function ntfyDialog\(\)/, 'диалог ntfy с тестами');
assert.match(src, /Тихий тест/, 'тихий тест доступен из панели');
assert.match(src, /Громкий тест/, 'громкий тест доступен из панели');
// 1.4.63: перезагрузка страницы появилась ровно в одном месте — адресат
// открылся, но не отрисовался. Видимая ошибка на экране страницу не трогает.
const reloadSites = src.split('\n').filter((line) => line.includes('location.reload()'));
assert.equal(reloadSites.length, 1, 'перезагрузка страницы ровно одна');
const blankGuard = src.slice(
  src.indexOf('        if (!page.ok) {'),
  src.indexOf('        const observed = Number(expect.readyAt)'),
);
assert.ok(
  blankGuard.includes('location.reload()'),
  'перезагружается только неотрисованная страница адресата, а не видимая ошибка',
);

console.log('OK: narthex 1.4.63 — журнал чистится, маркер напоминается, ошибка ставит паузу и ждёт Мастера');
