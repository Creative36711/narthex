import { useEffect, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { derivedHP, derivedMP } from '../core/brp'
import { FlagAutocomplete } from './FlagAutocomplete'

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="pt-debug-section" open><summary>{label}</summary><div>{children}</div></details>
}

const STAT_LABELS: Record<string, string> = {
  STR: 'Сила',
  CON: 'Выносливость',
  SIZ: 'Размер',
  DEX: 'Ловкость',
  INT: 'Интеллект',
  POW: 'Сила воли',
  CHA: 'Обаяние',
}

function contentFlags(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => contentFlags(v, out))
  else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'string' && /^(flag|not_flag|set_flag|toggle_flag|clear_flag)$/.test(key) && v) out.add(v)
    else contentFlags(v, out)
  }
  return out
}

function contentVariables(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((entry) => contentVariables(entry, out))
  else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) {
    if (key === 'var' && typeof entry === 'string' && entry) out.add(entry)
    else contentVariables(entry, out)
  }
  return out
}

/** Читы доступны только внутри редакторского плейтеста. */
export function PlaytestDebugPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const startPlace = engine.findLocation(engine.state.location)
  const [region, setRegion] = useState(startPlace?.region.id ?? engine.campaign.world.regions[0]?.id ?? '')
  const [location, setLocation] = useState(engine.state.location)
  const [scene, setScene] = useState(engine.state.scene)
  const [flag, setFlag] = useState('')
  const [variable, setVariable] = useState('')
  const [value, setValue] = useState('0')
  const [item, setItem] = useState('')
  const [currency, setCurrency] = useState(engine.campaign.meta.currencies[0]?.id ?? '')
  const [amount, setAmount] = useState(1)
  const [skill, setSkill] = useState(Object.keys(engine.state.player.skills)[0] ?? '')
  const [stat, setStat] = useState(Object.keys(engine.state.player.stats)[0] ?? 'STR')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedPartyNpc, setSelectedPartyNpc] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; serial: number } | null>(null)
  const [feedbackSerial, setFeedbackSerial] = useState(0)
  const [, refresh] = useState(0)

  // Синхронизация селекторов с текущей позицией игрока
  useEffect(() => {
    const curLoc = engine.findLocation(engine.state.location)
    if (curLoc) {
      setRegion(curLoc.region.id)
      setLocation(curLoc.location.id)
      setScene(engine.state.scene)
    }
  }, [engine.state.scene, engine.state.location, engine])

  useEffect(() => {
    const unsubscribe = engine.subscribe(() => refresh((n) => n + 1))
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { unsubscribe(); window.removeEventListener('keydown', onKey) }
  }, [engine, onClose])
  const mutate = (fn: () => void, message: string | (() => string) = 'Отладочное действие выполнено.') => {
    fn()
    engine.notify()
    engine.autosave()
    const serial = feedbackSerial + 1
    setFeedbackSerial(serial)
    setFeedback({ text: typeof message === 'function' ? message() : message, serial })
  }
  const allRegions = engine.campaign.world.regions
  const selectedRegion = allRegions.find((r) => r.id === region)
  const allLocations = selectedRegion?.locations ?? []
  const locationScenes = Object.values(engine.campaign.scenes).filter((s) => s.location === location)
  const flagOptions = new Map((engine.campaign.meta.flags ?? []).map((f) => [f.id, {
    id: f.id,
    label: f.label || f.id,
    active: !!engine.state.flags[f.id],
  }]))
  for (const id of [...Object.keys(engine.state.flags), ...contentFlags(engine.campaign)]) {
    if (!flagOptions.has(id)) flagOptions.set(id, { id, label: id, active: !!engine.state.flags[id] })
  }
  const allFlags = [...flagOptions.values()]
  const selectedFlag = allFlags.find((f) => f.id === flag || f.label.localeCompare(flag, 'ru-RU', { sensitivity: 'base' }) === 0)
  const selectedFlagId = selectedFlag?.id ?? flag
  const selectedFlagActive = !!engine.state.flags[selectedFlagId]
  const variableNames = [...new Set([...Object.keys(engine.state.variables), ...contentVariables(engine.campaign)])].sort((a, b) => a.localeCompare(b, 'ru-RU'))
  const quests = Object.entries(engine.campaign.quests)
  const entries = Object.values(engine.campaign.codex)

  const copySnapshotForAi = () => {
    const sc = engine.currentScene()
    const loc = engine.findLocation(engine.state.location)?.location.label ?? engine.state.location
    const snapshot = {
      location: loc,
      scene: sc?.label ?? engine.state.scene,
      tick: engine.state.tick,
      hero: {
        hp: `${engine.state.player.hp}/${engine.state.player.max_hp}`,
        statuses: (engine.state.player.statuses ?? []).map((s) => s.id),
        party: engine.state.party ?? [],
      },
      active_quests: Object.fromEntries(
        Object.entries(engine.state.quests).map(([k, v]) => [engine.campaign.quests[k]?.label ?? k, v.stage])
      ),
      active_flags: Object.keys(engine.state.flags),
      recent_messages: (engine.messages ?? []).slice(-8),
    }
    void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
    mutate(() => {}, 'Снимок состояния скопирован в буфер обмена для ИИ!')
  }

  return <aside className="pt-debug-panel" role="dialog" aria-label="Панель отладки">
    <header>
      <b>Отладка</b>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button className="btn btn-small" onClick={copySnapshotForAi} title="Скопировать состояние сцены, квестов и лога для ИИ">📋 Снимок для ИИ</button>
        <button className="btn btn-small" onClick={onClose}>Закрыть</button>
      </div>
    </header>
    {feedback && <div key={feedback.serial} className="pt-debug-feedback" role="status" aria-live="polite">{feedback.text}</div>}
    <Section label="Переход к сцене">
      <select value={region} onChange={(e) => { const next = allRegions.find((r) => r.id === e.target.value); setRegion(e.target.value); const loc = next?.locations[0]; if (loc) { setLocation(loc.id); setScene(Object.values(engine.campaign.scenes).find((s) => s.location === loc.id)?.id ?? '') } }}>
        {allRegions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <select value={location} onChange={(e) => { setLocation(e.target.value); setScene(Object.values(engine.campaign.scenes).find((s) => s.location === e.target.value)?.id ?? '') }}>
        {allLocations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
      <select value={scene} onChange={(e) => setScene(e.target.value)}>{locationScenes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      <button className="btn btn-small" disabled={!scene} onClick={() => mutate(() => engine.goToScene(scene), `Переход выполнен: ${engine.campaign.scenes[scene]?.label ?? scene}.`)}>Перейти</button>
    </Section>
    <Section label="Флаги">
      <FlagAutocomplete value={flag} flags={allFlags} onChange={setFlag} />
      <div className="pt-debug-flag-status" aria-live="polite">
        {selectedFlag ? <>
          <span>{selectedFlag.label}</span>
          <strong className={selectedFlagActive ? 'is-on' : 'is-off'}>{selectedFlagActive ? 'Включён' : 'Выключен'}</strong>
        </> : <span className="muted small">Выберите флаг, чтобы увидеть его состояние.</span>}
      </div>
      <button className="btn btn-small" disabled={!flag.trim() || selectedFlagActive} onClick={() => mutate(() => { engine.state.flags[selectedFlagId] = true }, `Флаг «${selectedFlag?.label ?? selectedFlagId}» включён.`)}>Включить</button>
      <button className="btn btn-small" disabled={!flag.trim() || !selectedFlagActive} onClick={() => mutate(() => { delete engine.state.flags[selectedFlagId] }, `Флаг «${selectedFlag?.label ?? selectedFlagId}» снят.`)}>Снять</button>
    </Section>
    <Section label="Переменные">
      <p className="pt-debug-help">
        Переменные — значения, которые сценарии и правила кампании проверяют или меняют. Используйте имя из правила; новая переменная сама по себе ничего не меняет, пока контент её не читает. Числовые значения подходят для сравнений и прибавления; текстовые — для сравнений «равно / не равно».
      </p>
      <div className="pt-debug-variable-list">
        {variableNames.length === 0 && <span className="muted small">Кампания пока не использует переменные.</span>}
        {variableNames.map((key) => {
          const isSet = Object.prototype.hasOwnProperty.call(engine.state.variables, key)
          const current = isSet ? engine.state.variables[key] : 0
          return <div className="pt-debug-row" key={key}>
            <span><b>{key}</b>: {isSet ? String(current) : '0 (по умолчанию)'}</span>
            <button className="btn btn-small" onClick={() => { setVariable(key); setValue(String(current)) }}>Изменить</button>
          </div>
        })}
      </div>
      <div className="pt-debug-row">
        <input value={variable} onChange={(e) => setVariable(e.target.value)} placeholder="Имя из правила кампании" aria-label="Имя переменной" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Число или текст" aria-label="Значение переменной" />
      </div>
      <button className="btn btn-small" disabled={!variable.trim()} onClick={() => mutate(() => { const key = variable.trim(); const n = Number(value); engine.state.variables[key] = value.trim() !== '' && Number.isFinite(n) ? n : value }, () => `Переменная «${variable.trim()}» задана: ${String(engine.state.variables[variable.trim()])}.`)}>Задать</button>
    </Section>
    <Section label="Предметы и валюта">
      <select value={item} onChange={(e) => setItem(e.target.value)}><option value="">Предмет…</option>{Object.values(engine.campaign.entities).filter((e) => e.type === 'item').map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
      <button className="btn btn-small" disabled={!item} onClick={() => mutate(() => engine.addItem(item, Math.max(1, amount)), () => `Выдан предмет «${engine.campaign.entities[item]?.label ?? item}» ×${Math.max(1, amount)}. В инвентаре: ${engine.itemCount(item)}.`)}>Выдать</button>
      <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Количество" />
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{engine.campaign.meta.currencies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <button className="btn btn-small" onClick={() => mutate(() => engine.addItem(engine.currencyItemId(currency), Math.max(1, amount)), () => `${engine.campaign.meta.currencies.find((c) => c.id === currency)?.label ?? 'Валюта'}: добавлено ${Math.max(1, amount)}. Баланс: ${engine.currencyAmount(currency)}.`)}>Добавить валюту</button>
      {engine.state.player.inventory.length > 0 && (
        <details className="spoiler-block" style={{ marginTop: '8px' }}>
          <summary>Инвентарь героя ({engine.state.player.inventory.length})</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
            {engine.state.player.inventory.map((entry, idx) => {
              const ent = engine.campaign.entities[entry.item]
              if (!ent || entry.quantity <= 0) return null
              return (
                <div key={`${entry.item}-${idx}`} className="pt-debug-row">
                  <span>{ent.label} ×{entry.quantity}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-small" onClick={() => mutate(() => engine.removeItem(entry.item, 1), `Удален 1 «${ent.label}».`)}>-1</button>
                    <button className="btn btn-small" onClick={() => mutate(() => engine.removeItem(entry.item, entry.quantity), `Удалены все «${ent.label}».`)}>Все</button>
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </Section>
    <Section label={`Статусы героя (${(engine.state.player.statuses ?? []).length})`}>
      <div className="pt-debug-status-list">
        {(engine.state.player.statuses ?? []).length === 0 ? (
          <span className="muted small">На герое нет активных статусов.</span>
        ) : (
          (engine.state.player.statuses ?? []).map((st) => {
            const def = engine.campaign.meta.statuses?.find((s) => s.id === st.id)
            return (
              <div key={st.id} className="pt-debug-row">
                <span>
                  <b>{def?.label ?? st.id}</b> {st.severity && st.severity > 1 ? `(тяжесть ${st.severity})` : ''}{' '}
                  {st.left != null ? `(${st.left} раундов/тиков)` : ''}
                </span>
                <button
                  className="btn btn-small"
                  onClick={() => mutate(() => engine.removeStatus('player', st.id), `Статус «${def?.label ?? st.id}» снят.`)}
                >
                  Снять
                </button>
              </div>
            )
          })
        )}
      </div>
      {engine.campaign.meta.statuses && engine.campaign.meta.statuses.length > 0 && (
        <div className="pt-debug-control-row" style={{ marginTop: '6px' }}>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="">Выберите статус…</option>
            {engine.campaign.meta.statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <button
            className="btn btn-small"
            disabled={!selectedStatus}
            onClick={() =>
              mutate(() => {
                const def = engine.campaign.meta.statuses?.find((s) => s.id === selectedStatus)
                engine.applyStatus('player', selectedStatus, def?.duration)
              }, `Статус «${engine.campaign.meta.statuses?.find((s) => s.id === selectedStatus)?.label ?? selectedStatus}» применён.`)
            }
          >
            Применить
          </button>
        </div>
      )}
    </Section>
    <Section label={`Спутники (${(engine.state.party ?? []).length})`}>
      {(engine.state.party ?? []).length === 0 ? (
        <span className="muted small">Герой путешествует один.</span>
      ) : (
        (engine.state.party ?? []).map((companion) => {
          const npc = engine.campaign.entities[companion.entity]
          return (
            <div key={companion.entity} className="pt-debug-row">
              <span>{npc?.label ?? companion.entity} (HP: {companion.hp}/{companion.max_hp})</span>
              <button
                className="btn btn-small"
                onClick={() => mutate(() => engine.leaveParty(companion.entity), `Спутник «${npc?.label ?? companion.entity}» покинул группу.`)}
              >
                Исключить
              </button>
            </div>
          )
        })
      )}
      <div className="pt-debug-control-row" style={{ marginTop: '6px' }}>
        <select value={selectedPartyNpc} onChange={(e) => setSelectedPartyNpc(e.target.value)}>
          <option value="">Выбрать NPC…</option>
          {Object.values(engine.campaign.entities)
            .filter((e) => e.type === 'npc' && !(engine.state.party ?? []).some((c) => c.entity === e.id))
            .map((npc) => (
              <option key={npc.id} value={npc.id}>{npc.label}</option>
            ))}
        </select>
        <button
          className="btn btn-small"
          disabled={!selectedPartyNpc}
          onClick={() =>
            mutate(() => {
              engine.joinParty(selectedPartyNpc)
              setSelectedPartyNpc('')
            }, `NPC «${engine.campaign.entities[selectedPartyNpc]?.label ?? selectedPartyNpc}» присоединился к группе.`)
          }
        >
          В группу
        </button>
      </div>
    </Section>
    <Section label="Герой">
      <button className="btn btn-small" onClick={() => mutate(() => { engine.state.player.hp = engine.state.player.max_hp; engine.state.player.mp = engine.state.player.max_mp; for (const n of engine.campaign.meta.needs) engine.state.player.needs[n.id] = n.max }, 'Здоровье, магия и потребности восстановлены.')}>Вылечить и восстановить потребности</button>
      <div className="pt-debug-help">Персонаж не погибает от урона, истощения и других игровых причин. «Мгновенное поражение» в этой панели по-прежнему работает. Настройка действует только в плейтесте.</div>
      <label className="pt-debug-immortality"><input type="checkbox" checked={engine.debugInvincible} onChange={(e) => mutate(() => { engine.debugInvincible = e.target.checked }, e.target.checked ? 'Бессмертие персонажа включено.' : 'Бессмертие персонажа выключено.')} /><span>Бессмертие персонажа</span></label>
      <div className="pt-debug-setting">
        <label className="pt-debug-setting-label" htmlFor="pt-debug-skill">Навык героя</label>
        <div className="pt-debug-control-row">
          <select id="pt-debug-skill" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Навык героя">
            {Object.keys(engine.state.player.skills).map((s) => <option key={s} value={s}>{engine.campaign.meta.skills?.find((x) => x.id === s)?.label ?? s}</option>)}
          </select>
          <input type="number" min="0" max="100" value={engine.state.player.skills[skill] ?? 0} onChange={(e) => mutate(() => { engine.state.player.skills[skill] = Math.max(0, Math.min(100, Number(e.target.value))) }, `Навык изменён: ${engine.campaign.meta.skills?.find((x) => x.id === skill)?.label ?? skill}.`)} aria-label="Значение навыка, процентов" />
          <span>%</span>
        </div>
        <p className="pt-debug-help">Дубины, копья и кулачный бой — навыки. Число задаёт целевое значение броска d100: чем оно выше, тем легче пройти проверку. Изменение действует только в этом плейтесте.</p>
      </div>
      <div className="pt-debug-setting">
        <label className="pt-debug-setting-label" htmlFor="pt-debug-stat">Характеристика героя</label>
        <div className="pt-debug-control-row">
          <select id="pt-debug-stat" value={stat} onChange={(e) => setStat(e.target.value)} aria-label="Характеристика героя">
            {Object.keys(engine.state.player.stats).map((s) => <option key={s} value={s}>{STAT_LABELS[s] ? `${STAT_LABELS[s]} (${s})` : s}</option>)}
          </select>
          <input type="number" value={engine.state.player.stats[stat as keyof typeof engine.state.player.stats] ?? 0} onChange={(e) => mutate(() => {
            const stats = engine.state.player.stats
            stats[stat as keyof typeof stats] = Number(e.target.value)
            if (stat === 'CON' || stat === 'SIZ') { const max = derivedHP(stats); engine.state.player.max_hp = max; engine.state.player.hp = Math.min(engine.state.player.hp, max) }
            if (stat === 'POW') { const max = derivedMP(stats); engine.state.player.max_mp = max; engine.state.player.mp = Math.min(engine.state.player.mp, max) }
          }, `Характеристика ${STAT_LABELS[stat] ?? stat} изменена.`)} aria-label={`Значение ${STAT_LABELS[stat] ?? stat}`} />
        </div>
        <p className="pt-debug-help">CON + SIZ определяют максимум HP, POW — максимум MP, DEX влияет на порядок хода, STR + SIZ — на бонус урона, STR/SIZ/DEX — на движение. INT и CHA хранятся в листе героя, но пока не участвуют в автоматических проверках ядра. Изменения действуют только в плейтесте.</p>
      </div>
    </Section>
    <Section label="Бой">
      {engine.combat ? <>
        <button className="btn btn-small" disabled={!!engine.combat.result} onClick={() => mutate(() => {
          const combat = engine.combat!
          for (const c of combat.combatants) if (c.side === 'enemy') { c.hp = 0; c.dead = true; engine.state.dead_entities.push(c.entityId) }
          combat.result = 'victory'
          engine.onCombatResolve(combat.def.on_victory ?? [])
        }, 'В бою одержана мгновенная победа.')}>Мгновенная победа</button>
        <button className="btn btn-small" disabled={!!engine.combat.result} onClick={() => mutate(() => { engine.combat!.result = 'defeat'; engine.gameOver('death', 'Поражение в режиме отладки.', true) }, 'Плейтест завершён поражением.')}>Мгновенное поражение</button>
      </> : <span className="muted small">Сейчас бой не идёт.</span>}
    </Section>
    <Section label="Время и погода">
      <button className="btn btn-small" onClick={() => mutate(() => engine.advanceTicks(1), 'Время продвинуто на 1 тик.')}>+1 тик</button>
      <button className="btn btn-small" onClick={() => mutate(() => engine.advanceTicks(engine.campaign.meta.ticks_per_day), 'Время продвинуто на 1 день.')}>+1 день</button>
      <select value={engine.state.weather ?? ''} onChange={(e) => mutate(() => { engine.state.weather = e.target.value || undefined }, `Погода установлена: ${engine.campaign.meta.weathers?.find((w) => w.id === e.target.value)?.label ?? 'Ясно'}.`)}><option value="">Ясно</option>{(engine.campaign.meta.weathers ?? []).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
      {(['morning', 'day', 'evening', 'night'] as const).map((period) => <button key={period} className="btn btn-small" onClick={() => mutate(() => {
        const clock = engine.campaign.meta.time_of_day ?? { morning: 6, day: 10, evening: 18, night: 22 }
        const hour = clock[period]
        const baseTick = Math.floor(engine.state.tick / engine.campaign.meta.ticks_per_day) * engine.campaign.meta.ticks_per_day
        engine.state.tick = baseTick + hour
      }, `Время переключено: ${{ morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' }[period]}.`)}>{{ morning: 'Утро', day: 'День', evening: 'Вечер', night: 'Ночь' }[period]}</button>)}
    </Section>
    <Section label={`Квесты (${quests.length})`}>
      {quests.length === 0 ? <span className="muted small">В кампании нет квестов.</span> : (
        <div className="pt-debug-quest-list">
          {quests.map(([id, q]) => <div className="pt-debug-quest-row" key={id}>
            <label><span>{q.label}</span><select value={engine.state.quests[id]?.stage ?? ''} onChange={(e) => mutate(() => engine.advanceQuestTo(id, e.target.value), `Квест «${q.label}»: стадия «${q.stages.find((s) => s.id === e.target.value)?.label ?? e.target.value}».`)}>
              <option value="">Стадия…</option>{q.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></label>
          </div>)}
        </div>
      )}
    </Section>
    <Section label={`Кодекс (${entries.length})`}>
      {entries.length === 0 ? <span className="muted small">В кампании нет записей кодекса.</span> : (
        <div className="pt-debug-codex-list">
          {entries.map((e) => {
            const unlocked = (engine.state.codex_unlocked ?? []).includes(e.id)
            return <button key={e.id} className="btn btn-small" disabled={unlocked} onClick={() => mutate(() => engine.unlockCodex(e.id), `Запись «${e.label}» добавлена в журнал.`)}>{unlocked ? `Уже в журнале: ${e.label}` : `Добавить в журнал: ${e.label}`}</button>
          })}
        </div>
      )}
    </Section>
    <Section label={`Лог событий (${(engine.messages ?? []).length})`}>
      <div className="pt-debug-log-list" style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '0.82rem' }}>
        {(engine.messages ?? []).length === 0 ? (
          <span className="muted small">Лог пуст.</span>
        ) : (
          (engine.messages ?? []).slice(-15).reverse().map((m, idx) => (
            <div key={idx} style={{ padding: '2px 0', borderBottom: '1px solid var(--border-soft)' }}>
              {m.text}
            </div>
          ))
        )}
      </div>
    </Section>
  </aside>
}
