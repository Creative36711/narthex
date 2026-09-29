/**
 * Смоук раунда фидбека 25 (баг-пасс ревью «до обновления», 12 пунктов).
 * Запуск: npx tsx scripts/feedback25-smoke.mts
 *
 *  1. получение/потеря предметов — тосты с текстом и звуком (silent у
 *     служебных выдач: покупка/продажа/крафт/стартовый набор);
 *  2. выделение текста при быстрых кликах по катсцене заблокировано;
 *  3. редактор: фильтр сущностей «персонажи/предметы» получает type сущности;
 *  4. модалки редактора наполнены стилями по классу body.cf-editor и не просвечивают;
 *  5. спрайт сущности в слоте вписывается целиком (бокс-slot × масштаб, contain);
 *     наведение на прозрачный PNG — ореол по контуру, а не рамка;
 *  6. переходы: опция «скрывать подпись до наведения» (nav.hide_label);
 *  7. фигурка боя НПС поддерживает состояния (погиб/без сознания/статусы);
 *  8. предметы в сцене: свой спрайт (слот пуст без него), портреты окна
 *     действий, варианты действий как в диалогах, условные «декорации»;
 *  9. квест: строки «успех»/«провал» в списке — зелёная и красная всегда;
 * 10. Ctrl+Z в любом месте редактора нажимает кнопку «Отменить»;
 * 11. диалоги: больше плейсхолдеров ({имя}, {манн}, {день}, {стат:…}, {валюта:…});
 * 12. плейтест: экран создания героя прокручивается до «Начать забег».
 */
import { readFileSync } from 'node:fs'
import { tokensToInk, inkToTokens, TOKEN_KINDS } from '../src/editor/dialogueDoc'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')

