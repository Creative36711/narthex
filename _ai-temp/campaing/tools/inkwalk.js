#!/usr/bin/env node
// Проверка диалогов: компиляция ink + обход всех ветвей.
// Ловит служебные строки («true», «0») и ошибки времени исполнения.
//
// Запуск: node tools/inkwalk.js
// Требует inkjs:  npm i inkjs   (в каталоге /home/user/.tools или любом другом;
//                 путь можно передать первым аргументом)
const fs = require('fs');
const path = require('path');

let modPath = process.argv[2];
if (!modPath) {
  const cands = ['/home/user/.tools/node_modules/inkjs/dist/ink-full.js',
                 '/home/user/node_modules/inkjs/dist/ink-full.js'];
  modPath = cands.find((p) => fs.existsSync(p));
}
if (!modPath || !fs.existsSync(modPath)) {
  console.log('ПРОПУСК: не найден inkjs. Установите: npm i inkjs');
  process.exit(0);
}
const inkjs = require(modPath);
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'dialogues');

let bad = 0;
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.ink')).sort()) {
  const full = path.join(DIR, file);
  const text = fs.readFileSync(full, 'utf8');
  const c = new inkjs.Compiler(text);
  let story = null;
  try { story = c.Compile(); } catch (e) { }
  const errs = (c.errors || []).filter(Boolean);
  const warns = (c.warnings || []).filter(Boolean);
  if (warns.length) console.log(`WARN ${file}: ${warns.join(' | ')}`);
  if (errs.length || !story) {
    bad++;
    console.log(`ОШИБКА ${file}: ${errs.join(' | ') || 'не скомпилировалось'}`);
    continue;
  }
  const externals = [...text.matchAll(/EXTERNAL\s+([a-z_0-9]+)/g)].map((m) => m[1]);
  const knots = [...text.matchAll(/^===\s*([^\s=]+)/gm)].map((m) => m[1]);
  const noise = new Set();

  const run = (start, seed) => {
    const s = new inkjs.Story(story.ToJson());
    let st = seed >>> 0;
    const rnd = () => ((st = (st * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (const e of externals) {
      s.BindExternalFunction(e, function () {
        return /roll|check/.test(e) ? (rnd() > 0.4 ? 1 : 0) : 0;
      });
    }
    s.allowExternalFunctionFallbacks = true;
    s.onError = (m) => noise.add('ОШИБКА ВРЕМЕНИ ИСПОЛНЕНИЯ: ' + m);
    s.ChoosePathString(start);
    const out = [];
    try {
      for (let i = 0; i < 60; i++) {
        while (s.canContinue) out.push(s.Continue().trim());
        if (s.currentChoices.length) s.ChooseChoiceIndex(Math.floor(rnd() * s.currentChoices.length));
        else break;
      }
    } catch (e) { noise.add('ИСКЛЮЧЕНИЕ: ' + e.message); }
    return out;
  };

  for (const k of knots) {
    for (const seed of [1, 7, 99, 12345]) {
      for (const line of run(k, seed)) {
        if (/^(true|false|-?\d+)$/.test(line)) noise.add(`служебная строка в ${k}: «${line}»`);
        if (/^(EXTERNAL|VAR|~)/.test(line)) noise.add(`код в тексте в ${k}: «${line}»`);
      }
    }
  }
  if (noise.size) {
    bad++;
    console.log(`ОШИБКА ${file}:\n  ${[...noise].join('\n  ')}`);
  } else {
    console.log(`ок ${file}: узлов ${knots.length}, внешних ${externals.length}`);
  }
}
console.log(bad ? `\nпроблемных диалогов: ${bad}` : '\nвсе диалоги в порядке');
process.exit(bad ? 1 : 0);
