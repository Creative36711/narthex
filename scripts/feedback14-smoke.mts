import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const f = (p: string) => readFileSync(join(root, p), 'utf8')
let fails = 0
const must = (ok: boolean, name: string) => {
  console.log((ok ? '✓ ' : '✗ ') + name)
  if (!ok) fails++
}

const css = f('src/index.css')
const campaign = f('src/editor/CampaignEditor.tsx')
const world = f('src/editor/WorldEditor.tsx')
const arena = f('src/editor/ArenaEditor.tsx')
const fields = f('src/editor/Fields.tsx')
const speech = f('src/shared/speech.ts')
const dlg = f('src/player/DialogueOverlay.tsx')
const builder = f('src/editor/DialogueBuilder.tsx')

// 1 — JSON кампании без подписи, до низа экрана (флекс-колонка + растяжение)
must(!campaign.includes('Валюты, мета-прогресс') && css.includes('height: calc(100vh - 118px)') && css.includes('.advanced-json-page textarea'),
  '1 JSON кампании без лишней подписи, почти до низа экрана')
must(!world.includes('Мир целиком'),
  '1 у JSON мира подпись тоже убрана')

// 2 — музыка боя под блоком «Арена»
const arenaPos = arena.indexOf('<h4>Арена</h4>')
const musicPos = arena.indexOf('Музыка боя (перекрывает')
const propsEnd = arena.indexOf('Блоков: {arena.hex_grid.blocked_hexes.length}')
must(arenaPos > 0 && musicPos > arenaPos && musicPos > propsEnd && musicPos < arena.indexOf('<FileAdvancedJson'),
  '2 музыка боя — компактно внутри блока «Арена»')

// 3 — раскрытый JSON нормальной высоты
must(fields.includes('rows={22}') && css.includes('.advanced-json textarea') && css.includes('min-height: 62vh'),
  '3 раскрытые JSON — высотой 62vh, править файлом удобно')

// 4 — ink диалогов внизу, а не справа
must(builder.includes('Ink-исходник') && css.includes('.dlg-builder > .advanced-json') && css.includes('.dlg-builder { flex-wrap: wrap; }'),
  '4 ink-исходник — внизу на всю ширину (не правая колонка)')

// 5 — курсор на изображении врага — меч
must(css.includes('.token-enemy:not(.token-dead) { cursor: var(--cur-sword); }') && css.includes('.token { cursor: var(--cur-cross); }'),
  '5 по жетону врага — курсор-меч, по своим — прицел')

// 6 — диалоги: постепенная выдача + озвучка каждой фразы
// (фидбек 21: диалоги озвучиваются по образцу катсцен — одна фраза, темп по onEnd)
must(speech.includes('queue?: boolean') && speech.includes('const queue: QueueItem[]'),
  '6 синтезатор: фразы ставятся в очередь, не срезают друг друга')
must(dlg.includes('TYPE_MS') && dlg.includes('setTyped') && dlg.includes('revealed') && dlg.includes('lineDone'),
  '6 диалоги печатаются постепенно (как катсцены), темп ведёт озвучка (lineDone)')
must(dlg.includes('allShown') && dlg.includes('dialogue-choices'),
  '6 варианты ответа появляются после полного показа текста')

console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'ALL GREEN')
if (fails) process.exitCode = 1
