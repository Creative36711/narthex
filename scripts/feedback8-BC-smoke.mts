/**
 * Смоук восьмого раунда фидбека, блоки B и C. Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback8-BC-smoke.mts
 *
 *   B  человекочитаемые токены в диалогах вместо «сырого» ink
 *   C  ассеты по ссылкам: проверка доступности, вшивание в пакет
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { generateInk, inkToTokens, parseTokens, tokensToInk, tokenString } from '../src/editor/dialogueDoc'
import { assetUrl, isExternalUrl } from '../src/core/loader'
import { collectExternalUrls } from '../src/editor/assets'
import { EditorStore } from '../src/editor/store'
import type { CampaignData } from '../src/shared/types'

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

const base = 'http://localhost:5173/campaigns/ash-of-caerden'
const campaign: CampaignData = await loadCampaign(base)
console.log(`Кампания: ${campaign.meta.title}`)

// ── B: токены ──
{
  check(
    'B {счёт:item_silver} → ink',
    tokensToInk('У тебя {счёт:item_silver} марок.') === 'У тебя {item_count("item_silver")} марок.',
    tokensToInk('У тебя {счёт:item_silver} марок.'),
  )
  check('B {здоровье} → ink', tokensToInk('HP: {здоровье}') === 'HP: {get_hp()}', tokensToInk('HP: {здоровье}'))
  check(
    'B {потребность:warmth} → ink',
    tokensToInk('{потребность:warmth}') === '{get_need("warmth")}',
    tokensToInk('{потребность:warmth}'),
  )
  check('B {навык:persuade} → ink', tokensToInk('{навык:persuade}') === '{get_skill("persuade")}', tokensToInk('{навык:persuade}'))
  check(
    'B обратная миграция ink → токены',
    inkToTokens('{item_count("item_silver")} / {get_hp()} / {get_need("warmth")} / {get_skill("persuade")}') ===
      '{счёт:item_silver} / {здоровье} / {потребность:warmth} / {навык:persuade}',
    inkToTokens('{item_count("item_silver")} / {get_hp()} / {get_need("warmth")} / {get_skill("persuade")}'),
  )
  check(
    'B круговой проход: ink → токен → ink',
    tokensToInk(inkToTokens('{get_need("hunger")}')) === '{get_need("hunger")}',
  )
  const parts = parseTokens('У тебя {счёт:item_silver} марок.')
  check('B разбор на части: 3 сегмента, 1 токен', parts.length === 3 && parts[1].token?.kind === 'count', JSON.stringify(parts))
  check('B токен собирается из типа и id', tokenString('count', 'item_bread') === '{счёт:item_bread}')

  // демо: тексты хранят токены, сгенерированный ink — выражения
  const maeva = JSON.parse(readFileSync('public/campaigns/ash-of-caerden/dialogues/maeva.dlg.json', 'utf8'))
  const hasToken = JSON.stringify(maeva).includes('{счёт:item_silver}')
  const hasRawInk = JSON.stringify(maeva).includes('item_count(')
  check('B в демо (Маэва) текст хранит токен', hasToken)
  check('B в демо (Маэва) нет «сырого» ink', !hasRawInk)
  const ink = generateInk(maeva)
  check('B generateInk превращает токен в выражение', ink.includes('{item_count("item_silver")}'), ink.split('\n').find((l) => l.includes('марок серебром')) ?? '')
  const bran = JSON.parse(readFileSync('public/campaigns/ash-of-caerden/dialogues/bran.dlg.json', 'utf8'))
  check('B в демо (Бран) текст хранит токен', JSON.stringify(bran).includes('{счёт:item_silver}'))
  check('B .ink компилируется движком', !!campaign.dialogues['dialogues/maeva.ink'])

  // UI конструктора
  const builder = readFileSync('src/editor/DialogueBuilder.tsx', 'utf8')
  check('B в конструкторе есть кнопка вставки значения', builder.includes('Вставить значение') && builder.includes('TokenInserter'))
  check('B вставка в позицию курсора', builder.includes('selectionStart') && builder.includes('caret'))
  check('B под полем — предпросмотр', builder.includes('LinePreview') && builder.includes('В игре:') && builder.includes('parseTokens'))
}

// ── C: ссылки ──
{
  check('C внешняя ссылка пропускается как есть', assetUrl(campaign, 'https://cdn.example.com/x.jpg') === 'https://cdn.example.com/x.jpg')
  check('C локальный путь остаётся относительным', assetUrl(campaign, 'assets/img/x.jpg') === `${base}/assets/img/x.jpg`)
  check('C isExternalUrl различает ссылки и файлы', isExternalUrl('http://a/b.png') && !isExternalUrl('assets/x.png'))

  const fields = readFileSync('src/editor/Fields.tsx', 'utf8')
  check('C поле «или вставьте ссылку» в загрузчике', fields.includes('или вставьте ссылку') && fields.includes('AudioUpload'))
  check('C проверка доступности ссылки', fields.includes('checkExternalUrl') && fields.includes('asset-check'))
  const assets = readFileSync('src/editor/assets.ts', 'utf8')
  check('C предупреждение про CORS есть', assets.includes('нет CORS') && assets.includes('запрещает встраивание'))
  check('C вшивание ссылок в пакет', assets.includes('embedExternalAssets') && assets.includes('assets/external/'))
  const editor = readFileSync('src/editor/EditorApp.tsx', 'utf8')
  check('C чекбокс при экспорте', editor.includes('Вшить внешние ссылки в пакет') && editor.includes('askChecked'))

  // сбор внешних ссылок из документов кампании
  const store = new EditorStore('/campaigns/test')
  store.meta = { id: 'test' } as never
  store.jsonFiles.set('scenes/scene_x.json', {
    id: 'scene_x',
    states: [{ id: 's', label: 'S', image: 'https://cdn.example.com/bg.jpg', condition: null }],
    slots: [],
    navigation: [],
  })
  store.textFiles.set('dialogues/x.ink', '~ set_flag("a")')
  const urls = collectExternalUrls(store)
  check('C ссылки находятся в документах', urls.length === 1 && urls[0] === 'https://cdn.example.com/bg.jpg', urls.join(','))

  const arch = readFileSync('ARCHITECTURE.md', 'utf8')
  check('C в ARCHITECTURE.md есть раздел о рисках ссылок', arch.includes('Риски внешних ссылок'))
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
