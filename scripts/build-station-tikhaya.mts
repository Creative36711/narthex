/**
 * Сборка кампании «Станция „Тихая“» — накигэ / эмоциональная драма, 30–60 мин.
 * Пишет Campaign Package так же, как редактор (JSON-модули + dlg→ink),
 * через dev-эндпоинт /__editor/save или прямо на диск.
 *
 * Запуск: npx tsx scripts/build-station-tikhaya.mts
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateInk } from '../src/editor/dialogueDoc'
import type { DlgDoc } from '../src/shared/types'
import { ENGINE_VERSION, PACKAGE_FORMAT } from '../src/shared/versions'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ID = 'station_tikhaya'
const out = join(root, 'public/campaigns', ID)

function art(bg: string, layers: unknown[]): { canvas: { w: number; h: number }; background: string; layers: unknown[] } {
  return { canvas: { w: 1280, h: 720 }, background: bg, layers }
}
function rect(label: string, x: number, y: number, w: number, h: number, fill: string, opacity = 1) {
  return { label, shape: { type: 'rect', x, y, w, h, fill, opacity } }
}
function ellipse(label: string, cx: number, cy: number, rx: number, ry: number, fill: string, opacity = 1) {
  return { label, shape: { type: 'ellipse', cx, cy, rx, ry, fill, opacity } }
}
function poly(label: string, points: number[], fill: string, opacity = 1) {
  return { label, shape: { type: 'polygon', points, fill, opacity } }
}
function line(label: string, x1: number, y1: number, x2: number, y2: number, color: string, width = 2) {
  return { label, shape: { type: 'line', x1, y1, x2, y2, color, width } }
}

/** тёплая осенняя станция */
const artPlatformDay = art('#1a1410', [
  rect('небо', 0, 0, 1280, 420, { gradient: { from: '#2a1e28', to: '#c4784a', angle: 90 } }),
  ellipse('солнце', 980, 360, 70, 50, '#ffb070', 0.55),
  poly('даль', [0, 380, 200, 320, 480, 350, 720, 300, 1000, 340, 1280, 310, 1280, 480, 0, 480], '#3a2a22', 0.95),
  rect('перрон', 0, 480, 1280, 240, { gradient: { from: '#4a3a30', to: '#2a2018', angle: 90 } }),
  rect('рельс1', 0, 560, 1280, 8, '#1a1510'),
  rect('рельс2', 0, 590, 1280, 8, '#1a1510'),
  rect('шпала', 80, 555, 40, 50, '#3a2820', 0.7),
  rect('шпала', 200, 555, 40, 50, '#3a2820', 0.7),
  rect('шпала', 360, 555, 40, 50, '#3a2820', 0.7),
  rect('шпала', 520, 555, 40, 50, '#3a2820', 0.7),
  rect('шпала', 700, 555, 40, 50, '#3a2820', 0.7),
  rect('шпала', 900, 555, 40, 50, '#3a2820', 0.7),
  rect('шпала', 1100, 555, 40, 50, '#3a2820', 0.7),
  rect('навес', 40, 200, 520, 18, '#2a2018'),
  rect('столб1', 60, 218, 18, 280, '#2a2018'),
  rect('столб2', 520, 218, 18, 280, '#2a2018'),
  rect('скамья', 120, 460, 200, 28, '#5a4030'),
  rect('здание', 700, 260, 380, 240, '#3a2c28'),
  rect('окно1', 740, 320, 80, 70, '#c9a060', 0.7),
  rect('окно2', 860, 320, 80, 70, '#c9a060', 0.55),
  rect('окно3', 980, 320, 60, 70, '#8a7060', 0.4),
  rect('дверь', 820, 400, 70, 100, '#1a1210'),
  poly('листва', [0, 200, 40, 160, 80, 200, 60, 240], '#8a5030', 0.8),
  ellipse('фонарь', 280, 250, 12, 18, '#e8c070', 0.9),
])

const artPlatformNight = art('#0a0c12', [
  rect('небо', 0, 0, 1280, 420, { gradient: { from: '#0a0c14', to: '#1a2030', angle: 90 } }),
  ellipse('луна', 200, 100, 40, 40, '#d0d8e8', 0.85),
  ...Array.from({ length: 18 }, (_, i) =>
    ellipse('з', 80 + i * 70, 40 + (i % 5) * 30, 1.5, 1.5, '#e8eef8', 0.4 + (i % 3) * 0.2),
  ),
  rect('перрон', 0, 480, 1280, 240, '#1a1820'),
  rect('рельс1', 0, 560, 1280, 8, '#0a080c'),
  rect('рельс2', 0, 590, 1280, 8, '#0a080c'),
  rect('навес', 40, 200, 520, 18, '#121018'),
  rect('столб1', 60, 218, 18, 280, '#121018'),
  rect('столб2', 520, 218, 18, 280, '#121018'),
  ellipse('светфонаря', 280, 280, 90, 60, '#e8c070', 0.15),
  ellipse('фонарь', 280, 250, 12, 18, '#ffe8a0', 0.95),
  rect('здание', 700, 260, 380, 240, '#1a1520'),
  rect('окно1', 740, 320, 80, 70, '#e8b050', 0.85),
  rect('окно2', 860, 320, 80, 70, '#e8b050', 0.5),
  rect('поезд', 0, 500, 420, 90, '#1e2430', 0.95),
  rect('окнапоезда', 40, 520, 50, 30, '#c9e0ff', 0.6),
  rect('окнапоезда', 120, 520, 50, 30, '#c9e0ff', 0.6),
  rect('окнапоезда', 200, 520, 50, 30, '#c9e0ff', 0.5),
  rect('окнапоезда', 280, 520, 50, 30, '#c9e0ff', 0.55),
])

const artWaiting = art('#1c1814', [
  rect('пол', 0, 500, 1280, 220, '#3a3028'),
  rect('стена', 0, 0, 1280, 500, { gradient: { from: '#2a241e', to: '#3a322a', angle: 90 } }),
  rect('скамьядлинная', 80, 420, 700, 50, '#4a3830'),
  rect('окнобольшое', 900, 80, 280, 280, '#6a8090', 0.35),
  rect('рама', 900, 80, 280, 12, '#2a2018'),
  rect('рама2', 900, 348, 280, 12, '#2a2018'),
  rect('стойка', 200, 300, 180, 200, '#3a2c24'),
  rect('автомат', 480, 280, 100, 200, '#2a3038'),
  ellipse('лампа', 640, 60, 80, 20, '#e8c890', 0.4),
  rect('расписание', 40, 80, 140, 220, '#1a2030'),
])

const artCafe = art('#1a120e', [
  rect('пол', 0, 520, 1280, 200, '#3a2820'),
  rect('стена', 0, 0, 1280, 520, { gradient: { from: '#2a1a14', to: '#3a2818', angle: 90 } }),
  rect('бар', 80, 380, 560, 140, '#4a3020'),
  rect('столешница', 80, 360, 560, 30, '#6a4830'),
  rect('окноулица', 800, 80, 380, 280, '#c4784a', 0.25),
  ellipse('лампочка', 300, 120, 20, 28, '#ffe0a0', 0.9),
  ellipse('лампочка', 500, 120, 20, 28, '#ffe0a0', 0.85),
  rect('стол1', 900, 480, 140, 80, '#5a4030'),
  rect('стол2', 1080, 500, 120, 70, '#5a4030'),
  rect('полка', 100, 200, 400, 20, '#3a2818'),
  rect('чашка', 250, 340, 30, 20, '#e8d8c0'),
])

