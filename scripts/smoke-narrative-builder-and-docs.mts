import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { NarrativeIntroEntry } from '../src/shared/types'

console.log('--- Smoke test: Narrative Builder, Camera & AI Guide ---')

// 1. Проверяем валидность типа NarrativeIntroEntry с новыми полями
const entry: NarrativeIntroEntry = {
  text: 'Где-то внизу ходит вода, которой здесь быть не должно.',
  voice: 'assets/voice/intro.mp3',
  sfx: 'snd_gate',
  image: 'assets/img/cutscenes/intro.jpg',
  camera: 'center',
  duration: 4.5,
}

assert.strictEqual(entry.image, 'assets/img/cutscenes/intro.jpg')
assert.strictEqual(entry.camera, 'center')
assert.strictEqual(entry.duration, 4.5)
console.log('✓ Расширенные поля NarrativeIntroEntry типизированы корректно')

// 2. Проверяем схему campaign.schema.json
const schemaPath = path.resolve('docs/campaign.schema.json')
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
const narrativeDef = schema.$defs?.NarrativeIntroEntry ?? schema.definitions?.NarrativeIntroEntry
assert.ok(narrativeDef, 'Определение NarrativeIntroEntry найдено в JSON схеме')
const props = narrativeDef.properties ?? narrativeDef.anyOf?.[1]?.properties
assert.ok(props, 'Свойства NarrativeIntroEntry найдены')
assert.ok(props.image, 'Поле image присутствует в схеме NarrativeIntroEntry')
assert.ok(props.camera, 'Поле camera присутствует в схеме NarrativeIntroEntry')
assert.ok(props.duration, 'Поле duration присутствует в схеме NarrativeIntroEntry')
console.log('✓ JSON-схема содержит спецификацию полей image, camera, duration')

// 3. Проверяем наличие разделов оживления кадров, panzoom и narrative_intro в гайде
const guidePath = path.resolve('docs/ai-campaign-guide.md')
const guideText = fs.readFileSync(guidePath, 'utf8')

assert.ok(guideText.includes('Оживление изображений: покадровая анимация и спрайт-листы N×M'), 'Раздел покадровой анимации присутствует в гайде')
assert.ok(guideText.includes('Кинематографическая камера (`CameraPanZoom`)'), 'Раздел кинематографической камеры присутствует в гайде')
assert.ok(guideText.includes('Вводное нарративное интро сцен (`narrative_intro`)'), 'Раздел нарративного интро присутствует в гайде')
assert.ok(guideText.includes('Спрайт сцены против Фигурки боя: разница в ракурсе'), 'Раздел различий ракурсов спрайтов и фигурок присутствует')

console.log('✓ Руководство ИИ содержит исчерпывающие инструкции по анимациям, камере и нарративу')
console.log('--- Все проверки успешно пройдены! ---')
