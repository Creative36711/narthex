/**
 * Смоук совместимости сохранений и версий (`docs/compatibility.md`, фаза A).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/saves-compat-smoke.mts
 *
 *  1. контракт версий: ENGINE_VERSION/PACKAGE_FORMAT, сравнение и bump;
 *  2. автосейв пишется в обёртке (версии кампании и движка внутри);
 *  3. «голое» состояние старого формата читается и переносится;
 *  4. обновление кампании: битые ссылки чинятся с отчётом по-русски;
 *  5. save_base_version: старый сейв не поддерживается, но НЕ удаляется;
 *  6. резервная копия создаётся до первой правки сейва;
 *  7. экспорт/импорт сейва.
 */
import { loadCampaign } from '../src/core/loader'
import { GameEngine, openSave, peekSave, hasSave, deleteSave, saveKey, backupKey, exportSaveText, importSaveText, checkSaveVersion } from '../src/core/engine'
import { SAVE_MIGRATIONS, repairState, type ReportCtx } from '../src/core/savemigrate'
import { ENGINE_VERSION, OLDEST_PACKAGE_FORMAT, PACKAGE_FORMAT, checkEngine, checkPackage, compareVersions, bumpVersion, parseVersion, stableVersion } from '../src/shared/versions'
import { SAVE_VERSION, SAVE_ENVELOPE_VERSION, type CampaignData, type SaveNote } from '../src/shared/types'

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

const demo = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
console.log(`Кампания: ${demo.meta.title} v${demo.meta.version} · движок ${ENGINE_VERSION} · формат пакета v${PACKAGE_FORMAT}`)

// ── 1. контракт версий ──
{
  check('1 версия движка не пустая', /^\d+\.\d+\.\d+/.test(ENGINE_VERSION), ENGINE_VERSION)
  check('1 формат пакета — целое ≥ 1', Number.isInteger(PACKAGE_FORMAT) && PACKAGE_FORMAT >= 1, String(PACKAGE_FORMAT))
  check('1 сравнение версий', compareVersions('1.4.2', '1.5.0') < 0 && compareVersions('2.0.0', '1.9.9') > 0 && compareVersions('1.0.0', '1.0.0') === 0)
  check('1 предрелиз младше релиза', compareVersions('1.5.0-beta.1', '1.5.0') < 0)
  check('1 bump', bumpVersion('1.4.2', 'patch') === '1.4.3' && bumpVersion('1.4.2', 'minor') === '1.5.0' && bumpVersion('1.4.2', 'major') === '2.0.0')
  check('1 разбор «мусора» не падает', parseVersion('latest').major === 0 && stableVersion('1.2.3-rc.1') === '1.2.3')
  check('1 движок подходит демо-кампании', checkEngine(demo.meta.min_engine ?? demo.meta.engine_version).ok)
  const future = checkEngine('99.0.0')
  check('1 слишком новый минимум — понятный отказ', !future.ok && future.message.includes('99.0.0'), future.message.slice(0, 40))
  check('1 свой формат пакета проходит', checkPackage(PACKAGE_FORMAT).ok && checkPackage(undefined).ok)
  check('1 пакет новее движка — отказ с причиной', !checkPackage(PACKAGE_FORMAT + 1).ok && checkPackage(PACKAGE_FORMAT + 1).message.includes(`v${PACKAGE_FORMAT + 1}`))
  check('1 древний формат пакета — отказ', !checkPackage(OLDEST_PACKAGE_FORMAT - 1).ok || OLDEST_PACKAGE_FORMAT === 1)
  check('1 цепочка миграций непрерывна', SAVE_MIGRATIONS.every((m, i) => i === 0 || m.from === SAVE_MIGRATIONS[i - 1].to) && SAVE_MIGRATIONS[SAVE_MIGRATIONS.length - 1].to === SAVE_VERSION)
}