const artHome = art('#1a1410', [
  rect('пол', 0, 560, 1280, 160, '#3a2a20'),
  rect('стена', 0, 0, 1280, 560, { gradient: { from: '#2a2018', to: '#3a3028', angle: 90 } }),
  rect('окно', 900, 80, 260, 280, '#a07050', 0.3),
  rect('занавеска', 900, 80, 40, 280, '#8a6050', 0.7),
  rect('стол', 200, 420, 320, 120, '#5a4030'),
  rect('скатерть', 210, 420, 300, 16, '#c0a080', 0.6),
  ellipse('лампастола', 360, 380, 50, 20, '#e8c070', 0.5),
  rect('кресло', 700, 400, 140, 160, '#4a3028'),
  rect('полка', 40, 100, 200, 280, '#3a2820'),
  rect('фото', 80, 140, 60, 70, '#e8d8c0'),
  rect('дверь', 1100, 360, 90, 200, '#2a1a14'),
])

const artBridge = art('#141820', [
  rect('небо', 0, 0, 1280, 400, { gradient: { from: '#1a2030', to: '#4a5868', angle: 90 } }),
  poly('река', [0, 500, 1280, 480, 1280, 720, 0, 720], { gradient: { from: '#2a4050', to: '#1a2830', angle: 90 } }),
  rect('мост', 0, 380, 1280, 40, '#3a3a40'),
  rect('перила', 0, 360, 1280, 8, '#5a5a60'),
  ...Array.from({ length: 12 }, (_, i) => rect('стойка', 40 + i * 100, 320, 8, 50, '#5a5a60')),
  rect('путьвнизу', 200, 560, 880, 12, '#1a1510'),
  ellipse('фонарьмоста', 640, 300, 16, 22, '#e8d0a0', 0.9),
  ellipse('свет', 640, 340, 120, 40, '#e8d0a0', 0.12),
  poly('берег', [0, 480, 200, 520, 0, 560], '#2a3020'),
])

function slot(
  id: string,
  label: string,
  type: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Record<string, unknown> = {},
) {
  return { id, label, type, shape: 'rect', x, y, w, h, condition: null, ...extra }
}

function npc(
  id: string,
  label: string,
  description: string,
  dialogue: string | undefined,
  opts: Record<string, unknown> = {},
) {
  return {
    id,
    type: 'npc',
    label,
    description,
    portrait: { neutral: '', soft: '', hurt: '', warm: '' },
    stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 12, POW: 12, CHA: 12 },
    skills: { persuade: 40, spot: 35, stealth: 20 },
    inventory: [],
    equipment: {},
    slot_type: 'person',
    schedule: [],
    base_disposition: 10,
    dialogue,
    ...opts,
  }
}

function item(id: string, label: string, description: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'item',
    category: extra.category ?? 'misc',
    label,
    description,
    weight: extra.weight ?? 0.2,
    stackable: extra.stackable ?? false,
    ...extra,
  }
}

function dlg(
  label: string,
  nodes: DlgDoc['nodes'],
): DlgDoc {
  return { version: 2, label, nodes }
}

function lineStep(text: string, emotion?: string, effects?: unknown[]) {
  const steps: unknown[] = []
  if (effects) for (const e of effects) steps.push({ kind: 'effect', effect: e })
  steps.push({ kind: 'line', line: { text, ...(emotion ? { emotion } : {}) } })
  return steps
}

// ── dialogues ──
const dlgLena = dlg('Лена, кафе на станции', [
  {
    id: 'main',
    label: 'Начало',
    sections: [
      {
        conds: [{ type: 'flag', flag: 'met_lena' }],
        steps: lineStep('Снова ты. Чай ещё горячий — если не убежал на перрон.', 'soft') as never,
        else_steps: [
          { kind: 'effect', effect: { type: 'set_flag', flag: 'met_lena' } },
          { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_lena', delta: 5 } },
          { kind: 'line', line: { text: '…{имя}. Ты всё-таки приехал. Я думала — только на похороны и сразу обратно.', emotion: 'hurt' } },
          { kind: 'line', line: { text: 'Садись. Чай по старым ценам. Разговор — бесплатно, если честный.', emotion: 'soft' } },
        ],
      },
    ],
    choices: [
      {
        text: 'Мне жаль, что так вышло. Правда жаль.',
        conds: [{ type: 'flag', flag: 'lena_apology', not: true }],
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'lena_apology' } },
              { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_lena', delta: 15 } },
              { kind: 'effect', effect: { type: 'change_need', need: 'need_grief', delta: -8 } },
              { kind: 'line', line: { text: 'Она молчит дольше, чем удобно. Потом кивает — коротко, будто ставит печать.', emotion: 'soft' } },
              { kind: 'line', line: { text: 'Жаль — это слово дешёвое. Но ты хотя бы произнёс его вслух. Спасибо.', emotion: 'warm' } },
            ],
          },
        ],
        goto: 'stay',
      },
      {
        text: 'Помнишь наш мост? Можно сходить.',
        conds: [{ type: 'flag', flag: 'lena_bridge_invite', not: true }],
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'lena_bridge_invite' } },
              { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_lena', delta: 8 } },
              { kind: 'line', line: { text: 'Мост… Там всё ещё скрипит перила. Я иногда хожу, когда смена кончается.', emotion: 'soft' } },
              { kind: 'line', line: { text: 'Если дойдёшь — буду. Не обещаю, что будет легко.', emotion: 'neutral' } },
            ],
          },
        ],
        goto: 'stay',
      },
      {
        text: 'Поедем вместе. Последний поезд — не приговор.',
        conds: [
          { type: 'flag', flag: 'lena_apology' },
          { type: 'disp_ge', target: 'npc_lena', value: 40 },
        ],
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'lena_will_go' } },
              { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_lena', delta: 20 } },
              { kind: 'effect', effect: { type: 'fire_rule', rule: 'rule_lena_warm' } },
              { kind: 'line', line: { text: 'Ты серьёзно? После стольких лет — «поедем»?', emotion: 'warm' } },
              { kind: 'line', line: { text: '…Хорошо. Сумку соберу. Если передумаешь на перроне — я пойму. Но скажи сразу.', emotion: 'warm' } },
            ],
          },
        ],
        goto: 'end',
      },
      {
        text: 'Мне нужно время. Я ещё вернусь до отправления.',
        sections: [
          {
            steps: [
              { kind: 'line', line: { text: 'Времени у нас ровно столько, сколько до гудка. Не больше.', emotion: 'soft' } },
            ],
          },
        ],
        goto: 'end',
      },
      {
        text: 'Просто посидеть. Без разговоров.',
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'change_need', need: 'need_warmth', delta: 12 } },
              { kind: 'effect', effect: { type: 'change_need', need: 'need_grief', delta: -5 } },
              { kind: 'effect', effect: { type: 'advance_time', ticks: 1 } },
              { kind: 'line', line: { text: 'Она наливает чай. Молчание не пустое — оно как одеяло, которое наконец разрешили надеть.', emotion: 'warm' } },
            ],
          },
        ],
        goto: 'end',
      },
    ],
  },
])

