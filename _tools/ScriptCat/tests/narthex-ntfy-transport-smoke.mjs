// Структурная проба narthex.user.js: транспорт ntfy.sh.
//
// Регресс 1.4.0: тема и заголовок пуша уходили в HTTP-заголовках X-Title/X-Tags.
// Заголовки допускают только ISO-8859-1, поэтому кириллица отклонялась браузером
// ещё до отправки — «Тихий тест»/«Громкий тест» не делали ничего и молчали.
// Теперь публикация идёт JSON-телом на https://ntfy.sh/, а топик нормализуется
// (принимается и ссылка https://ntfy.sh/<топик>).

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const file = new URL('../narthex.user.js', import.meta.url);
const src = readFileSync(file, 'utf8');

// 1. В @connect есть ntfy.sh, версия поднята.
assert.match(src, /@connect\s+ntfy\.sh/, '@connect ntfy.sh');
assert.match(src, /@version\s+1\.4\.47/, 'версия 1.4.47');

// 2. В коде нет кириллицы в заголовках: X-Title/X-Priority/X-Tags не используются.
for (const header of ['X-Title', 'X-Tags', 'X-Priority']) {
  assert.ok(!src.includes(`"${header}"`), `заголовок ${header} больше не шлётся`);
}
assert.match(src, /Content-Type": "application\/json; charset=utf-8"/, 'тело уходит JSON (UTF-8 разрешён)');

// 3. Нормализация топика и публикация — вытаскиваем и проверяем поведение.
const start = src.indexOf('const NTFY_BASE =');
const end = src.indexOf('function notifyNtfy(');
assert.ok(start > 0 && end > start, 'блок транспорта найден');
const block = src.slice(start, end);

const load = (stubs = {}) =>
  new Function(
    'GM_xmlhttpRequest',
    'fetch',
    `${block}\nreturn { normalizeNtfyTopic, ntfyPublish, ntfyHealth };`,
  )(stubs.GM_xmlhttpRequest, stubs.fetch);

// 3.1. Старый топик Мастера проходит и в исходном виде, и ссылкой.
const { normalizeNtfyTopic } = load();
assert.equal(normalizeNtfyTopic('arena-creative36711'), 'arena-creative36711', 'простое имя');
assert.equal(normalizeNtfyTopic('  arena-creative36711 \n'), 'arena-creative36711', 'пробелы обрезаются');
assert.equal(normalizeNtfyTopic('https://ntfy.sh/arena-creative36711'), 'arena-creative36711', 'ссылка ntfy.sh');
assert.equal(normalizeNtfyTopic('https://ntfy.sh/arena-creative36711?x=1#y'), 'arena-creative36711', 'ссылка с query');
assert.equal(normalizeNtfyTopic('ntfy.sh/arena-creative36711'), 'arena-creative36711', 'имя с префиксом');
assert.equal(normalizeNtfyTopic('https://ntfy.sh/arena-creative36711/'), 'arena-creative36711', 'ссылка со слешем');
assert.equal(normalizeNtfyTopic(''), '', 'пусто — выключено');
assert.equal(normalizeNtfyTopic('плохой топик!'), '', 'недопустимые символы не уходят на сервер');

// 3.2. Успешная отправка: один POST через GM, JSON-тело, база ntfy.sh.
const posts = [];
const ok = load({
  GM_xmlhttpRequest: (opts) => {
    posts.push(opts);
    setTimeout(() => opts.onload({ status: 200, responseText: '{"id":"abc"}' }), 0);
  },
  fetch: async () => {
    throw new Error('fetch не должен вызываться, если GM сработал');
  },
});
const sent = await ok.ntfyPublish('https://ntfy.sh/arena-creative36711', '', {
  message: 'Тихий тест: привет, Мастер.',
  title: 'Narthex: тихий тест',
  priority: 2,
  tags: 'memo',
});
assert.equal(sent.via, 'gm', 'первый путь — GM_xmlhttpRequest');
assert.equal(posts.length, 1, 'ровно один запрос');
assert.equal(posts[0].method, 'POST', 'POST');
assert.equal(posts[0].url, 'https://ntfy.sh/', 'публикация JSON — на корень, топик в теле');
assert.equal(posts[0].headers.Authorization, undefined, 'без токена нет Authorization');
for (const value of Object.values(posts[0].headers)) {
  assert.ok(!/[^\x00-\x7F]/.test(String(value)), `в заголовке только ASCII: ${value}`);
}
const body = JSON.parse(posts[0].data);
assert.equal(body.topic, 'arena-creative36711', 'топик нормализован в теле');
assert.equal(body.title, 'Narthex: тихий тест', 'кириллический заголовок идёт в теле');
assert.equal(body.priority, 2, 'тихий приоритет');
assert.deepEqual(body.tags, ['memo'], 'теги массивом');

// 3.3. Отказ GM (например, нет @connect) — пробуем fetch, а не молчим.
let viaFetch = null;
const fallback = load({
  GM_xmlhttpRequest: (opts) => setTimeout(() => opts.onerror(), 0),
  fetch: async (url, init) => {
    viaFetch = { url, init };
    return { ok: true, status: 200, text: async () => '{}' };
  },
});
const second = await fallback.ntfyPublish('arena-creative36711', 'tk_1', { message: 'x', title: 'y', priority: 5 });
assert.equal(second.via, 'fetch', 'второй путь — fetch');
assert.equal(viaFetch.url, 'https://ntfy.sh/', 'fetch тоже на корень');
assert.equal(viaFetch.init.headers.Authorization, 'Bearer tk_1', 'токен уходит как Bearer');

// 3.4. Оба пути упали — в сообщении видны оба, а не пустая тишина.
const broken = load({
  GM_xmlhttpRequest: (opts) => setTimeout(() => opts.ontimeout(), 0),
  fetch: async () => ({ ok: false, status: 403, text: async () => 'forbidden' }),
});
await assert.rejects(
  () => broken.ntfyPublish('arena-creative36711', '', { message: 'x' }),
  (e) => /GM: таймаут/.test(e.message) && /fetch: HTTP 403/.test(e.message),
  'ошибка называет оба пути',
);

// 3.5. Пустой/битый топик — понятная ошибка, а не запрос на сервер.
let touched = false;
const empty = load({
  GM_xmlhttpRequest: () => { touched = true; },
  fetch: async () => { touched = true; return { ok: true, status: 200, text: async () => '{}' }; },
});
await assert.rejects(() => empty.ntfyPublish('плохой топик!', '', { message: 'x' }), /топик/i);
assert.equal(touched, false, 'при битом топике сеть не дёргается');

// 4. Диалог: тест берёт значение из поля (persist до отправки), а результат
// виден в самом диалоге — успех, HTTP-код или текст исключения.
const dialog = src.slice(src.indexOf('function ntfyDialog()'), src.indexOf('function inputStyle()'));
assert.match(dialog, /const test = async/, 'общий обработчик тестов');
assert.match(dialog, /const name = persist\(\);/, 'тест сохраняет и берёт топик из поля, а не только сохранённый');
assert.match(dialog, /Отправлено: \$\{result\.via/, 'успех виден в диалоге');
assert.match(dialog, /Не ушло: \$\{e\.message\}/, 'ошибка видна в диалоге');
assert.match(dialog, /cfn-ntfy-health/, 'есть «Проверка связи»');
assert.match(dialog, /cfn-ntfy-open/, 'есть «Открыть топик» — проверить, дошло ли сообщение');
assert.match(dialog, /const watchdog = setTimeout\(/, 'есть сторож: зависший запрос не молчит');
assert.match(dialog, /log\(`ntfy: \$\{label\} отправлен/, 'успех теста попадает в журнал');
assert.match(dialog, /log\(`ntfy: \$\{label\} не отправлен/, 'ошибка теста попадает в журнал');
assert.ok(!/catch\s*\(\s*\)\s*\{/.test(src), 'нет пустых catch, глотающих ошибку');

// 5. Обычные пуши используют тот же транспорт с нормализованным топиком.
const notify = src.slice(src.indexOf('function notifyNtfy('), src.indexOf('function notifyNtfy(') + 500);
assert.match(notify, /ntfyPublish\(/, 'notifyNtfy идёт через ntfyPublish');
assert.match(notify, /normalizeNtfyTopic\(topic\)/, 'битый сохранённый топик не ломает цикл');
assert.match(notify, /console\.warn/, 'ошибка пуша не роняет цикл, но след остаётся');
assert.match(notify, /log\(`ntfy: пуш не ушёл/, 'сбой обычного пуша виден в журнале панели');
assert.match(notify, /skip: true/, 'сбой пуша не порождает новый пуш');

console.log('OK: ntfy 1.4.47 — публикация JSON без кириллицы в заголовках, ссылка-топик, видимый результат тестов');