// ── 2. автосейв в обёртке ──
const engine = new GameEngine(demo)
engine.start()
{
  const raw = mem.get(saveKey(demo.meta.id)) ?? ''
  const env = JSON.parse(raw)
  check('2 сейв пишется в обёртке', env.envelope_version === SAVE_ENVELOPE_VERSION, `envelope_version=${env.envelope_version}`)
  check('2 в обёртке версия кампании', env.campaign_version === demo.meta.version, env.campaign_version)
  check('2 в обёртке версия движка', env.engine_version === ENGINE_VERSION, env.engine_version)
  check('2 в обёртке формат состояния', env.save_version === SAVE_VERSION, `save_version=${env.save_version}`)
  check('2 в обёртке есть метки времени', !!env.created_at && !!env.updated_at)
  check('2 peekSave читает обёртку', peekSave(demo.meta.id)?.campaign_id === demo.meta.id)
}

// ── 3. «голое» состояние старого формата ──
{
  const legacyKey = 'legacy-test'
  const bare = { ...structuredClone(engine.state), save_version: 3, currencies: undefined }
  delete (bare as { campaign_id?: string }).campaign_id
  mem.set(saveKey(legacyKey), JSON.stringify(bare))
  const opened = openSave(legacyKey, demo)
  check('3 старый сейв без обёртки открыт', opened?.verdict.kind === 'ok')
  check('3 формат перенесён до текущего', opened?.report.from_version === 3 && opened?.state.save_version === SAVE_VERSION)
  check('3 в отчёте сказано про перенос', !!opened?.report.notes.some((n) => n.kind === 'migrated'), opened?.report.notes[0]?.text)
  check('3 после открытия сейв в обёртке', peekSave(legacyKey)?.campaign_version === demo.meta.version)
  check('3 создана резервная копия', !!mem.get(backupKey(legacyKey)))
  const backup = JSON.parse(mem.get(backupKey(legacyKey)) ?? '{}')
  check('3 резервная копия — исходник (без обёртки)', backup.envelope_version === undefined && backup.save_version === 3)
  deleteSave(legacyKey)
  check('3 удаление чистит и резерв', !mem.get(saveKey(legacyKey)) && !mem.get(backupKey(legacyKey)))
}

// ── 4. обновление кампании: битые ссылки чинятся ──
{
  const updated: CampaignData = structuredClone(demo)
  const itemId = engine.state.player.inventory[0]?.item ?? ''
  const npcId = Object.values(updated.entities).find((e) => e.type === 'npc')?.id ?? ''
  const questId = Object.keys(updated.quests)[0] ?? ''
  const stageId = updated.quests[questId]?.stages[1]?.id ?? updated.quests[questId]?.stages[0]?.id
  const sceneId = Object.keys(updated.scenes).find((s) => s !== demo.meta.starting_scene) ?? ''

  // «мастер удалил» предмет, НПС, стадию квеста и сцену
  delete updated.entities[itemId]
  delete updated.entities[npcId]
  if (questId && stageId) updated.quests[questId].stages = updated.quests[questId].stages.filter((s) => s.id !== stageId)
  delete updated.scenes[sceneId]

  const state = structuredClone(engine.state)
  state.player.inventory.push({ item: 'item_которого_нет', quantity: 1 })
  state.player.equipment['weapon'] = itemId
  state.player.needs['need_которой_нет'] = 50
  state.player.skills['skill_которого_нет'] = 40
  state.fired_rules.push('rule_которого_нет')
  state.codex_unlocked?.push('codex_которого_нет')
  if (questId && stageId) state.quests[questId] = { stage: stageId, status: 'active', journal: [] }
  state.location = Object.values(updated.world.regions)[0].locations[0].id
  state.scene = sceneId

  const notes: SaveNote[] = []
  const ctx: ReportCtx = { notes, note: (kind, text) => void notes.push({ kind, text }) }
  repairState(state, updated, ctx)

  check('4 предмет-призрак убран из инвентаря', !state.player.inventory.some((i) => i.item === 'item_которого_нет'))
  check('4 экипировка снята (предмет удалён)', state.player.equipment['weapon'] === undefined)
  check('4 чужая потребность убрана', state.player.needs['need_которой_нет'] === undefined)
  check('4 все потребности кампании на месте', (updated.meta.needs ?? []).every((n) => typeof state.player.needs[n.id] === 'number'))
  check('4 чужой навык убран', state.player.skills['skill_которого_нет'] === undefined)
  check('4 отметка о чужом правиле убрана', !state.fired_rules.includes('rule_которого_нет'))
  check('4 чужая запись кодекса убрана', !state.codex_unlocked?.includes('codex_которого_нет'))
  check('4 сцена заменена на существующую', !!updated.scenes[state.scene], state.scene)
  if (questId && updated.quests[questId]?.stages.length) {
    check('4 стадия квеста существует', updated.quests[questId].stages.some((s) => s.id === state.quests[questId]?.stage), state.quests[questId]?.stage)
  }
  check('4 отчёт по-русски и непустой', notes.length > 0 && notes.every((n) => /[а-яА-Я]/.test(n.text)), `${notes.length} строк`)
  check('4 в отчёте есть вид «починка»', notes.some((n) => n.kind === 'repaired'))
  console.log(`   отчёт: ${notes.length} строк, пример — «${notes[0]?.text}»`)
}