const dlgMother = dlg('Мать', [
  {
    id: 'main',
    label: 'Дома',
    sections: [
      {
        conds: [{ type: 'flag', flag: 'met_mother' }],
        steps: lineStep('Ты опять ходишь по кругу. Садись, суп ещё тёплый.', 'soft') as never,
        else_steps: [
          { kind: 'effect', effect: { type: 'set_flag', flag: 'met_mother' } },
          { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_mother', delta: 5 } },
          { kind: 'line', line: { text: 'Ну вот. Приехал. Я знала по шагам на крыльце — чужие бы так не скрипели.', emotion: 'soft' } },
          { kind: 'line', line: { text: 'Отец… Он ждал письма. Не звонка — письма. Ты так и не написал.', emotion: 'hurt' } },
        ],
      },
    ],
    choices: [
      {
        text: 'Я должен был быть здесь. Прости.',
        conds: [{ type: 'flag', flag: 'mother_forgiven', not: true }],
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'mother_forgiven' } },
              { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_mother', delta: 25 } },
              { kind: 'effect', effect: { type: 'change_need', need: 'need_grief', delta: -15 } },
              { kind: 'effect', effect: { type: 'fire_rule', rule: 'rule_mother_warm' } },
              { kind: 'line', line: { text: 'Она вытирает руки о фартук — жест из детства, когда не знала, куда деть слова.', emotion: 'hurt' } },
              { kind: 'line', line: { text: 'Прощать умею. Забыть — нет. Но раз ты здесь… останься хотя бы на чай. Настоящий.', emotion: 'warm' } },
            ],
          },
        ],
        goto: 'stay',
      },
      {
        text: 'Расскажи, как он… в последние дни.',
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'heard_father' } },
              { kind: 'effect', effect: { type: 'change_need', need: 'need_grief', delta: 5 } },
              { kind: 'effect', effect: { type: 'unlock_codex', entry: 'codex_father' } },
              { kind: 'line', line: { text: 'Спал мало. Слушал радио. Спрашивал, не идёт ли поезд с юга — будто ждал не письма, а тебя живьём.', emotion: 'soft' } },
              { kind: 'line', line: { text: 'Перед тишиной сказал: «Пусть не винит себя. Станция никого не держит силой».', emotion: 'warm' } },
            ],
          },
        ],
        goto: 'stay',
      },
      {
        text: 'Я могу остаться. Не на день — по-настоящему.',
        conds: [{ type: 'flag', flag: 'mother_forgiven' }],
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'promise_stay_mother' } },
              { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_mother', delta: 15 } },
              { kind: 'line', line: { text: 'Не обещай на бегу. Поезд не прощает громких слов. Если останешься — останься. Если нет — напиши хоть раз.', emotion: 'soft' } },
            ],
          },
        ],
        goto: 'end',
      },
      {
        text: 'Мне пора. Я ещё зайду.',
        sections: [{ steps: lineStep('Дверь за тобой не хлопает. Она просто тихо закрывается — как всегда.', 'neutral') as never }],
        goto: 'end',
      },
    ],
  },
])

const dlgBoris = dlg('Борис, старый друг', [
  {
    id: 'main',
    label: 'На мосту',
    sections: [
      {
        conds: [{ type: 'flag', flag: 'met_boris' }],
        steps: lineStep('Куришь? Я уж бросил. Почти.', 'soft') as never,
        else_steps: [
          { kind: 'effect', effect: { type: 'set_flag', flag: 'met_boris' } },
          { kind: 'line', line: { text: 'Смотри кто явился. Столица тебя не съела — значит, ещё живой.', emotion: 'warm' } },
          { kind: 'line', line: { text: 'Я тут каждый вечер. Мост помнит нас лучше, чем мы сами.', emotion: 'soft' } },
        ],
      },
    ],
    choices: [
      {
        text: 'Как ты… всё это время?',
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'boris_story' } },
              { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_boris', delta: 10 } },
              { kind: 'line', line: { text: 'Работаю на сортировке. Жена уехала в область. Дочка пишет иногда. Нормальная жизнь — только тихая.', emotion: 'soft' } },
              { kind: 'line', line: { text: 'А ты бегал от тишины. Теперь она догнала. Не обижайся — я без злости.', emotion: 'neutral' } },
            ],
          },
        ],
        goto: 'stay',
      },
      {
        text: 'Лена всё ещё здесь. Ты с ней…',
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'boris_about_lena' } },
              { kind: 'line', line: { text: 'Она не ждала. Просто жила. Это другое. Не ломай ей вечер геройством.', emotion: 'soft' } },
              { kind: 'line', line: { text: 'Если скажешь правду — она услышит. Если спектакль — почувствует.', emotion: 'neutral' } },
            ],
          },
        ],
        goto: 'stay',
      },
      {
        text: 'Посоветуй. Остаться или уехать?',
        check: {
          skill: 'persuade',
          difficulty: 45,
          success: {
            sections: [
              {
                steps: [
                  { kind: 'effect', effect: { type: 'set_flag', flag: 'boris_advice_good' } },
                  { kind: 'effect', effect: { type: 'change_need', need: 'need_grief', delta: -10 } },
                  { kind: 'line', line: { text: 'Остаться — не значит сдаться. Уехать — не значит предать. Смотри, кого ты предаёшь, когда выбираешь.', emotion: 'warm' } },
                ],
              },
            ],
            goto: 'end',
          },
          fail: {
            sections: [
              {
                steps: [
                  { kind: 'line', line: { text: 'Брат, я не оракул. Я просто стою на мосту и курю то, чего нет.', emotion: 'soft' } },
                ],
              },
            ],
            goto: 'end',
          },
        },
        sections: [],
        goto: 'end',
      },
      {
        text: 'Пойду. Спасибо, что ждал.',
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'change_disposition', target: 'npc_boris', delta: 5 } },
              { kind: 'line', line: { text: 'Я никого не ждал. Просто здесь ветрено — и видно поезда.', emotion: 'warm' } },
            ],
          },
        ],
        goto: 'end',
      },
    ],
  },
])

