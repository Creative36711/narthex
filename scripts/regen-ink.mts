/**
 * Перегенерация .ink из документов конструктора (.dlg.json) + проверка
 * компиляции inkjs. Запуск: npx tsx scripts/regen-ink.mts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Compiler } from 'inkjs/full'
import { generateInk } from '../src/editor/dialogueDoc'

const dir = join(process.cwd(), 'public/campaigns/ash-of-caerden/dialogues')
let fail = 0
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.dlg.json')) continue
  const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const ink = generateInk(doc)
  const inkPath = join(dir, f.replace(/\.dlg\.json$/, '.ink'))
  try {
    new Compiler(ink).Compile()
    writeFileSync(inkPath, ink)
    console.log(`✅ ${f} → ${f.replace(/\.dlg\.json$/, '.ink')} (компилируется)`)
  } catch (e) {
    fail++
    console.error(`❌ ${f}: ${e}`)
    console.error(ink.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'))
  }
}
process.exit(fail ? 1 : 0)