// ── 5. save_base_version: старый сейв не поддерживается, но жив ──
{
  const id = 'base-version-test'
  const e = new GameEngine(demo)
  e.start()
  mem.set(saveKey(id), JSON.stringify({ ...JSON.parse(mem.get(saveKey(demo.meta.id))!), campaign_id: id, campaign_version: '0.1.0' }))

  const strict: CampaignData = structuredClone(demo)
  strict.meta.version = '2.0.0'
  strict.meta.save_base_version = '1.4.0'

  const verdict = checkSaveVersion('0.1.0', strict.meta)
  check('5 вердикт: сейв v0.1.0 не поддержится с базы v1.4.0', verdict.kind === 'unsupported' && verdict.base_version === '1.4.0', JSON.stringify(verdict))
  check('5 вердикт: сейв v1.4.0 поддержится', checkSaveVersion('1.4.0', strict.meta).kind === 'ok')
  check('5 вердикт: сейв v1.5.2 поддержится', checkSaveVersion('1.5.2', strict.meta).kind === 'ok')

  const opened = openSave(id, strict)
  check('5 сейв не открывается как годный', opened?.verdict.kind === 'unsupported')
  check('5 причина на русском', !!opened && 'reason' in opened.verdict && /1\.4\.0/.test(opened.verdict.reason), (opened && 'reason' in opened.verdict ? opened.verdict.reason : '').slice(0, 50))
  check('5 сейв НЕ удалён (можно откатить версию кампании)', !!mem.get(saveKey(id)))
  check('5 сейв НЕ перезаписан', JSON.parse(mem.get(saveKey(id)) ?? '{}').campaign_version === '0.1.0')
  check('5 «Продолжить» не предлагается', hasSave(id, strict) === false)
  check('5 без save_base_version поддерживается всё', hasSave(id, demo) === true)
  // сейв без версии кампании (сделан до введения обёртки) — не выбрасываем
  check('5 сейв без версии кампании принимается', checkSaveVersion(undefined, strict.meta).kind === 'ok')
  deleteSave(id)
}

// ── 6. сейв из будущего движка не трогаем ──
{
  const id = 'future-save'
  mem.set(saveKey(id), JSON.stringify({ envelope_version: SAVE_ENVELOPE_VERSION, save_version: SAVE_VERSION + 10, campaign_id: id, state: structuredClone(engine.state) }))
  const opened = openSave(id, demo)
  check('6 сейв новее движка — отказ', opened?.verdict.kind === 'too_old', opened ? JSON.stringify(opened.verdict).slice(0, 60) : 'null')
  check('6 сейв новее движка не перезаписан', JSON.parse(mem.get(saveKey(id)) ?? '{}').save_version === SAVE_VERSION + 10)
  deleteSave(id)
}

// ── 7. экспорт и импорт сейва ──
{
  const text = exportSaveText(demo.meta.id)
  check('7 экспорт сейва отдаёт текст', !!text && JSON.parse(text!).envelope_version === SAVE_ENVELOPE_VERSION)
  deleteSave(demo.meta.id)
  check('7 после удаления сейва нет', !mem.get(saveKey(demo.meta.id)))
  check('7 импорт возвращает сейв', importSaveText(demo.meta.id, text!) === true)
  check('7 импортированный сейв читается', peekSave(demo.meta.id)?.campaign_version === demo.meta.version)
  check('7 битый текст не импортируется', importSaveText(demo.meta.id, 'это не json') === false)
  deleteSave(demo.meta.id)
}

console.log(failed === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (saves-compat)' : `\nПРОВАЛЕНО ПРОВЕРОК: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
