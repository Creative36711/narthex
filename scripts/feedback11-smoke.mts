import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

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
const campaign = f('src/editor/CampaignEditor.tsx')
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
must(css.includes(":not([data-tip=''])") && css.includes('[data-tip]:has([data-tip]:hover)::after'),
  '3 вложенные тултипы не двоятся (только самый вложенный), пустые не показываются')

// 4 — favicon
must(existsSync(join(root, 'public/favicon.svg')) && html.includes('/favicon.svg'),
  '4 favicon.svg создан и подключён в index.html')

// 5 — вкладки форм: индикатор под выбранной вкладкой
must(ecss.includes('.ce-tab.on::after') && ecss.includes('flex-wrap: nowrap'),
  '5 индикатор активной вкладки — прямо под ней, вкладки не переносятся вниз')

// 6 — состояния портретов: без встроенных, всё удаляемо, дефолт скрыт
must(!/BUILTIN_EMOTIONS/.test(types + campaign + ent + dialogue + migrate),
  '6 встроенных состояний больше нет нигде')
must(types.includes('DEFAULT_EMOTION') && !campaign.includes('встроенное') && !campaign.includes('disabled={builtin}'),
  '6 дефолтное состояние скрытое, в реестре все состояния удаляемы и переименовываемы')
must(campaign.includes('if (!m.emotions) m.emotions = []') && ent.includes('store.meta.emotions ?? []'),
  '6 реестр начинается пустым, без предзаполнения')
must(migrate.includes('legacyBuiltins') && migrate.includes('meta.emotions ?? []).filter'),
  '6 миграция вычищает старые автоматические пять')
must(ent.includes("neutral: p") || ent.includes('neutral: p'),
  '6 картинка по умолчанию персонажа попадает в дефолтное состояние (neutral)')

console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'ALL GREEN')
if (fails) process.exitCode = 1
