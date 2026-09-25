/**
 * Смоук восьмого раунда фидбека, блок F — монолитный JSON кампании.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/feedback8-F-smoke.mts
 *
 *   F1 формат MonolithDoc и экспорт демо одним JSON
 *   F2 импорт: файл/текст, ink генерируется из .dlg.json
 *   F3 валидатор с автопочинкой (заглушки, отключение битого, отчёт по-русски)
 *   F4 JSON Schema в docs/campaign.schema.json (сгенерирована из types.ts)
 *   F5 гайд для ИИ docs/ai-campaign-guide.md
 */
import { readFileSync, existsSync } from 'node:fs'
import { Compiler } from 'inkjs/full'
import { EditorStore } from '../src/editor/store'
import { exportMonolith, importMonolith, importMonolithText, parseMonolith, repairMonolith } from '../src/editor/monolith'
import type { DlgDoc, MonolithDoc, NpcDef, RuleDef, SceneDef } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

/** глубокое сравнение через сортировку ключей */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val as object).sort().reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k]
          return acc
        }, {})
      : val,
  )
}

const base = 'http://localhost:5173/campaigns/ash-of-caerden'

// ── F1: экспорт демо одним JSON ──
const store = new EditorStore(base)
await store.load()
const { doc: doc0, warnings: exportWarns } = exportMonolith(store)
{
  check('F1 экспорт без потерь файлов', exportWarns.length === 0, exportWarns.join(' | '))
  const meta = doc0.campaign
  check('F1 кампания в JSON', meta.title === 'Пепел Каэрдена', meta.title)
  check('F1 мир в JSON', doc0.world.regions.length > 0)
  check('F1 сцены по id', Object.keys(doc0.scenes).length === store.manifest.scenes.length, String(Object.keys(doc0.scenes).length))
  check('F1 сущности по id', Object.keys(doc0.entities).length === store.manifest.entities.length, String(Object.keys(doc0.entities).length))
  check('F1 правила по id', Object.keys(doc0.rules).length === store.manifest.rules.length, String(Object.keys(doc0.rules).length))
  check('F1 квесты по id', Object.keys(doc0.quests).length === 4, String(Object.keys(doc0.quests).length))
  check('F1 арены по id', Object.keys(doc0.arenas).length === 5, String(Object.keys(doc0.arenas).length))
  check('F1 катсцены по id', Object.keys(doc0.cutscenes).length >= 1, String(Object.keys(doc0.cutscenes).length))
  check('F1 таблицы встреч в JSON', Object.keys(doc0.encounters ?? {}).length >= 1, String(Object.keys(doc0.encounters ?? {}).length))
  check('F1 диалоги в формате конструктора', Object.keys(doc0.dialogues).length === 6, Object.keys(doc0.dialogues).join(','))
  const maeva = doc0.dialogues['maeva']
  check('F1 диалог Маэвы — DlgDoc (не ink)', !!maeva && Array.isArray((maeva as DlgDoc).nodes))
  check('F1 в мире нет ссылок на файлы сцен (id)', JSON.stringify(doc0.world).includes('"scenes":['))
}

// ── F2: импорт в чистый стор, ink генерируется, roundtrip ──
const store2 = new EditorStore('/campaigns/imported')
const warns1 = importMonolith(store2, JSON.parse(JSON.stringify(doc0)))
{
  check('F2 импорт проходит', store2.meta.title === 'Пепел Каэрдена', store2.meta.title)
  check('F2 сцены расложены по файлам', store2.manifest.scenes.length === Object.keys(doc0.scenes).length)
  check('F2 манифест пересобран', store2.manifest.dialogues.length === 6, store2.manifest.dialogues.join(','))
  check('F2 ink сгенерирован из .dlg.json', store2.textFiles.get('dialogues/maeva.ink')?.includes('EXTERNAL') === true)
  check('F2 .dlg.json сохранены для конструктора', store2.jsonFiles.has('dialogues/maeva.dlg.json'))
  const ink = store2.textFiles.get('dialogues/maeva.ink') ?? ''
  const story = new Compiler(ink).Compile()
  check('F2 сгенерированный ink компилируется', !!story)
  check('F2 предупреждений импорта нет (чистый экспорт)', warns1.length === 0, warns1.join(' | '))
  check('F2 validateContent собранного пакета чист', store2.validateContent().length === 0, store2.validateContent().join(' | '))
  const { doc: doc1 } = exportMonolith(store2)
  // инвариант: экспорт(импорт(D)) == починенный D (repair идемпотентен)
  const { doc: doc0r } = repairMonolith(JSON.parse(JSON.stringify(doc0)))
  check('F2 roundtrip без потерь (экспорт → импорт → экспорт)', stable(doc1) === stable(doc0r))
}

