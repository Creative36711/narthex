# STAB-1.11 — разбиение `CampaignEditor.tsx` и `EditorApp.tsx`

Карточка: `4096f0cf-5705-8100-83e0-cd1cb6f1d9ca` (STAB-1.11, продолжение STAB-1.10).
Ветка: `arena/05610d59-narthex`. База: `957cfc4` (main после PR #176).

Задача: разбить два оставшихся модуля сверх лимита 450 строк так, чтобы счёт
`check:module-size` упал с 5 до 2 (в отчёте STAB-1.10 они значились как «ничем не
закреплённые»).

## 1. «До» (`957cfc4`, чистый main)

| Модуль | Строк |
| --- | --- |
| `src/editor/CampaignEditor.tsx` | 5199 |
| `src/editor/EditorApp.tsx` | 1394 |
| `src/editor/store.ts` | 1407 |
| `src/shared/types.ts` | 3406 |
| `src/editor/campaignAudit.ts` | 705 |

`npm run check:module-size` → rc 1, 5 модулей сверх 450.

## 2. Что сделано

Разбиение по смыслу, без удаления кода и без изменения поведения; все новые модули —
`src/editor/**` с явным публичным API (экспортируемые компоненты/данные).

| Было | Стало | Новые модули |
| --- | --- | --- |
| `CampaignEditor.tsx` 5199 | **4100** | `campaignAppearance.tsx` 146 — карточки профиля и образец шрифта; `campaignFonts.ts` 36 — таблица ролей шрифтов; `campaignDiceEditors.tsx` 165 — редактор бросков и чипы множественного выбора; `campaignRegistries.tsx` 267 — реестры длящихся действий и версий кампании; `campaignSpeciesEditors.tsx` 420 — реестр видов и портреты героев; `campaignGenerators.tsx` 194 — редактор генераторов контента; `campaignGeneratorLabels.ts` 16 — подписи полей генераторов |
| `EditorApp.tsx` 1394 | **1333** | `editorMenus.ts` 71 — категории верхнего меню, подписи разделов, разбор пути кампании |

`npm run check:module-size` → rc 1, **5** модулей (вместо ожидаемых 2).

## 3. Почему счёт не стал 2 — замер, а не мнение

Оба файла **закреплены текстом** в работающих smokes, которые читают их по пути.
Smokes лежат в `scripts/**` — вне зоны карточки, править их нельзя, ослаблять тоже.

### 3.1 `src/editor/EditorApp.tsx`

| Закреплённый фрагмент | Кто требует | Строк в файле |
| --- | --- | --- |
| `const stableId = campaignIdFromPath(base)`, `store.setCampaignId(stableId)`, `await store.saveToDisk()`, `await pushIndex()`, `ID кампании не изменён` | `smoke:no-campaign`, `smoke:campaign-index` | `save` — 22 |
| `newAvailableCampaignId(index.map((entry) => entry.id))` ×2, `stableId`, `saveToDisk`, `pushIndex` | `smoke:no-campaign`, `smoke:campaign-index` | `doImportJson` — 84 |
| `updateCurrentCampaignDisplay()`, `store.setCampaignId(stableId)` | `smoke:campaign-index` | `doImport` — 100 |
| `store.touch(\`dialogues/${fn}.dlg.json\`)` | `smoke:view-write` (белый список: ключ — имя файла) | `createNew` — 59 |
| `store.touch('campaign.json')` | `smoke:view-write` (там же) | внутри `doImport` |
| `case 'entities'` + `type: 'npc' as const` + `group: 'Персонажи'` (окно 700 символов) | `smoke:feedback25` | `listFor` — 60 |
| `Кампаний пока нет`, `onClick={() => void newCampaign()}`, `onClick={() => void doImportJson()}` | `smoke:no-campaign` | экран пустого реестра — 84 |
| `` `/campaigns/${c.id}` === base ? store.meta.title : c.title `` | `smoke:campaign-index` | селект кампании — 18 |
| `editor-nav-menu" key={menu.id} onClick={(e) => e.stopPropagation()}` | `smoke:feedback10` | навигация — ~35 |
| `pushIndex` / `updateCurrentCampaignDisplay` (нужны закреплённым `save`/`doImport`) | те же | 27 |

Сумма только закреплённых фрагментов — **≈ 490 строк**, плюс шапка импортов (≈ 55) и
оболочка компонента/состояние, которое эти фрагменты используют. **Минимум файла при
зелёных smokes — ≈ 560 строк.** Лимит 450 недостижим без правки `scripts/**`.

Проверено фактически: `view-write` держит белый список в обе стороны — вынос вызова
`.touch(` в другой модуль даёт одновременно «новый сайт вне белого списка» и «запись
белого списка ссылается на отсутствующий сайт» (см. `scripts/view-write-smoke.mts:71-96`).

### 3.2 `src/editor/CampaignEditor.tsx`

Закреплённые в файле объявления и фрагменты (smokes `feedback17`, `feedback18`,
`feedback19`, `feedback26`, `feedback27`, `feedback29` читают файл по пути):

| Фрагмент | Строк |
| --- | --- |
| `StatusRegistry` (`label="Урон (кубики)"`, `label="Лечение (кубики)"`) | 401 |
| `FeatModRows` (`function FeatModRows`, `Модификаторы (что даёт черта)`) | 97 |
| `RegistryRows` (`function RegistryRows`, `<RegistryRows` в окнах) | 54 |
| `SkillDeltaRows` (`function SkillDeltaRows`, `Сдвиг навыков`) | 48 |
| `AttributionEditor` (`type="date"`) | 64 |
| `NEED_COND_TYPES` (`{ id: 'weather', label: 'Погода — текущая' }`) | 13 |
| `CampaignEditor` (JSX: `Слои погоды (реестр кампании)`, `overlay_layers`, `itemcat-checks`, `Стартовые характеристики`, `Предел навыка снизу`, `prof-card`/`prof-stats`, `Обязательные/Запрещённые навыки`, `Финальные экраны (концовки)` + `ConditionListEditor`, `+ слой погоды`, `makeId('overlay_'`, `— не заполнено</span>}`, `Требования (кто может взять)`, `Описание (подсказка игроку)`, `<RegistryRows`-окна) | 2530 (вся функция) |

Сумма закреплённых объявлений — **677 строк**, то есть уже больше лимита 450.
Второй по размеру остаток — `ThemeTab` (609 строк): он не закреплён, но сам по себе
превышает лимит и требует внутреннего разбиения на секции (профиль, атмосфера, шрифты,
токены, подписи интерфейса) — это следующий шаг, а не механический вынос.

Вывод: «2 модуля» из карточки недостижимо **при текущих smokes**; для достижения нужен
шаг, где в зоне `scripts/**` — тогда закреплённые фрагменты можно перенести вместе с
проверками (см. `docs/decisions/STAB-1.11.md`).

## 4. Оракулы

| Команда | rc | Итог |
| --- | --- | --- |
| `npx tsc -b` | 0 | молчит |
| `npm run lint` | 0 | `Found 1516 warnings and 0 errors` (было 1517; новых нет) |
| `npm run check:audit-bundle` | 0 | `1002333 bytes, sha256 b7f271bf…` — бандл не пересобирался |
| `npm run check:module-size` | 1 | 5 → 5 модулей; `CampaignEditor` 5199→4100, `EditorApp` 1394→1333 |
| `npm run smoke:mission` | 1 | **40/55** — как на базе; **построчно тот же rc у каждой из 55 проб** (`diff` по таблице rc пуст) |
| `npx tsx scripts/feedback1x/2x-smoke.mts` (11 файлов) | — | число `✗` совпадает с базой (`feedback25` 11, `feedback11` 1, остальные 0) |

Сверка mission: `mission-base-rc.txt` (до) против `mission-after-rc.txt` (после) — `diff`
пуст; ни одна проба не сменила rc 0 → не-0.

## 5. Допущения

- «Допущение: фрагменты, которые smokes ищут в файле по пути, считаются контрактом
  проверки, а не „долгом по размеру“: перенос такого фрагмента в другой модуль — это
  поломка оракула вне зоны карточки, поэтому он остаётся на месте.»
- «Допущение: `ThemeTab` (609 строк) нельзя вынести как есть — новый модуль тоже был бы
  больше 450; его нужно делить на секции внутри, это отдельная работа.»
- «Допущение: расстановка новых модулей по темам (оформление, реестры, виды, генераторы,
  кубики, меню) выбрана по смыслу, а не по размеру: каждая тема — самостоятельный экран
  паспорта кампании или навигации.»

## 6. Что осталось (долг, не успех)

1. `CampaignEditor.tsx` 4100: разбить `CampaignEditor` (2530) на секции-вкладки и
   `ThemeTab` (609) на подсекции; закреплённые фрагменты (677 строк) остаются в файле,
   поэтому остаток будет ≈ 700–900 строк — всё ещё выше 450.
2. `EditorApp.tsx` 1333: вынести тулбар, список и основную панель (≈ 300 строк);
   остаток ≈ 560 — предел, заданный smokes.
3. Довести оба до 450 можно только правкой `scripts/**` (перенос четырёх проверок
   `no-campaign`/`campaign-index`/`feedback25`/`feedback10` на новые пути и запись
   `.touch` в белом списке `view-write`).