const dlgConductor = dlg('Проводник последнего поезда', [
  {
    id: 'main',
    label: 'Поезд',
    sections: [
      {
        steps: [
          { kind: 'line', line: { text: 'Билеты. Последний на юг сегодня. Дальше — только утренний, через десять часов тишины.', emotion: 'neutral' } },
        ],
      },
    ],
    choices: [
      {
        text: 'Уезжаю. Один.',
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'boarded_alone' } },
              { kind: 'effect', effect: { type: 'fire_rule', rule: 'rule_ending_leave' } },
              { kind: 'line', line: { text: 'Вагон пахнет железом и чьим-то одеколоном. Окно отражает станцию — всё меньше.', emotion: 'soft' } },
            ],
          },
        ],
        goto: 'end',
      },
      {
        text: 'Мы вдвоём. (Лена рядом)',
        conds: [{ type: 'flag', flag: 'lena_will_go' }],
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'boarded_with_lena' } },
              { kind: 'effect', effect: { type: 'fire_rule', rule: 'rule_ending_together' } },
              { kind: 'line', line: { text: 'Она держит сумку двумя руками. Пальцы белые. Но смотрит не назад — вперёд.', emotion: 'warm' } },
            ],
          },
        ],
        goto: 'end',
      },
      {
        text: 'Я передумал. Остаюсь.',
        sections: [
          {
            steps: [
              { kind: 'effect', effect: { type: 'set_flag', flag: 'refused_train' } },
              { kind: 'effect', effect: { type: 'fire_rule', rule: 'rule_ending_stay' } },
              { kind: 'line', line: { text: 'Проводник кивает, будто слышал это сто раз. Поезд всё равно уйдёт. Ты — нет.', emotion: 'soft' } },
            ],
          },
        ],
        goto: 'end',
      },
      {
        text: 'Ещё не сейчас. Сколько минут?',
        sections: [
          {
            steps: [
              { kind: 'line', line: { text: 'Сколько успеешь наговорить правды. Гудок — и разговор кончится без тебя.', emotion: 'neutral' } },
            ],
          },
        ],
        goto: 'end',
      },
    ],
  },
])

const dlgLetter = dlg('Письмо отца', [
  {
    id: 'main',
    label: 'Конверт',
    sections: [
      {
        steps: [
          { kind: 'effect', effect: { type: 'set_flag', flag: 'read_letter' } },
          { kind: 'effect', effect: { type: 'change_need', need: 'need_grief', delta: 8 } },
          { kind: 'effect', effect: { type: 'unlock_codex', entry: 'codex_letter' } },
          { kind: 'line', line: { text: 'Почерк дрожит к концу страницы. «Не торопись доказывать миру, что уехал. Докажи себе, что умеешь возвращаться».' } },
          { kind: 'line', line: { text: 'Внизу — адрес станции. Будто он знал, что письмо найдут именно здесь.' } },
        ],
      },
    ],
    choices: [{ text: 'Сложить письмо.', sections: [], goto: 'end' }],
  },
])

const dlgPhoto = dlg('Старое фото', [
  {
    id: 'main',
    label: 'Снимок',
    sections: [
      {
        steps: [
          { kind: 'effect', effect: { type: 'set_flag', flag: 'saw_photo' } },
          { kind: 'effect', effect: { type: 'change_need', need: 'need_grief', delta: 4 } },
          { kind: 'line', line: { text: 'Трое на мосту: ты, Лена, Борис. Лето, которое казалось бесконечным. У Лены в волосах листок.' } },
        ],
      },
    ],
    choices: [{ text: 'Убрать фото.', sections: [], goto: 'end' }],
  },
])

// ── design doc ──
const designDoc = `# Станция «Тихая» — гейм-дизайнерский документ

## 1. Паспорт

- **Название:** Станция «Тихая»
- **Жанр и тон:** эмоциональная драма (накигэ); тёплая горечь, осень, прощение без пафоса.
- **Объём:** сцен — 6, персонажей — 4 (+герой), квестов — 2, концовок — 4. Забег 30–60 минут.
- **Ключевая идея:** герой не «спасает город» — он решает, умеет ли возвращаться. Последний поезд — дедлайн чувств, не квест на билет.

## 2. Завязка и мир

- Отец умер. Герой приезжает в родной пристанционный посёлок на одни сутки.
- Место: станция «Тихая», кафе, дом, мост над путями. Время — поздняя осень, вечер до ночного поезда.
- Герой хочет «закрыть» прошлое и уехать. Мешают недосказанность с матерью, Леной и собственная вина.
- Давление: отправление последнего поезда (игровые часы), шкала горя и тепла.

## 3. Главы

| Глава | Что происходит | Сцены |
| --- | --- | --- |
| 1. Прибытие | Перрон, письмо, знакомство с тишиной | Перрон, Зал ожидания |
| 2. Люди | Разговоры с Леной, матерью, Борисом | Кафе, Дом, Мост |
| 3. Поезд | Выбор: уехать одному, вдвоём, остаться | Ночной перрон |

## 4. Сцены

| Название | Место | Роль | Что можно сделать |
| --- | --- | --- | --- |
| Перрон | Станция | Старт, дедлайн | Письмо, к залу, к поезду ночью |
| Зал ожидания | Станция | Переход, фото | К кафе, домой, на мост |
| Кафе | Станция | Лена | Разговор, извинение, приглашение |
| Дом | Посёлок | Мать | Прощение, рассказ об отце |
| Мост | Окраина | Борис, память | Совет, правда о Лене |
| Ночной перрон | Станция | Финал | Проводник / выбор |

## 5. Персонажи

| Имя | Хочет | Знает | Где | Настроения |
| --- | --- | --- | --- | --- |
| Лена | Не быть «остановкой» в чужой ностальгии | Всё про уход героя | Кафе | hurt / soft / warm |
| Мать | Услышать живого сына | Последние дни отца | Дом | hurt / warm |
| Борис | Честности без театра | Как живёт Лена | Мост | soft / warm |
| Проводник | Отправить поезд вовремя | Расписание | Ночной перрон | neutral |

## 6. Квесты и концовки

| Квест | Ход | Успех | Провал | Даёт |
| --- | --- | --- | --- | --- |
| Домой | Поговорить с матерью, прочитать письмо | mother_forgiven + read_letter | Уехать без разговора | Журнал, тепло |
| Лена | Извиниться, доверие | lena_apology + disposition | Игнор | Ветка «вдвоём» |

- **Концовки:** «Остаюсь»; «Уезжаю один»; «Уезжаем с Леной»; «Поезд ушёл» (время вышло без выбора).
- **Хроника:** запоминаются увиденные концовки (endings_seen).

## 7. Какие механики задействованы

- диалоги с условиями флагов и отношения (disposition);
- потребности «Горе» и «Тепло» (давление настроения, не голод);
- катсцена-пролог; баннеры о времени поезда;
- кодекс (отец, письмо); смена облика (set_entity_state);
- концовки с условиями; без боя и крафта.

## 8. Рамки баланса

- Старт ~17:00, поезд в 22:00 (5 часов / тиков).
- Горе растёт медленно от времени; тепло падает; разговоры лечат.
- Убеждение у Бориса ~45%; отношение Лены для совместного отъезда ≥40 после извинения.

## 9. Что пока нельзя сделать в движке

- Таймер на реплику в диалоге (обошли игровыми часами и гудком).
- Совместный «уход НПС со станции» как катсцена-спутника в вагоне (флаг + концовка).
- Раздельный саундтрек на каждую эмоцию реплики без ручных треков.

## 10. Журнал решений

| Итер. | Решение | Почему |
| --- | --- | --- |
| 1 | Накигэ без боя, 6 сцен, 4 концовки | Жанр — разговор и выбор, не бой |
| 1 | Потребности grief/warmth | Эмоциональное давление вместо голода |
| 1 | Профиль historical | Сепия, «письмо и чернила» |
| 1 | ArtDoc без PNG | Кампания сразу играбельна |

## 11. Приложение «Соответствие разделам JSON»

| Раздел | Имена |
| --- | --- |
| Сцены | scene_platform, scene_waiting, scene_cafe, scene_home, scene_bridge, scene_platform_night |
| НПС | npc_lena, npc_mother, npc_boris, npc_conductor |
| Квесты | quest_homecoming, quest_lena |
| Концовки | ending_stay, ending_leave, ending_together, ending_missed |
| Правила | rule_intro, rule_train_warn, rule_train_gone, rule_ending_* |
`