// ── F3: автопочинка битого ──
{
  const broken = {
    campaign: { id: 'broken', title: 'Битая', default_player: 'player_ghost', starting_scene: 'scene_no' },
    world: { regions: [{ id: 'region_x', label: 'X', map_image: '', parent_region: null, locations: [
      { id: 'loc_a', label: 'A', position: { x: 0, y: 0 }, travel_connections: [{ to: 'loc_missing', cost_ticks: 1 }], scenes: ['scene_a', 'scene_gone'] },
    ] }] },
    scenes: {
      scene_a: {
        id: 'scene_a', label: 'Сцена А', location: 'loc_a',
        states: [],
        slots: [{ id: 'slot_1', type: ['person'], x: 0, y: 0, w: 10, h: 10, default_entity: 'npc_missing', condition: null }],
        navigation: [
          { label: 'В чужую', go_to_scene: 'scene_b', area: { x: 0, y: 0, w: 10, h: 10 } },
          { label: 'В никуда', go_to_scene: 'scene_nope', area: { x: 0, y: 0, w: 10, h: 10 } },
          { label: 'Старый формат', go_to_location: 'loc_a', area: { x: 0, y: 0, w: 10, h: 10 } },
        ],
      },
      scene_b: { id: 'scene_b', label: 'Сцена B', location: 'loc_b', states: [{ id: 's', label: 'S', image: '', condition: null }], slots: [], navigation: [] },
    },
    entities: {
      player_ghost: { id: 'player_ghost', type: 'npc', label: 'Игрок', portrait: {}, stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 }, skills: {}, inventory: [], equipment: {} },
    },
    rules: {
      rule_bad: {
        id: 'rule_bad', label: 'Правило с битыми ссылками', once: true,
        conditions: [{ type: 'player_enters_location', location: 'loc_missing2' }],
        effects: [
          { type: 'play_cutscene', cutscene: 'cutscene_missing' },
          { type: 'start_quest', quest: 'quest_missing' },
          { type: 'change_need', need: 'need_missing', delta: -1 },
        ],
      },
    },
    quests: { quest_empty: { id: 'quest_empty', label: 'Пустой квест', description: '', journal_entries: {}, stages: [] } },
    arenas: {}, cutscenes: {}, encounters: {},
    dialogues: {
      talk: {
        nodes: [
          { id: 'main', label: 'Начало', sections: [], choices: [{ text: 'Туда', sections: [], goto: 'nowhere' }] },
        ],
      },
      raw: '=== main ===\nПривет.\n-> DONE\n',
    },
  }
  const { doc, warnings } = repairMonolith(broken)
  check('F3 отчёт по-русски непустой', warnings.length >= 8, `предупреждений: ${warnings.length}`)
  check('F3 все предупреждения по-русски', warnings.every((w) => /[А-Яа-яЁё]/.test(w)))
  check('F3 заглушка сущности создана (слот)', !!doc.entities['npc_missing'], Object.keys(doc.entities).join(','))
  check('F3 заглушка сцены создана (список локации)', !!doc.scenes['scene_gone'])
  check('F3 заглушка локации создана (условие правила)', Object.values(doc.world.regions).some((r) => r.locations.some((l) => l.id === 'loc_missing2')))
  check('F3 заглушка катсцены создана', !!doc.cutscenes['cutscene_missing'])
  check('F3 заглушка квеста создана', !!doc.quests['quest_missing'])
  check('F3 действие на битую потребность отключено',
    !(doc.rules['rule_bad'] as RuleDef).effects.some((e) => e.type === 'change_need'))
  const sceneA = doc.scenes['scene_a'] as SceneDef
  check('F3 переход в чужую сцену → «открыть карту»', sceneA.navigation.some((n) => n.open_map && !n.go_to_scene))
  check('F3 переход в несуществующую сцену отключён', !sceneA.navigation.some((n) => n.go_to_scene === 'scene_nope'))
  check('F3 старый переход «в локацию» мигрирован', !('go_to_location' in sceneA.navigation[0] ?? {}))
  check('F3 пустому квесту добавлена стадия', doc.quests['quest_empty'].stages.length >= 1)
  check('F3 пустая сцена получила состояние', (doc.scenes['scene_a'] as SceneDef).states.length >= 1)
  const talk = doc.dialogues['talk'] as DlgDoc
  check('F3 битый goto в диалоге → end', talk.nodes[0].choices[0].goto === 'end')
  check('F3 «сырой» ink-диалог принят как есть', 'ink' in doc.dialogues['raw'])
  check('F3 версия диалога приведена к v2', talk.version === 2)
  check('F3 стартовая сцена восстановлена', !!doc.scenes[doc.campaign.starting_scene])

  // и импорт битого тоже не падает
  const s3 = new EditorStore('/campaigns/broken')
  const w3 = importMonolith(s3, broken)
  check('F3 импорт битого не падает и жалуется', w3.length >= 8, String(w3.length))
  check('F3 собранный пакет валиден после починки', s3.validateContent().length === 0, s3.validateContent().join(' | '))
}