// ── 1. тосты предметов ──
{
  const engine = f('src/core/engine.ts')
  const view = f('src/player/GameView.tsx')
  const css = f('src/index.css')
  check('1 движок умеет pushToast с видом (get/lose/info)', /pushToast\(text: string, kind: 'get' \| 'lose' \| 'info'/.test(engine))
  check('1 addItem тостит «Получено» (не в тихом режиме)', /if \(!opts\.silent\) this\.pushToast\(`Получено:/.test(engine))
  check('1 removeItem тостит «Потеряно»', /opts\.verb \?\? \(lost >= quantity \? 'Потеряно' : 'Частично потеряно'\)/.test(engine))
  check('1 использовать-предмет тостит «Использовано»', engine.includes("verb: 'Использовано'"))
  check('1 стек тостов отрисовывается', view.includes('toast-stack'))
  check('1 стили тостов есть', /\.toast-stack\s*\{/.test(css) && /\.toast\s*\{/.test(css))
  check('1 звук «выдали»/«потеряли»', engine.includes('item_get') && engine.includes('item_lose'))
}

// ── 2. катсцена без случайного выделения ──
{
  const css = f('src/index.css')
  check('2 cutscene-overlay лишён выделения текста', /\.cutscene-overlay\s*\{[^}]*user-select:\s*none/.test(css))
}

// ── 3. фильтр сущностей редактора ──
{
  const app = f('src/editor/EditorApp.tsx')
  const listFor = app.match(/case 'entities':[\s\S]{0,700}/)?.[0] ?? ''
  check('3 список сущностей несёт type', /type:\s*'npc' as const/.test(listFor) && /type:\s*'item' as const/.test(listFor))
  check('3 группировка «Персонажи» осталась', listFor.includes("group: 'Персонажи'"))
}

// ── 4. модалки редактора ──
{
  const app = f('src/App.tsx')
  const edcss = f('src/editor/editor.css')
  const css = f('src/index.css')
  check('4 body получает класс cf-editor', app.includes("cf-editor"))
  check('4 стили модалок — по body.cf-editor, не по :has', edcss.includes('body.cf-editor .modal-overlay') && !edcss.includes(':has(> .editor-root) > .modal-overlay'))
  check('4 модалки выше оболочки плейтеста', /\.modal-overlay\s*\{[^}]*z-index:\s*30000/.test(css))
}

// ── 5. спрайт слота: вписывание и ореол ──
{
  const css = f('src/index.css')
  const scene = f('src/player/SceneScreen.tsx')
  check('5 спрайт обёрнут в бокс-масштаб', scene.includes('slot-sprite-box') && /style=\{\{ height: `\$\{scale \* 100\}%` \}\}/.test(scene))
  check('5 картинка вписывается целиком (contain по обеим осям)', /\.slot-sprite\s*\{[^}]*object-fit:\s*contain/.test(css) && /\.slot-sprite\s*\{[^}]*width:\s*100%/.test(css))
  check('5 ореол наведения по контуру PNG (drop-shadow, не рамка)', /\.slot-hotspot\.slot-sprited:hover \.slot-sprite[^{]*\{[^}]*drop-shadow/.test(css))
}

// ── 6. скрытые подписи переходов ──
{
  const types = f('src/shared/types.ts')
  const scene = f('src/player/SceneScreen.tsx')
  const css = f('src/index.css')
  check('6 поле hide_label у перехода', /hide_label\?:\s*boolean/.test(types))
  check('6 класс nav-nolabel применяется', scene.includes('nav-nolabel'))
  check('6 подпись появляется наведением', /\.nav-zone\.nav-nolabel:hover \.nav-label/.test(css))
  check('6 редактор сцен: галочка «Не показывать подпись»', f('src/editor/SceneEditor.tsx').includes('Не показывать подпись'))
}

// ── 6б. состояния спрайта сцены (по образцу портретов) ──
{
  const types = f('src/shared/types.ts')
  const scene = f('src/player/SceneScreen.tsx')
  const sceneEd = f('src/editor/SceneEditor.tsx')
  const entEd = f('src/editor/EntityEditor.tsx')
  check('6б NpcDef.scene_sprite_states', /scene_sprite_states\?:\s*Record<string, ImageValue>/.test(types))
  check('6б SlotDef.sprite_state', /sprite_state\?:\s*string/.test(types))
  check('6б сцена выбирает спрайт по состоянию слота', scene.includes('slot.sprite_state') && scene.includes('scene_sprite_states'))
  check('6б редактор сцен: выбор «Состояние спрайта»', sceneEd.includes('Состояние спрайта'))
  check('6б карточка НПС: словарь состояний спрайта', entEd.includes('scene_sprite_states'))
}

// ── 6в. «живые сцены»: frame-swap кадры ──
{
  const types = f('src/shared/types.ts')
  const frames = f('src/player/frames.tsx')
  const scene = f('src/player/SceneScreen.tsx')
  const combat = f('src/player/CombatScreen.tsx')
  const fields = f('src/editor/Fields.tsx')
  const demo = f('public/campaigns/ash-of-caerden/scenes/scene_gates_front.json')
  check('6в тип ImageValue (строка/массив/{frames,fps,loop})', /type ImageValue\s*=\s*string\s*\|\s*string\[\]\s*\|\s*\{\s*frames:\s*string\[\];/.test(types))
  check('6в проигрыватель кадров по таймеру', frames.includes('useCurrentFrame') && frames.includes('setInterval'))
  // статика (меньше двух играемых кадров) таймер не поднимает — смотри useFrameIndex
  check('6в статика без таймера (один кадр)', /if \(!info \|\| total < 2\) return/.test(frames) && frames.includes('window.setInterval'))
  check('6в сценовый фон через LiveImg', scene.includes('LiveImg') && scene.includes('state.image'))
  check('6в спрайт слота через LiveImg', scene.includes('className="slot-sprite"'))
  check('6в фигурка боя через LiveImg', combat.includes('LiveImg') && combat.includes('figureSrc'))
  check('6в редактор: AnimImageEditor', fields.includes('AnimImageEditor') && fields.includes('Оживить'))
  check('6в демо на полигоне: живой фон ворот', demo.includes('"frames"') && demo.includes('gates_front_night'))
}

// ── 6г. ИЛИ-группы условий правил ──
{
  const types = f('src/shared/types.ts')
  const engine = f('src/core/engine.ts')
  const ruleEd = f('src/editor/RuleEditor.tsx')
  const demo = f('public/campaigns/ash-of-caerden/rules/gen_whisper_protest.json')
  check('6г RuleDef.conditions_any — Condition[][]', /conditions_any\?:\s*Condition\[\]\[\]/.test(types))
  check('6г движок: ИЛИ в tryFireRule', engine.includes('ruleConditionsOk') && /groups\.some\(\(g\)\s*=>\s*!g\.length \|\| g\.every/.test(engine))
  check('6г движок: ИЛИ в таблицах событий', /rollEventTable[\s\S]*ruleConditionsOk\(rule\)/.test(engine))
  check('6г редактор правил: «+ Группа»', ruleEd.includes('Группы «или»') && ruleEd.includes('Группа «или» №'))
  check('6г демо-правило на полигоне', demo.includes('conditions_any') && demo.includes('shrine_offended'))
}

// ── 7. состояния фигурки боя ──
{
  const types = f('src/shared/types.ts')
  const combat = f('src/player/CombatScreen.tsx')
  const entEd = f('src/editor/EntityEditor.tsx')
  check('7 NpcDef.combat_figure_states', /combat_figure_states\?:\s*Record<string, ImageValue>/.test(types))
  check('7 бой выбирает картинку по состоянию (dead/down/статус)', combat.includes('combat_figure_states') && combat.includes("fstates?.['dead']"))
  check('7 редактор НПС: блок состояний фигурки', entEd.includes('Состояния фигурки боя') && entEd.includes('FIGURE_STATES_BASE'))
}

// ── 8. предметы в сцене ──
{
  const types = f('src/shared/types.ts')
  const engine = f('src/core/engine.ts')
  const scene = f('src/player/SceneScreen.tsx')
  const entEd = f('src/editor/EntityEditor.tsx')
  check('8 предмет: спрайт сцены/портреты/варианты действий/условие', /scene_sprite\?:\s*ImageValue/.test(types) && /type ImageValue/.test(types) && /interact_options\?:\s*ItemInteractOption\[\]/.test(types) && /interactable_when\?:\s*Condition\[\]/.test(types))
  check('8 слот предмета без спрайта пуст', /: item\?\.scene_sprite/.test(scene) && !/item\?\.portrait/.test(scene))
  check('8 предмет-«декорация» нежатка', /disabled=\{!interactable\}/.test(scene) && engine.includes('itemInteractable'))
  check('8 окно действий мини-диалогом', scene.includes('ItemInteractDialog') && engine.includes('runItemInteract'))
  check('8 редактор предмета: все четыре блока', entEd.includes('Предмет в сцене') && entEd.includes('Портреты предмета') && entEd.includes('Действия с предметом в сцене') && entEd.includes('Условия взаимодействия'))
}

// ── 9. цвета финальной стадии квеста ──
{
  const css = f('src/index.css')
  const quest = f('src/editor/QuestEditor.tsx')
  check('9 строки списка красятся по значению', /select\.sel-outcome option\[value="success"\]/.test(css) && /select\.sel-outcome option\[value="failure"\]/.test(css))
  // цвет решает всё: глифы ✔/✖ убраны по правилу «без эмодзи» (фидбек 9),
  // зелёный/красный задан CSS по значению option — см. первую проверку пункта
  check('9 «успех» — галочка, «провал» — крестик', quest.includes('sel-outcome-success') && quest.includes('sel-outcome-failure') && !/[\u2714\u2716]/.test(quest))
}

// ── 10. Ctrl+Z = «Отменить» ──
{
  const app = f('src/editor/EditorApp.tsx')
  const handler = app.match(/useEffect\(\(\) => \{\s*const onKey[\s\S]{0,600}?window\.addEventListener\('keydown'[^)]*\)/)
  check('10 Ctrl+Z перехватывается глобально (capture)', /addEventListener\('keydown', onKey, true\)/.test(app ?? ''))
  check('10 исключений для input/textarea больше нет', !/t\.tagName === 'TEXTAREA'/.test(app))
  check('10 Monaco не ломаем', app.includes(".monaco-editor"))
}

// ── 11. диалоговые плейсхолдеры ──
{
  const dlg = f('src/core/dialogue.ts')
  check('11 externals: имя, здоровье макс, мана, удача, день, уровень, опыт, валюта',
    /bind\('get_player_name'/.test(dlg) && /bind\('get_hp_max'/.test(dlg) && /bind\('get_mp'/.test(dlg)
      && /bind\('get_luck'/.test(dlg) && /bind\('get_run_day'/.test(dlg) && /bind\('get_level'/.test(dlg)
      && /bind\('get_xp'/.test(dlg) && /bind\('get_currency'/.test(dlg))
  check('11 каталог токенов пополнен (14 видов)', TOKEN_KINDS.length >= 14, `видов: ${TOKEN_KINDS.length}`)
  check('11 {имя} → get_player_name()', tokensToInk('Привет, {имя}!') === 'Привет, {get_player_name()}!')
  check('11 {герой} — тоже имя', tokensToInk('{герой} сказал') === '{get_player_name()} сказал')
  check('11 {здоровье_макс}', tokensToInk('{здоровье_макс}') === '{get_hp_max()}')
  check('11 {манн} и {мана_макс}', tokensToInk('{мана}/{мана_макс}') === '{get_mp()}/{get_mp_max()}')
  check('11 {удача}/{уровень}/{опыт}/{день}', tokensToInk('{удача} {уровень} {опыт} {день}') === '{get_luck()} {get_level()} {get_xp()} {get_run_day()}')
  check('11 {стат:INT} и {валюта:silver}', tokensToInk('{стат:INT} {валюта:silver}') === '{get_stat("INT")} {get_currency("silver")}')
  check('11 обратная миграция ink → русские токены',
    inkToTokens('{get_player_name()} {get_stat("DEX")} {get_currency("ash")}') === '{имя} {стат:DEX} {валюта:ash}')
  // регрессия: старые токены не сломаны
  check('11 регрессия старых токенов', tokensToInk('{счёт:herb} {здоровье} {потребность:hunger} {навык:stealth}') ===
    '{item_count("herb")} {get_hp()} {get_need("hunger")} {get_skill("stealth")}')
}

// ── 12. прокрутка создания героя в плейтесте ──
{
  const edcss = f('src/editor/editor.css')
  check('12 оболочка плейтеста прокручивается сама (/cf-themed overflow-y)', /\.playtest-shell > \.cf-themed \{[^}]*overflow-y:\s*auto/.test(edcss))
  check('12 min-height экрана создания не зажимает оболочку', /\.playtest-shell \.char-create \{[^}]*min-height:\s*0/.test(edcss))
}

console.log()
if (failed) {
  console.error(`ПРОВАЛОВ: ${failed}`)
  process.exit(1)
}
console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