// ── campaign meta ──
const campaign = {
  id: ID,
  title: 'Станция «Тихая»',
  version: '1.0.0',
  engine_version: ENGINE_VERSION,
  min_engine: ENGINE_VERSION,
  package_format: PACKAGE_FORMAT,
  author: 'Chronicle Forge — editor playtest',
  description:
    'Накигэ на одну ночь: вы возвращаетесь на родную станцию к похоронам отца. Последний поезд уходит в десять. Успеете ли сказать то, что молчали годами?',
  design_doc: designDoc,
  tick_label: 'час',
  ticks_per_day: 24,
  time_of_day: { morning: 6, day: 10, evening: 17, night: 21 },
  starting_region: 'region_station',
  starting_location: 'loc_station',
  starting_scene: 'scene_platform',
  starting_tick: 17,
  default_player: 'player_hero',
  max_companions: 0,
  theme: {
    profile: 'historical',
    atmosphere: true,
  },
  skills: [
    { id: 'persuade', label: 'Убеждение', category: 'social', base: 25 },
    { id: 'spot', label: 'Наблюдательность', category: 'perception', base: 30 },
    { id: 'stealth', label: 'Скрытность', category: 'physical', base: 15 },
    { id: 'brawl', label: 'Кулачный бой', category: 'physical', base: 15 },
    { id: 'dodge', label: 'Уклонение', category: 'physical', base: 20 },
    { id: 'first_aid', label: 'Первая помощь', category: 'knowledge', base: 20 },
  ],
  skill_categories: [
    { id: 'social', label: 'Общение' },
    { id: 'perception', label: 'Восприятие' },
    { id: 'physical', label: 'Тело' },
    { id: 'knowledge', label: 'Знания' },
  ],
  needs: [
    {
      // «Горе»: шкала наполнена = тяжело. Стартуем на ~40 через правило intro
      // (needs всегда max при старте — снижаем change_need). Растёт restore_per_tick.
      id: 'need_grief',
      label: 'Горе',
      max: 100,
      decay_per_tick: 0,
      restore_per_tick: 2,
      critical_threshold: 90,
      on_zero_effect: undefined,
    },
    {
      id: 'need_warmth',
      label: 'Тепло',
      max: 100,
      decay_per_tick: 3,
      critical_threshold: 12,
    },
  ],
  item_categories: [
    { id: 'food', label: 'Еда', restores_needs: ['need_warmth'] },
    { id: 'drink', label: 'Питьё', restores_needs: ['need_warmth'] },
    { id: 'quest', label: 'Память' },
    { id: 'misc', label: 'Разное' },
    { id: 'currency', label: 'Валюта' },
  ],
  currencies: [{ id: 'silver', label: 'Монеты', symbol: 'м', item_id: 'item_coin' }],
  factions: [],
  flags: [
    { id: 'met_lena', label: 'Встретил Лену' },
    { id: 'met_mother', label: 'Поговорил с матерью' },
    { id: 'met_boris', label: 'Встретил Бориса' },
    { id: 'lena_apology', label: 'Извинился перед Леной' },
    { id: 'lena_bridge_invite', label: 'Пригласил Лену на мост' },
    { id: 'lena_will_go', label: 'Лена готова ехать' },
    { id: 'mother_forgiven', label: 'Мать приняла слова' },
    { id: 'heard_father', label: 'Услышал про последние дни отца' },
    { id: 'promise_stay_mother', label: 'Пообещал матери остаться' },
    { id: 'read_letter', label: 'Прочитано письмо отца' },
    { id: 'saw_photo', label: 'Увидел старое фото' },
    { id: 'boris_story', label: 'Борис рассказал о себе' },
    { id: 'boris_about_lena', label: 'Борис сказал про Лену' },
    { id: 'boris_advice_good', label: 'Совет Бориса (успех)' },
    { id: 'train_warned', label: 'Предупреждение о поезде' },
    { id: 'boarded_alone', label: 'Уехал один' },
    { id: 'boarded_with_lena', label: 'Уехал с Леной' },
    { id: 'refused_train', label: 'Остался на станции' },
    { id: 'missed_train', label: 'Опоздал к поезду' },
  ],
  emotions: [
    { id: 'neutral', label: 'Обычный' },
    { id: 'soft', label: 'Мягкий' },
    { id: 'hurt', label: 'Раненый' },
    { id: 'warm', label: 'Тёплый' },
  ],
  slot_types: [
    { id: 'person', label: 'Человек' },
    { id: 'item', label: 'Предмет' },
    { id: 'prop', label: 'Объект' },
  ],
  chapters: [
    { id: 'chapter_arrive', label: 'Прибытие', order: 1 },
    { id: 'chapter_people', label: 'Люди', order: 2 },
    { id: 'chapter_train', label: 'Поезд', order: 3 },
  ],
  endings: [
    {
      id: 'ending_stay',
      label: 'Остаюсь',
      title: 'Тишина принимает',
      text: 'Поезд уходит без вас. На перроне пахнет мокрыми листьями и чьим-то чаем из окна кафе. Мать не спрашивает «надолго ли». Лена кивает — коротко. Вы остались не потому что не смогли уехать, а потому что впервые захотели быть здесь.',
      tone: 'victory',
      on: 'victory',
      conditions: [{ type: 'flag_set', flag: 'refused_train' }],
    },
    {
      id: 'ending_together',
      label: 'Вдвоём',
      title: 'Два билета',
      text: 'Стучат стыки. Лена спит, прислонившись к плечу, или только притворяется — чтобы не видеть, как станция тает. В сумке письмо отца. Вы не «убежали» — вы увезли с собой право вернуться.',
      tone: 'victory',
      on: 'victory',
      conditions: [{ type: 'flag_set', flag: 'boarded_with_lena' }],
    },
    {
      id: 'ending_leave',
      label: 'Один',
      title: 'Один вагон',
      text: 'Город за окном — чёрные силуэты. Вы сказали не всё. Или сказали — и этого хватило, чтобы уехать честно. Станция «Тихая» остаётся точкой на карте и теплом, которое можно носить без адреса.',
      tone: 'neutral',
      on: 'victory',
      conditions: [{ type: 'flag_set', flag: 'boarded_alone' }],
    },
    {
      id: 'ending_missed',
      label: 'Поезд ушёл',
      title: 'Гудок в пустую',
      text: 'Вы опоздали к выбору. Состав уже точка света в поле. Иногда жизнь решает за вас — и это тоже ответ. Утро будет длинным. И, может быть, честнее ночи.',
      tone: 'neutral',
      on: 'victory',
      conditions: [{ type: 'flag_set', flag: 'missed_train' }],
    },
  ],
  music_tracks: [
    {
      id: 'music_station',
      label: 'Станция вечером',
      loop: true,
      volume: 0.45,
      src: {
        mood: 'спокойная',
        tempo: 72,
        key: 'A',
        scale: 'минор',
        seed: 1107,
        progression: ['i', 'VI', 'III', 'VII'],
        layers: ['пад-аккорды', 'арпеджио'],
      },
    },
    {
      id: 'music_night',
      label: 'Ночной перрон',
      loop: true,
      volume: 0.4,
      src: {
        mood: 'тревожная',
        tempo: 64,
        key: 'D',
        scale: 'минор',
        seed: 2210,
        progression: ['i', 'iv', 'VII', 'i'],
        layers: ['арпеджио', 'бас'],
      },
    },
  ],
  ui_sounds: {},
  roguelike: { permadeath: false, meta_progress: [], randomize_on_restart: [] },
}

