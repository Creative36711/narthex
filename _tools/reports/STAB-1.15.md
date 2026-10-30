# STAB-1.15 — `CampaignEditor.tsx` и `EditorApp.tsx` до 450 строк

Карточка: `4096f0cf-5705-81b0-9d42-f847bcb2afba` (STAB-1.15, продолжение STAB-1.11).
База: `cffe797` (main, «test: bind editor smoke probes to owner APIs (#179)»).
Отчёт о предыдущем заходе: `_tools/reports/STAB-1.11.md`.

## 1. «До» (`cffe797`, чистый main)

`npm run -s check:module-size` → rc 1, **5** модулей сверх лимита 450:

| Модуль | Строк |
| --- | --- |
| `src/editor/CampaignEditor.tsx` | 4100 |
| `src/editor/EditorApp.tsx` | 1333 |
| `src/shared/types.ts` | 3406 |
| `src/editor/store.ts` | 1407 |
| `src/editor/campaignAudit.ts` | 705 |

## 2. Почему разбиение стало возможным

STAB-1.14 перевёл smokes с текстовых закреплений на загрузку модулей-владельцев
(`scripts/mission-smokes.mts`, `loadMissionOwnerModules(['/src/editor/EditorApp.tsx'])`
и `['/src/editor/CampaignEditor.tsx']`). Поэтому код можно переносить между файлами,
не краснея проверками. Единственное оставшееся закрепление — двусторонний
`TOUCH_WHITELIST` в `scripts/view-write-smoke.mts`:

* `CampaignEditor.tsx::store.touch('campaign.json')` — правки паспорта кампании;
* `EditorApp.tsx::store.touch(\`dialogues/${fn}.dlg.json\`)` — явное создание диалога;
* `EditorApp.tsx::store.touch('campaign.json')` — исправление версии кампании.

Поэтому `commit()` в `CampaignEditor` и функции `createNew`/`doImport` в `EditorApp`
остались на месте; `smoke:view-write` — rc 0.

## 3. «После»

`npm run -s check:module-size` → rc 1, **3** модуля сверх лимита (5 → 3 как требовала карточка):

| Модуль | Строк |
| --- | --- |
| `src/shared/types.ts` | 3406 |
| `src/editor/store.ts` | 1407 |
| `src/editor/campaignAudit.ts` | 705 |

| Было | Стало | Строк |
| --- | --- | --- |
| `src/editor/CampaignEditor.tsx` | `src/editor/CampaignEditor.tsx` | 4100 → **100** |
| `src/editor/EditorApp.tsx` | `src/editor/EditorApp.tsx` | 1333 → **406** |

Остальные три модуля — по инварианту 3 карточки не делятся: `store.ts`,
`shared/types.ts` и `campaignAudit.ts` входят во входы `scripts/campaign-audit.mts`
и пересобираемого `public/ai/campaign-audit.mjs`; их разбиение меняет хеш бандла
(замер STAB-1.10: +794 Б, `27b2cf39…`), а пересборка бандла этой карточкой запрещена.

### 3.1 Новые модули `src/editor/**` (все ≤ 450)

Вкладки паспорта кампании:

| Модуль | Строк | Содержимое |
| --- | --- | --- |
| `campaignChronicleTab.tsx` | 202 | вкладка «Хроника» |
| `campaignMechanicsTab.tsx` | 236 | вкладка «Механики» |
| `campaignMainTab.tsx` | 297 | вкладка «Основное»: паспорт, серия, отдых, удача |
| `campaignMainRules.tsx` | 329 | продолжение «Основного»: опыт, черты, лагерь, цены, старт, рогалик |
| `campaignCreationTab.tsx` | 371 | вкладка «Создание героя» |
| `campaignPeopleTab.tsx` | 306 | вкладка «Персонажи» |
| `campaignItemsTab.tsx` | 369 | вкладка «Предметы и слоты» |
| `campaignItemsExtras.tsx` | 194 | продолжение «Предметов»: концовки и категории |
| `campaignMiscTabs.tsx` | 135 | короткие вкладки: флаги, звук, JSON |
| `campaignGeneratorsTab.tsx` | 221 | вкладка «События и генераторы» |
| `campaignTabProps.ts` | 28 | общие типы свойств вкладок |
| `campaignRegistryParts.tsx` | 381 | строки реестров, тумблеры, редактор условий |
| `campaignRegistryData.ts` | 20 | справочник тумблеров возможностей |
| `campaignChapterParts.tsx` | 136 | редактор глав и атрибуции |
| `campaignSkillBase.ts` | 46 | формула базового значения навыка |
| `campaignStatusesTab.tsx` | 420 | реестр статусов и способностей |
| `campaignThemeTab.tsx` | 256 | вкладка «Оформление»: профиль, акцент, токены, CSS |
| `campaignThemeTypography.tsx` | 407 | типографика оформления: шрифты, роли, размеры, экраны |

Страница редактора:

| Модуль | Строк | Содержимое |
| --- | --- | --- |
| `editorAppTypes.ts` | 90 | контекст страницы `EditorUi` |
| `editorAppCampaignOps.ts` | 345 | реестр кампаний, создание/удаление, сохранение, плейтест, список |
| `editorAppFileOps.ts` | 143 | экспорт .chronicle/JSON/патча, импорт папки, конфликт ID |
| `editorAppJsonImport.ts` | 127 | импорт кампании из вставленного JSON |
| `editorAppEffects.ts` | 205 | загрузка, подписка, меню, реестр, Ctrl+Z, автовыбор |
| `editorAppChrome.tsx` | 186 | шапка с меню и наложенные окна |
| `editorAppWorkspace.tsx` | 189 | навигация, список документов, открытый документ |
| `editorAppGuard.tsx` | 128 | ранние экраны: нет кампании, ошибка, загрузка, нет пака |
| `editorAppScreens.tsx` | 110 | экран плейтеста |

Перенос механический: тела функций и JSX перенесены без изменения логики; в
`EditorApp` добавлен один объект контекста `ui`, который получают шапка, рабочая
область, наложения и заглушки.

## 4. Оракул

| Проверка | Команда | Результат |
| --- | --- | --- |
| Типы | `npx tsc -b` | rc **0** |
| Линт | `npm run -s lint` | rc **0**, 1511 warnings (база `cffe797` — 1510; порог карточки 1516) |
| Бандл аудита | `npm run -s check:audit-bundle` | rc **0**, `✓ 1002333 bytes, sha256 b7f271bf7eeb…e70ced7e422d` — не пересобирался |
| Размер модулей | `npm run -s check:module-size` | rc 1, **5 → 3** сверх лимита |
| Смоуки | `npx tsx scripts/mission-smokes.mts` | **41/55**, rc 1 — как на базе |
| Вид-запись | `npm run -s smoke:view-write` (в составе миссии) | rc **0** |

`smoke:mission` до/после — построчное сравнение кодов возврата по всем 55 пробам:
таблицы совпадают, ни одна проба не сменила 0 на ненулевой код. Красные и до, и
после: `ai-runtime`, `ai-task`, `breathe-toggle`, `capability-modes`, `design-doc`,
`dialogue-speaker`, `dialogues-r31`, `dialogues-r32`, `drive-gateway`,
`encounters-loader`, `narrative-intro`, `p2`, `pack-missing`, `saves-compat`.

Дополнительно (вне оракула, для страховки переноса JSX): SSR-рендер частей страницы
(`EditorWorkspace`, `EditorTopbar`, `EditorOverlays`, `editorGuardScreen`) на заглушке
контекста проходит без исключений; мультимножества строковых литералов и значений
`className` в исходном `EditorApp.tsx` и в новых модулях совпадают.

## 5. Допущения

1. **Допущение:** «строка» считается как в `check:module-size` (строки файла), поэтому
   `EditorApp.tsx` = 406, `CampaignEditor.tsx` = 100.
2. **Допущение:** контекст `ui` — внутренняя деталь страницы; публичный API
   `EditorApp({ campaignPath, onExit })` и `CampaignEditor({ store })` не изменился.
3. **Допущение:** файлы, экспортирующие и компоненты, и данные, разделены
   (`campaignRegistryData.ts`, `campaignSkillBase.ts`, `editorAppGuard.tsx`), чтобы не
   плодить предупреждения `react(only-export-components)` — иначе линт выходил за порог.

## 6. Границы

Изменены только `src/editor/**` (два целевых файла + новые модули рядом),
`_tools/reports/STAB-1.15.md`, `docs/decisions/STAB-1.15.md`. Список в
`scripts/check-module-size.mts` не правился: после разбиения оба файла проходят лимит
сами, порог 450 и прочие записи не тронуты.
