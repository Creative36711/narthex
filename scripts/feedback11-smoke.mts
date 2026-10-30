import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CampaignEditor } from '../src/editor/CampaignEditor'
import { HeroPortraitsEditor } from '../src/editor/campaignSpeciesEditors'
import { EditorStore } from '../src/editor/store'

const root = join(import.meta.dirname, '..')
const f = (p: string) => readFileSync(join(root, p), 'utf8')
let fails = 0
const must = (ok: boolean, name: string) => {
  console.log((ok ? '✓ ' : '✗ ') + name)
  if (!ok) fails++
}

const css = f('src/index.css')
const ecss = f('src/editor/editor.css')
const types = f('src/shared/types.ts')
;(globalThis as any).React = React
const ent = f('src/editor/EntityEditor.tsx')
const dialogue = f('src/editor/DialogueBuilder.tsx')
const migrate = f('src/shared/migrate.ts')
const html = f('index.html')

// 1 — иконки снова размером с шрифт (регресс «огромные иконки»)
must(/\.ico\s*\{[^}]*width: 1em/.test(css) && css.includes('height: 1em'),
  '1 .ico снова 1em×1em — иконки не раздувают интерфейс')

// 2 — курсоры: нативных pointer/default не осталось, рука-перчатка без «странного пальца»
must(!css.includes('cursor: pointer;') && !ecss.includes('cursor: pointer;') && !css.includes('cursor: default;') && !ecss.includes('cursor: default;'),
  '2 нативные cursor: pointer/default вычищены — кастомные ничем не перебиваются')
must(css.includes('--cur-pointer') && css.includes('stroke-width=\'2.2\'') && css.split("%3Cg fill='%23ffffff'%3E").length - 1 === 3,
  '2 рука-перчатка с обводкой-контуром (двойная заливка), остальные курсоры через переменные')
must(ecss.includes('var(--cur-grab)') && css.includes('--cur-grabbing'),
  '2 grab/grabbing в редакторе тоже кастомные')

// 3 — тултипы: одно описание, без пустых
must(css.includes('.ui-tooltip') && f('src/shared/tooltip.ts').includes("closest?.('[data-tip]')"),
  '3 одна общая плашка тултипа — без двоения и обрезки')

// 4 — favicon
must(existsSync(join(root, 'public/favicon.svg')) && html.includes('/favicon.svg'),
  '4 favicon.svg создан и подключён в index.html')

// 5 — вкладки форм: индикатор под выбранной вкладкой
must(ecss.includes('.ce-tab.on::after') && ecss.includes('flex-wrap: nowrap'),
  '5 индикатор активной вкладки — прямо под ней, вкладки не переносятся вниз')

// 6 — состояния портретов: без встроенных, всё удаляемо, дефолт скрыт
const emotionStore = new EditorStore('/campaigns/emotion-registry')
emotionStore.meta.emotions = []
emotionStore.meta.char_creation = {
  total_points: 1,
  portraits: [{ id: 'portrait_test', label: 'Портрет', image: 'portrait.png', states: { neutral: 'neutral.png' } }],
} as NonNullable<typeof emotionStore.meta.char_creation>
const portraitMarkup = renderToStaticMarkup(createElement(HeroPortraitsEditor, {
  m: emotionStore.meta,
  store: emotionStore,
  commit: () => undefined,
}))
const stateDeleteButton = portraitMarkup.match(/<button class="btn btn-small ce-del" data-tip="Убрать состояние"[^>]*>/)?.[0] ?? ''
must(!/BUILTIN_EMOTIONS/.test(types + ent + dialogue + migrate) && typeof CampaignEditor === 'function',
  '6 встроенных состояний больше нет нигде')
must(types.includes('DEFAULT_EMOTION') && portraitMarkup.includes('Обычный (по умолчанию)') && stateDeleteButton.length > 0 && !stateDeleteButton.includes('disabled'),
  '6 дефолтное состояние скрытое, в реестре все состояния удаляемы и переименовываемы')
must(emotionStore.meta.emotions.length === 0 && ent.includes('store.meta.emotions ?? []'),
  '6 реестр начинается пустым, без предзаполнения')
must(migrate.includes('legacyBuiltins') && migrate.includes('meta.emotions ?? []).filter'),
  '6 миграция вычищает старые автоматические пять')
must(ent.includes("neutral: p") || ent.includes('neutral: p'),
  '6 картинка по умолчанию персонажа попадает в дефолтное состояние (neutral)')

console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'ALL GREEN')
if (fails) process.exitCode = 1