const world = {
  regions: [
    {
      id: 'region_station',
      label: 'Окрестности станции',
      map_image: '',
      map_size: { w: 1280, h: 720 },
      map_art: art('#1a1410', [
        rect('земля', 0, 0, 1280, 720, '#2a2018'),
        rect('пути', 100, 340, 1080, 16, '#1a1510'),
        rect('здание_станции', 480, 200, 200, 120, '#4a3830'),
        ellipse('кафе', 320, 280, 40, 30, '#6a4030'),
        ellipse('дом', 900, 420, 50, 40, '#5a4030'),
        ellipse('мост', 200, 500, 60, 20, '#4a5060'),
        line('дорога', 580, 320, 900, 420, '#5a4a38', 6),
      ]),
      parent_region: null,
      locations: [
        {
          id: 'loc_station',
          label: 'Станция «Тихая»',
          position: { x: 560, y: 280 },
          travel_connections: [
            { to: 'loc_home', cost_ticks: 1 },
            { to: 'loc_bridge', cost_ticks: 1 },
          ],
          scenes: ['scene_platform', 'scene_waiting', 'scene_cafe', 'scene_platform_night'],
          arrival_scene: 'scene_platform',
          music: 'music_station',
        },
        {
          id: 'loc_home',
          label: 'Дом',
          position: { x: 900, y: 420 },
          travel_connections: [{ to: 'loc_station', cost_ticks: 1 }],
          scenes: ['scene_home'],
          arrival_scene: 'scene_home',
          music: 'music_station',
        },
        {
          id: 'loc_bridge',
          label: 'Мост',
          position: { x: 220, y: 500 },
          travel_connections: [{ to: 'loc_station', cost_ticks: 1 }],
          scenes: ['scene_bridge'],
          arrival_scene: 'scene_bridge',
          music: 'music_night',
        },
      ],
    },
  ],
}

const scenes: Record<string, unknown> = {
  scene_platform: {
    id: 'scene_platform',
    label: 'Перрон (вечер)',
    location: 'loc_station',
    chapter: 'chapter_arrive',
    canvas: { w: 1280, h: 720 },
    states: [
      { id: 'state_evening', label: 'Вечер', art: artPlatformDay, condition: null },
    ],
    slots: [
      slot('slot_letter', 'Конверт на скамье', ['prop'], 140, 400, 100, 90, {
        default_entity: 'npc_letter',
      }),
      slot('slot_to_waiting', 'В зал ожидания', ['prop'], 800, 380, 120, 160),
    ],
    navigation: [
      {
        area: { x: 780, y: 360, w: 160, h: 180 },
        go_to_scene: 'scene_waiting',
        label: 'В зал ожидания',
      },
      {
        area: { x: 1100, y: 400, w: 140, h: 200 },
        open_map: true,
        label: 'К карте посёлка',
      },
    ],
  },
  scene_waiting: {
    id: 'scene_waiting',
    label: 'Зал ожидания',
    location: 'loc_station',
    chapter: 'chapter_arrive',
    canvas: { w: 1280, h: 720 },
    states: [{ id: 'state_default', label: 'Обычное', art: artWaiting, condition: null }],
    slots: [
      slot('slot_photo', 'Рамка на стене', ['prop'], 60, 120, 100, 120, {
        default_entity: 'npc_photo',
      }),
    ],
    navigation: [
      { area: { x: 40, y: 500, w: 160, h: 120 }, go_to_scene: 'scene_platform', label: 'На перрон' },
      { area: { x: 1000, y: 400, w: 160, h: 160 }, go_to_scene: 'scene_cafe', label: 'В кафе' },
      { area: { x: 1100, y: 560, w: 140, h: 100 }, open_map: true, label: 'Карта' },
    ],
  },
  scene_cafe: {
    id: 'scene_cafe',
    label: 'Кафе «У путей»',
    location: 'loc_station',
    chapter: 'chapter_people',
    canvas: { w: 1280, h: 720 },
    states: [{ id: 'state_default', label: 'Смена', art: artCafe, condition: null }],
    slots: [
      slot('slot_lena', 'Лена за стойкой', ['person'], 280, 280, 140, 200, {
        default_entity: 'npc_lena',
      }),
    ],
    navigation: [
      { area: { x: 40, y: 500, w: 140, h: 120 }, go_to_scene: 'scene_waiting', label: 'В зал' },
    ],
  },
  scene_home: {
    id: 'scene_home',
    label: 'Отчий дом',
    location: 'loc_home',
    chapter: 'chapter_people',
    canvas: { w: 1280, h: 720 },
    states: [{ id: 'state_default', label: 'Вечер', art: artHome, condition: null }],
    slots: [
      slot('slot_mother', 'Мать у стола', ['person'], 240, 320, 140, 220, {
        default_entity: 'npc_mother',
      }),
    ],
    navigation: [
      { area: { x: 1100, y: 400, w: 120, h: 200 }, open_map: true, label: 'Выйти' },
    ],
  },
  scene_bridge: {
    id: 'scene_bridge',
    label: 'Мост над путями',
    location: 'loc_bridge',
    chapter: 'chapter_people',
    canvas: { w: 1280, h: 720 },
    states: [{ id: 'state_default', label: 'Сумерки', art: artBridge, condition: null }],
    slots: [
      slot('slot_boris', 'Борис у перил', ['person'], 560, 280, 140, 200, {
        default_entity: 'npc_boris',
      }),
    ],
    navigation: [
      { area: { x: 40, y: 500, w: 140, h: 120 }, open_map: true, label: 'К станции' },
    ],
  },
  scene_platform_night: {
    id: 'scene_platform_night',
    label: 'Перрон (последний поезд)',
    location: 'loc_station',
    chapter: 'chapter_train',
    canvas: { w: 1280, h: 720 },
    states: [{ id: 'state_night', label: 'Ночь', art: artPlatformNight, condition: null }],
    slots: [
      slot('slot_conductor', 'Проводник', ['person'], 120, 420, 140, 180, {
        default_entity: 'npc_conductor',
      }),
      slot('slot_lena_night', 'Лена на перроне', ['person'], 400, 400, 120, 180, {
        default_entity: 'npc_lena',
        // видно, если согласилась ехать — через presence? engine uses schedule;
        // keep always, dialogue handles
      }),
    ],
    navigation: [
      { area: { x: 900, y: 360, w: 160, h: 180 }, go_to_scene: 'scene_waiting', label: 'В зал' },
      { area: { x: 1100, y: 400, w: 140, h: 180 }, open_map: true, label: 'Карта' },
    ],
  },
}

