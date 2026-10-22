// Прогон одного разговора ink для tools/route_sim.py.
// stdin: {file, knot, state:{flags,items,party,disp,known,statuses}, choices:[подстроки], outcomes:[bool], present:"item_id"|null}
// stdout: {effects:[[fn,...args]], transcript:[...], offered:[[...]], error}
const {Compiler} = require('inkjs/full');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const inp = JSON.parse(fs.readFileSync(0, 'utf8'));
const src = fs.readFileSync(inp.file, 'utf8');
const cache = path.join('/tmp', 'route_ink_' + crypto.createHash('md5').update(src).digest('hex') + '.json');
let json;
if (fs.existsSync(cache)) json = fs.readFileSync(cache, 'utf8');
else { const c = new Compiler(src); json = c.Compile().ToJson(); fs.writeFileSync(cache, json); }
const {Story} = require('inkjs/full');
const story = new Story(json);
const S = inp.state; const effects = [], transcript = [], offered = [];
const outcomes = (inp.outcomes || []).slice();
const choices = (inp.choices || []).slice();
let pending = null, error = null;
const has = (i) => (S.items[i] || 0) > 0;
const B = (f) => story.BindExternalFunction(f[0], f[1], false);
[
  ['get_flag', (f) => S.flags.includes(f)],
  ['has_item', (i) => has(i)],
  ['item_count', (i) => S.items[i] || 0],
  ['in_party', (n) => S.party.includes(n)],
  ['get_disposition', (n) => S.disp[n] || 0],
  ['npc_known', (n) => S.known.includes(n)],
  ['has_status', (s) => S.statuses.includes(s)],
  ['skill_check', (sk, dc) => { const r = outcomes.length ? outcomes.shift() : true; effects.push(['skill_check', sk, dc, r]); return r; }],
  ['present_item', (ok, fail, item) => {
      const p = inp.present || item; const good = p && has(p) && (!item || p === item);
      effects.push(['present_item', p, good]); pending = good ? ok : fail; }],
  ['set_flag', (f) => { if (!S.flags.includes(f)) S.flags.push(f); effects.push(['set_flag', f]); }],
  ['clear_flag', (f) => { S.flags = S.flags.filter(x => x !== f); effects.push(['clear_flag', f]); }],
  ['add_item', (i, q) => { S.items[i] = (S.items[i] || 0) + q; effects.push(['add_item', i, q]); }],
  ['remove_item', (i, q) => { S.items[i] = (S.items[i] || 0) - q; if (S.items[i] < 0) error = error || ('remove_item ниже нуля: ' + i); effects.push(['remove_item', i, q]); }],
  ['change_disposition', (n, d) => { S.disp[n] = (S.disp[n] || 0) + d; effects.push(['change_disposition', n, d]); }],
  ['join_party', (n) => { if (!S.party.includes(n)) S.party.push(n); effects.push(['join_party', n]); }],
  ['leave_party', (n) => { S.party = S.party.filter(x => x !== n); effects.push(['leave_party', n]); }],
  ['learn_name', (n) => { if (!S.known.includes(n)) S.known.push(n); effects.push(['learn_name', n]); }],
  ['apply_status', (s) => { if (!S.statuses.includes(s)) S.statuses.push(s); effects.push(['apply_status', s]); }],
  ['remove_status', (s) => { S.statuses = S.statuses.filter(x => x !== s); effects.push(['remove_status', s]); }],
].forEach(B);
for (const fn of ['fire_rule', 'unlock_recipe', 'unlock_codex', 'advance_time', 'open_trade', 'set_description', 'set_entity_state',
                  'set_dialogue_timer', 'change_hp', 'change_companion_need'])
  story.BindExternalFunction(fn, (...a) => { effects.push([fn, ...a]); }, false);
try {
  story.ChoosePathString(inp.knot || 'Начало');
  for (let guard = 0; guard < 200; guard++) {
    while (story.canContinue) { const t = story.Continue().trim(); if (t) transcript.push(t); }
    if (story.currentChoices.length) {
      const opts = story.currentChoices.map(c => c.text);
      offered.push(opts);
      if (!choices.length) break;
      const want = choices.shift();
      const idx = opts.findIndex(o => o.includes(want));
      if (idx < 0) { error = 'нет опции «' + want + '» среди: ' + JSON.stringify(opts); break; }
      transcript.push('> ' + opts[idx]);
      story.ChooseChoiceIndex(idx);
      continue;
    }
    if (pending) { const k = pending; pending = null; story.ChoosePathString(k); continue; }
    break;
  }
  if (!error && choices.length) error = 'разговор закончился, не выбраны: ' + JSON.stringify(choices);
} catch (e) { error = 'ink: ' + (e.message || e); }
process.stdout.write(JSON.stringify({effects, transcript, offered, error}));
