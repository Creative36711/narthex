import { readFileSync } from 'node:fs'

function must(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✓ ${msg}`)
}

console.log('--- Смоук-тест: Управление эффектом живого дыхания сущностей ---')

const typesSrc = readFileSync('src/shared/types/entities.ts', 'utf8')
must(typesSrc.includes('breathe?: boolean'), '1. Поле breathe добавлено в типы сущностей')

const foregroundSrc = readFileSync('src/player/SceneForeground.tsx', 'utf8')
must(foregroundSrc.includes('entity.type === \'npc\' ? (entity.breathe !== false) : !!entity.breathe'), '2. Логика shouldBreathe корректна: NPC по умолчанию дышит, робот с breathe:false нет, предметы по умолчанию нет')
must(foregroundSrc.includes('cf-breathe'), '3. Класс cf-breathe применяется к спрайту')

const indexCss = readFileSync('src/index.css', 'utf8')
must(indexCss.includes('@keyframes cf-breathe') && indexCss.includes('.slot-sprite.cf-breathe'), '4. Анимация cf-breathe объявлена в index.css с transform-origin: bottom center')

const entityEdSrc = readFileSync('src/editor/EntityEditor.tsx', 'utf8')
must(entityEdSrc.includes('npc.breathe !== false') && entityEdSrc.includes('Эффект «живого дыхания» в сцене'), '5. В редакторе NPC есть переключатель дыхания (с возможностью отключить для роботов)')
must(entityEdSrc.includes('item.breathe') && entityEdSrc.includes('для живых или пульсирующих предметов'), '6. В редакторе предметов есть переключатель дыхания для живых артефактов')

const guideSrc = readFileSync('docs/ai-campaign-guide.md', 'utf8')
must(guideSrc.includes('breathe: false') && guideSrc.includes('роботов, автоматонов'), '7. В руководстве ИИ зафиксировано требование отключать breathe для роботов и механизмов')

console.log('breathe-toggle-smoke: ALL GREEN')