const entities: Record<string, unknown> = {
  player_hero: {
    id: 'player_hero',
    type: 'npc',
    label: 'Вы',
    description: 'Тот, кто уехал и всё-таки вернулся на одну ночь.',
    portrait: { neutral: '' },
    stats: { STR: 10, CON: 11, SIZ: 11, DEX: 11, INT: 13, POW: 12, CHA: 12 },
    skills: { persuade: 40, spot: 35, stealth: 20, dodge: 25, brawl: 20, first_aid: 25 },
    inventory: [
      { item: 'item_coin', quantity: 40 },
      { item: 'item_ticket', quantity: 1 },
    ],
    equipment: {},
  },
  npc_lena: npc(
    'npc_lena',
    'Лена',
    'Работает в станционном кафе. Когда-то вы ушли — она осталась. Голос ровный, глаза — нет.',
    'dialogues/lena.ink',
    { base_disposition: 15 },
  ),
  npc_mother: npc(
    'npc_mother',
    'Мать',
    'Держит дом так, будто отец вот-вот вернётся с смены. Чай слишком крепкий.',
    'dialogues/mother.ink',
    { base_disposition: 20, skills: { persuade: 35, spot: 40 } },
  ),
  npc_boris: npc(
    'npc_boris',
    'Борис',
    'Друг детства. Курит на мосту то, чего давно нет. Говорит коротко и в точку.',
    'dialogues/boris.ink',
    { base_disposition: 25, skills: { persuade: 45, spot: 40 } },
  ),
  npc_conductor: npc(
    'npc_conductor',
    'Проводник',
    'Последний поезд на юг. Ему всё равно на ваши чувства — только на расписание.',
    'dialogues/conductor.ink',
    { base_disposition: 0, slot_type: 'prop', stats: { STR: 8, CON: 8, SIZ: 10, DEX: 8, INT: 10, POW: 10, CHA: 8 } },
  ),
  npc_letter: npc(
    'npc_letter',
    'Письмо отца',
    'Конверт без марки, будто его оставили руками, а не почтой.',
    'dialogues/letter.ink',
    {
      slot_type: 'prop',
      schedule: [],
      stats: { STR: 5, CON: 5, SIZ: 5, DEX: 5, INT: 5, POW: 5, CHA: 5 },
      skills: {},
      base_disposition: 0,
    },
  ),
  npc_photo: npc(
    'npc_photo',
    'Старое фото',
    'Трое на мосту. Лето, которое вы все обещали не заканчивать.',
    'dialogues/photo.ink',
    {
      slot_type: 'prop',
      schedule: [],
      stats: { STR: 5, CON: 5, SIZ: 5, DEX: 5, INT: 5, POW: 5, CHA: 5 },
      skills: {},
      base_disposition: 0,
    },
  ),
  item_coin: item('item_coin', 'Монеты', 'Мелочь на чай.', { category: 'currency', stackable: true, weight: 0 }),
  item_ticket: item('item_ticket', 'Билет на последний поезд', 'Картон steртый на сгибе. Время отправления — 22:00.', {
    category: 'quest',
    weight: 0,
  }),
  item_tea: item('item_tea', 'Стакан чая', 'Горячий, сладкий, как в детстве на перроне.', {
    category: 'drink',
    stackable: true,
    weight: 0.3,
    on_use: {
      effects: [{ type: 'change_need', need: 'need_warmth', delta: 20 }],
      consume: true,
    },
  }),
}

const dialogues: Record<string, DlgDoc> = {
  lena: dlgLena,
  mother: dlgMother,
  boris: dlgBoris,
  conductor: dlgConductor,
  letter: dlgLetter,
  photo: dlgPhoto,
}

const rules: Record<string, unknown> = {
  rule_intro: {
    id: 'rule_intro',
    label: 'Пролог',
    once: true,
    chapter: 'chapter_arrive',
    conditions: [{ type: 'tick_elapsed', min_tick: 0 }],
    effects: [
      { type: 'play_cutscene', cutscene: 'cutscene_intro' },
      { type: 'start_quest', quest: 'quest_homecoming' },
      { type: 'change_need', need: 'need_grief', delta: -60 },
      {
        type: 'show_message',
        text: 'До последнего поезда — несколько часов. Скажите то, что молчали.',
      },
    ],
  },
  rule_train_warn: {
    id: 'rule_train_warn',
    label: 'Скоро поезд',
    once: true,
    conditions: [{ type: 'tick_elapsed', min_tick: 21 }],
    effects: [
      { type: 'set_flag', flag: 'train_warned' },
      { type: 'banner', text: 'Скоро гудок. Последний поезд на перроне.', preset: 'шёпот', seconds: 4 },
      { type: 'teleport_player', location: 'loc_station', scene: 'scene_platform_night' },
    ],
  },
  rule_train_gone: {
    id: 'rule_train_gone',
    label: 'Поезд ушёл',
    once: true,
    conditions: [
      { type: 'tick_elapsed', min_tick: 23 },
      { type: 'flag_not_set', flag: 'boarded_alone' },
      { type: 'flag_not_set', flag: 'boarded_with_lena' },
      { type: 'flag_not_set', flag: 'refused_train' },
    ],
    effects: [
      { type: 'set_flag', flag: 'missed_train' },
      { type: 'fire_rule', rule: 'rule_ending_missed' },
    ],
  },
  rule_ending_stay: {
    id: 'rule_ending_stay',
    label: 'Финал: остаюсь',
    once: true,
    manual: true,
    conditions: [],
    effects: [
      { type: 'advance_quest', quest: 'quest_homecoming', stage: 'completed' },
      { type: 'game_over_victory' },
    ],
  },
  rule_ending_leave: {
    id: 'rule_ending_leave',
    label: 'Финал: один',
    once: true,
    manual: true,
    conditions: [],
    effects: [
      { type: 'advance_quest', quest: 'quest_homecoming', stage: 'completed' },
      { type: 'game_over_victory' },
    ],
  },
  rule_ending_together: {
    id: 'rule_ending_together',
    label: 'Финал: вдвоём',
    once: true,
    manual: true,
    conditions: [],
    effects: [
      { type: 'advance_quest', quest: 'quest_homecoming', stage: 'completed' },
      { type: 'advance_quest', quest: 'quest_lena', stage: 'completed' },
      { type: 'game_over_victory' },
    ],
  },
  rule_ending_missed: {
    id: 'rule_ending_missed',
    label: 'Финал: опоздал',
    once: true,
    manual: true,
    conditions: [],
    effects: [
      { type: 'set_flag', flag: 'missed_train' },
      { type: 'advance_quest', quest: 'quest_homecoming', stage: 'completed' },
      { type: 'game_over_victory' },
    ],
  },
  rule_start_lena_quest: {
    id: 'rule_start_lena_quest',
    label: 'Квест Лены',
    once: true,
    conditions: [{ type: 'flag_set', flag: 'met_lena' }],
    effects: [
      { type: 'start_quest', quest: 'quest_lena' },
    ],
  },
  rule_lena_warm: {
    id: 'rule_lena_warm',
    label: 'Лена: тёплый облик',
    once: true,
    manual: true,
    conditions: [],
    effects: [{ type: 'set_entity_state', entity: 'npc_lena', state: 'warm' }],
  },
  rule_mother_warm: {
    id: 'rule_mother_warm',
    label: 'Мать: тёплый облик',
    once: true,
    manual: true,
    conditions: [],
    effects: [{ type: 'set_entity_state', entity: 'npc_mother', state: 'warm' }],
  },
}