// ── F3b: ошибки разбора текста ──
{
  let err = ''
  try {
    parseMonolith('это не json')
  } catch (e) {
    err = String(e)
  }
  check('F3 ошибка разбора — по-русски', err.includes('Не удалось разобрать JSON'), err)
}

// ── F4: JSON Schema ──
{
  check('F4 docs/campaign.schema.json существует', existsSync('docs/campaign.schema.json'))
  const schema = JSON.parse(readFileSync('docs/campaign.schema.json', 'utf8')) as {
    $defs: Record<string, { properties?: Record<string, unknown>; required?: string[] }>
  }
  const md = schema.$defs['MonolithDoc']
  check('F4 в схеме есть MonolithDoc', !!md)
  const need = ['campaign', 'world', 'scenes', 'entities', 'rules', 'quests', 'arenas', 'cutscenes', 'dialogues']
  check('F4 все разделы формата в схеме', need.every((k) => k in (md?.properties ?? {})), Object.keys(md?.properties ?? {}).join(','))
  check('F4 в схеме ArtDoc и примитивы', !!schema.$defs['ArtDoc'] && !!schema.$defs['ArtShape'])
  check('F4 в схеме CutsceneDef и DlgDoc', !!schema.$defs['CutsceneDef'] && !!schema.$defs['DlgDoc'])
  check('F4 в схеме MonolithDialogue (DlgDoc | сырой ink)', !!schema.$defs['MonolithDialogue'])
  const gen = readFileSync('scripts/gen-schema.mts', 'utf8')
  check('F4 схема генерируется из shared/types.ts', gen.includes("src/shared/types.ts") && gen.includes('MonolithDoc'))
}

// ── F5: гайд для ИИ ──
{
  check('F5 docs/ai-campaign-guide.md существует', existsSync('docs/ai-campaign-guide.md'))
  const g = readFileSync('docs/ai-campaign-guide.md', 'utf8')
  check('F5 гайд объясняет id-соглашения', g.includes('Соглашения по id'))
  check('F5 гайд объясняет ArtDoc и слоты по координатам', g.includes('ArtDoc') && g.includes('координатам'))
  check('F5 гайд объясняет катсцены и диалоги', g.includes('cutscenes') && g.includes('dialogues'))
  check('F5 в гайде есть токены диалогов', g.includes('{счёт:item_silver}') && g.includes('{здоровье}'))
  check('F5 в гайде есть минимальный полный пример', g.includes('Минимальный полный пример') && g.includes('"campaign"'))
  check('F5 гайд для ИИ без бинарников (требование блока F/H)', g.includes('без единого бинарного файла'))
}

// ── UI: кнопки редактора ──
{
  const app = readFileSync('src/editor/EditorApp.tsx', 'utf8')
  check('UI кнопка «Импорт из JSON»', app.includes('⬆ Импорт из JSON') && app.includes('doImportJson'))
  check('UI кнопка JSON-экспорта', app.includes('doExportJson'))
  check('UI отчёт «импортировано с N предупреждениями»', app.includes('Импортировано с'))
  const modals = readFileSync('src/shared/modals.tsx', 'utf8')
  check('UI askTextArea (файл ИЛИ вставленный текст)', modals.includes('askTextArea') && modals.includes('modal-textarea'))
  check('UI без браузерных prompt/confirm/alert', !/[^.\w](prompt|confirm|alert)\(/.test(app))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