const quests = {
  quest_homecoming: {
    id: 'quest_homecoming',
    label: 'Возвращение',
    description: 'Провести ночь на станции «Тихая»: дом, люди, последний поезд.',
    journal_entries: {
      started: 'Я снова здесь. До поезда — несколько часов. Мать, Лена, мост — и письмо, которое не открывал.',
      letter: 'Письмо отца: «Докажи, что умеешь возвращаться».',
      mother: 'Мы поговорили. Не всё исправлено — но сказано.',
      completed: 'Ночь кончилась. Выбор сделан.',
    },
    stages: [
      {
        id: 'started',
        label: 'Ночь на станции',
        on_enter_effects: [{ type: 'journal_update', quest: 'quest_homecoming', text_key: 'started' }],
        transitions: [
          {
            to: 'completed',
            conditions: [
              {
                type: 'or',
                conditions: [
                  { type: 'flag_set', flag: 'refused_train' },
                  { type: 'flag_set', flag: 'boarded_alone' },
                  { type: 'flag_set', flag: 'boarded_with_lena' },
                  { type: 'flag_set', flag: 'missed_train' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'completed',
        label: 'Итог',
        final: true,
        outcome: 'success',
        on_enter_effects: [{ type: 'journal_update', quest: 'quest_homecoming', text_key: 'completed' }],
      },
    ],
  },
  quest_lena: {
    id: 'quest_lena',
    label: 'Лена',
    description: 'Найти слова, которые стоило сказать годы назад.',
    journal_entries: {
      started: 'Лена в кафе. Голос ровный. Это не значит, что легко.',
      apology: 'Я извинился. Она услышала.',
      together: 'Она готова ехать. Или хотя бы попробовать.',
      completed: 'Мы выбрали одно направление — на эту ночь.',
    },
    stages: [
      {
        id: 'started',
        label: 'Кафе',
        transitions: [
          { to: 'apology', conditions: [{ type: 'flag_set', flag: 'lena_apology' }] },
        ],
      },
      {
        id: 'apology',
        label: 'После извинения',
        on_enter_effects: [{ type: 'journal_update', quest: 'quest_lena', text_key: 'apology' }],
        transitions: [
          { to: 'completed', conditions: [{ type: 'flag_set', flag: 'lena_will_go' }] },
          {
            to: 'completed_soft',
            conditions: [{ type: 'flag_set', flag: 'boarded_alone' }],
          },
        ],
      },
      {
        id: 'completed',
        label: 'Вместе',
        final: true,
        outcome: 'success',
        on_enter_effects: [{ type: 'journal_update', quest: 'quest_lena', text_key: 'together' }],
      },
      {
        id: 'completed_soft',
        label: 'Разные пути',
        final: true,
        outcome: 'success',
        on_enter_effects: [{ type: 'journal_update', quest: 'quest_lena', text_key: 'completed' }],
      },
    ],
  },
}

const cutscenes = {
  cutscene_intro: {
    id: 'cutscene_intro',
    label: 'Пролог: путь домой',
    slides: [
      {
        art: art('#1a1410', [
          rect('небо', 0, 0, 1280, 720, { gradient: { from: '#1a1020', to: '#c4784a', angle: 90 } }),
          rect('рельс', 0, 500, 1280, 12, '#1a1510'),
          poly('поезд', [200, 420, 900, 420, 920, 500, 180, 500], '#2a2830'),
        ]),
        text: 'Поезд долго трясся сквозь поля. Вы считали станции, чтобы не считать годы.',
        transition: 'fade',
      },
      {
        art: artPlatformDay,
        text: '«Тихая». Имя, которое в детстве казалось насмешкой. Сейчас — точным.',
        transition: 'fade',
      },
      {
        art: artHome,
        text: 'Отец не встретит. Но дом ещё пахнет его табаком. И у вас есть несколько часов до гудка.',
        transition: 'fade',
      },
    ],
  },
}

const codex = {
  codex_father: {
    id: 'codex_father',
    label: 'Отец',
    category: 'chronicles',
    text: 'Станционный смотритель. Мало писал — ждал писем. Перед тишиной просил не винить себя: «Станция никого не держит силой».',
  },
  codex_letter: {
    id: 'codex_letter',
    label: 'Письмо',
    category: 'chronicles',
    text: '«Не торопись доказывать миру, что уехал. Докажи себе, что умеешь возвращаться».',
  },
  codex_station: {
    id: 'codex_station',
    label: 'Станция «Тихая»',
    category: 'places',
    text: 'Малый остановочный пункт. Последний пассажирский — в 22:00. Дальше ночь длиной в десять часов.',
  },
}

const manifest = {
  scenes: Object.keys(scenes).map((id) => `${id}.json`),
  entities: Object.keys(entities).map((id) => `${id}.json`),
  rules: Object.keys(rules).map((id) => `${id}.json`),
  arenas: [] as string[],
  quests: Object.keys(quests).map((id) => `${id}.json`),
  encounters: [] as string[],
  cutscenes: Object.keys(cutscenes).map((id) => `${id}.json`),
  dialogues: Object.keys(dialogues).map((id) => `${id}.ink`),
  recipes: [] as string[],
  codex: Object.keys(codex).map((id) => `${id}.json`),
}

function write(rel: string, data: unknown) {
  const path = join(out, rel)
  mkdirSync(dirname(path), { recursive: true })
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n'
  writeFileSync(path, text)
  console.log('write', rel)
}

// clean & write
mkdirSync(out, { recursive: true })
write('campaign.json', campaign)
write('world.json', world)
write('manifest.json', manifest)

for (const [id, sc] of Object.entries(scenes)) write(`scenes/${id}.json`, sc)
for (const [id, en] of Object.entries(entities)) write(`entities/${id}.json`, en)
for (const [id, ru] of Object.entries(rules)) write(`rules/${id}.json`, ru)
for (const [id, q] of Object.entries(quests)) write(`quests/${id}.json`, q)
for (const [id, c] of Object.entries(cutscenes)) write(`cutscenes/${id}.json`, c)
for (const [id, c] of Object.entries(codex)) write(`codex/${id}.json`, c)

for (const [id, doc] of Object.entries(dialogues)) {
  write(`dialogues/${id}.dlg.json`, doc)
  const ink = generateInk(doc)
  write(`dialogues/${id}.ink`, ink)
}

// index.json registry
const indexPath = join(root, 'public/campaigns/index.json')
let index: Array<{ id: string; title: string; author?: string; description?: string }> = []
if (existsSync(indexPath)) {
  try {
    index = JSON.parse(readFileSync(indexPath, 'utf8'))
  } catch {
    index = []
  }
}
index = index.filter((e) => e.id !== ID)
index.push({
  id: ID,
  title: campaign.title,
  author: campaign.author,
  description: campaign.description,
})
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n')
console.log('index updated, campaigns:', index.map((c) => c.id).join(', '))
console.log('OK', ID)
