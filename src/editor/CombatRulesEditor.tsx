/**
 * Раздел «Механики → Правила боя» (ревизия навигации): вынесен из реестра
 * кампании в отдельный пункт меню — сюда мастер идёт за боевыми опциями:
 * хит-локации, таблицы осложнений-критов, укрытия, удар в спину, уровни
 * сложности для игрока.
 */

import { useState } from 'react'
import { Ico } from '../shared/icons'
import type { CampaignMeta } from '../shared/types'
import type { EditorStore } from './store'

export function CombatRulesEditor({ store }: { store: EditorStore }) {
  const m = store.meta
  const [, force] = useState(0)
  const commit = () => {
    store.touch('campaign.json')
    force((n) => n + 1)
  }
  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Бой и смерть</h4>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld fld-check" data-tip="Кнопка «Бежать из боя»: бесплатные атаки вслед + проверка навыка отступления">
            <input
              type="checkbox"
              checked={m.combat?.flee !== false}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.flee = e.target.checked ? undefined : false
                m.combat = Object.keys(c).length && JSON.stringify(c) !== '{}' ? c : undefined
                if (!Object.values(c).some((v) => v !== undefined)) delete m.combat
                commit()
              }}
            />
            <span>Бегство из боя разрешено</span>
          </label>
          <label className="fld" data-tip="Навык проверки отступления; пусто — dodge, а при его отсутствии — DEX×5">
            <span>Навык отступления</span>
            <input
              value={typeof m.combat?.flee === 'object' ? (m.combat.flee.skill ?? '') : ''}
              placeholder="dodge"
              onChange={(e) => {
                const c = { ...(m.combat ?? {}), flee: { skill: e.target.value || undefined } }
                if (!e.target.value) (c.flee as { skill?: string }).skill = undefined
                m.combat = c
                commit()
              }}
            />
          </label>
          <label className="fld fld-num" data-tip="Штраф каждой следующей атаки за раунд при attacks_per_round > 1">
            <span>Штраф повторных атак</span>
            <input
              type="number"
              value={m.combat?.multi_attack_penalty ?? -20}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.multi_attack_penalty = Number(e.target.value) || 0
                m.combat = c
                commit()
              }}
            />
          </label>
          <label className="fld fld-check" data-tip="Действие «Прицелиться»: тратит одну атаку, следующая — с бонусом">
            <input
              type="checkbox"
              checked={m.combat?.aim !== false}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.aim = e.target.checked ? undefined : false
                m.combat = c
                commit()
              }}
            />
            <span>Прицельные атаки</span>
          </label>
          <label className="fld fld-num" data-tip="Бонус за прицеливание (по умолчанию +20%)">
            <span>Бонус прицеливания</span>
            <input
              type="number"
              value={typeof m.combat?.aim === 'object' ? (m.combat.aim.bonus ?? 20) : 20}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.aim = { bonus: Number(e.target.value) || 0 }
                m.combat = c
                commit()
              }}
            />
          </label>
          <label className="fld fld-check" data-tip="Уход из угрожаемого гекса провоцирует бесплатную атаку врага">
            <input
              type="checkbox"
              checked={m.combat?.opportunity_attacks !== false}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.opportunity_attacks = e.target.checked ? undefined : false
                m.combat = c
                commit()
              }}
            />
            <span>Атаки возможности</span>
          </label>
          <label className="fld" data-tip="Скрытность: красться (сцена), прятаться и внезапные атаки (бой). Поля ниже — навыки скрытности и внимательности.">
            <span>Скрытность</span>
            <select
              value={m.stealth ? 'on' : 'off'}
              onChange={(e) => {
                if (e.target.value === 'on') m.stealth = { skill: 'stealth', perception_skill: 'perception' }
                else delete m.stealth
                commit()
              }}
            >
              <option value="off">Выключена (умолчание)</option>
              <option value="on">Включена (стелс-механики)</option>
            </select>
          </label>
          {m.stealth && (
            <>
              <label className="fld">
                <span>Навык скрытности</span>
                <input value={m.stealth.skill ?? 'stealth'} onChange={(e) => ((m.stealth!.skill = e.target.value || 'stealth'), commit())} />
              </label>
              <label className="fld" data-tip="Навык обнаружения NPC; у NPC без него берётся INT×2, либо поле perception самого NPC">
                <span>Навык внимательности</span>
                <input value={m.stealth.perception_skill ?? 'perception'} onChange={(e) => ((m.stealth!.perception_skill = e.target.value || 'perception'), commit())} />
              </label>
            </>
          )}
          <label className="fld" data-tip="instant: 0 HP = смерть. brp: тяжёлые раны (нокаут от удара ≥ ½ max HP при провале CON) и последний спасбросок CON при 0 HP">
            <span>Правила гибели</span>
            <select
              value={m.combat?.death?.mode ?? 'instant'}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.death = { ...(c.death ?? {}), mode: e.target.value as 'instant' | 'brp' }
                m.combat = c
                commit()
              }}
            >
              <option value="instant">Мгновенная смерть (умолчание)</option>
              <option value="brp">BRP: тяжёлые раны и спасброски CON</option>
            </select>
          </label>
          {m.combat?.death?.mode === 'brp' && (
            <label className="fld fld-num" data-tip="Множитель CON для спасбросков сознания/смерти (умолчание 5)">
              <span>Множитель CON</span>
              <input
                type="number" min={1}
                value={m.combat.death.con_multiplier ?? 5}
                onChange={(e) => ((m.combat!.death!.con_multiplier = Math.max(1, Number(e.target.value) || 5)), commit())}
              />
            </label>
          )}
          <label className="fld fld-check" data-tip="Дальнобойная атака по бойцу на гексе укрытия (разметка кистью «Укрытие» в редакторе арены) получает штраф">
            <input
              type="checkbox"
              checked={!!m.combat?.cover}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.cover = e.target.checked ? true : undefined
                m.combat = c
                commit()
              }}
            />
            <span>Укрытия на арене</span>
          </label>
          {!!m.combat?.cover && (
            <label className="fld fld-num" data-tip="Штраф стрелку по цели в укрытии (отрицательное число; умолчание −20)">
              <span>Штраф стрелку</span>
              <input
                type="number" max={0}
                value={typeof m.combat?.cover === 'object' ? (m.combat.cover.penalty ?? -20) : -20}
                onChange={(e) => {
                  const c = { ...(m.combat ?? {}) }
                  c.cover = { penalty: Math.min(0, Number(e.target.value) || -20) }
                  m.combat = c
                  commit()
                }}
              />
            </label>
          )}
          <label className="fld fld-check" data-tip="Атака из задней дуги цели (за её взглядом) лишает цель защиты — классический удар в спину / обход с фланга">
            <input
              type="checkbox"
              checked={!!m.combat?.flank}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.flank = e.target.checked ? true : undefined
                m.combat = c
                commit()
              }}
            />
            <span>Удар в спину</span>
          </label>
          {!!m.combat?.flank && (
            <>
              <label className="fld fld-num" data-tip="Ширина задней дуги в градусах (умолчание 120 — задний гекс и два задне-фланговых)">
                <span>Дуга спины, °</span>
                <input
                  type="number" min={30} max={360} step={30}
                  value={typeof m.combat?.flank === 'object' ? (m.combat.flank.arc ?? 120) : 120}
                  onChange={(e) => {
                    const c = { ...(m.combat ?? {}) }
                    const cur = typeof c.flank === 'object' ? c.flank : {}
                    c.flank = { ...cur, arc: Number(e.target.value) || 120 }
                    m.combat = c
                    commit()
                  }}
                />
              </label>
              <label className="fld" data-tip="Дополнительные кости урона за удар в спину, например 1d4 (пусто — без бонуса)">
                <span>Бонус урона в спину</span>
                <input
                  value={typeof m.combat?.flank === 'object' ? (m.combat.flank.damage_bonus ?? '') : ''}
                  placeholder="1d4"
                  onChange={(e) => {
                    const c = { ...(m.combat ?? {}) }
                    const cur = typeof c.flank === 'object' ? c.flank : {}
                    c.flank = { ...cur, damage_bonus: e.target.value || undefined }
                    m.combat = c
                    commit()
                  }}
                />
              </label>
            </>
          )}
        </div>
        <div className="muted small">
          В режиме BRP «проигранный» бой с выжившим без сознания героем завершается эффектами
          «on_defeat» у конкретного start_combat — например, плен. Без них герой погибает.
        </div>
      </div>

      <CombatLuckTables m={m} commit={commit} />

      <HitLocationsTable m={m} commit={commit} />

      <DifficultyPresets m={m} commit={commit} />
    </div>
  )
}

/**
 * Уровни сложности, которые мастер предлагает игроку на экране создания героя.
 * Нет списка — сложность всегда «как задумано». Есть — игрок выбирает
 * (первый — умолчание), множители действуют весь забег.
 */
function DifficultyPresets({ m, commit }: { m: CampaignMeta; commit: () => void }) {
  const list = m.difficulties ?? []
  const seed = () => {
    m.difficulties = [
      { id: 'easy', label: 'Путник', description: 'Спокойное путешествие: враги бьют слабее, цены ниже.', enemy_damage: 0.75, prices: 0.85 },
      { id: 'normal', label: 'Искатель', description: 'Как задумано автором.' },
      { id: 'hard', label: 'Железный человек', description: 'Враги бьют сильнее, голод неумолим, автосохранений нет.', enemy_damage: 1.35, need_decay: 1.5, prices: 1.2, no_autosave: true },
    ]
    commit()
  }
  const setList = (next?: typeof list) => {
    m.difficulties = next && next.length ? next : undefined
    commit()
  }
  let uid = list.length + 1
  return (
    <div className="props-group">
      <h4>Уровни сложности</h4>
      <div className="muted small" style={{ marginBottom: 8 }}>
        По умолчанию сложность одна — «как задумали вы». Задайте уровни, и на
        создании героя игрок выберет: враги жёстче или мягче, потребности
        убывают скорее, цены кусаются, автосохранение отключено.
      </div>
      <label className="fld fld-check" data-tip="Решение мастера: предлагать ли игроку выбор сложности">
        <input
          type="checkbox"
          checked={list.length > 0}
          onChange={(e) => { if (e.target.checked) seed(); else setList(undefined) }}
        />
        <span>Игрок выбирает сложность при старте</span>
      </label>
      {list.length > 0 && (
        <>
          {list.map((d, i) => (
            <div key={d.id} className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px dashed var(--ed-paper-line)', padding: '6px 0' }}>
              <label className="fld" style={{ minWidth: 110 }}>
                <span>Название</span>
                <input value={d.label} onChange={(ev) => ((d.label = ev.target.value), commit())} />
              </label>
              <label className="fld" style={{ flex: 1, minWidth: 200 }}>
                <span>Пояснение игроку</span>
                <input value={d.description ?? ''} onChange={(ev) => ((d.description = ev.target.value || undefined), commit())} />
              </label>
              <label className="fld fld-num" data-tip="Урон врагов по герою (1 — как задумано, 0.5 — вполсилы, 1.3 — жёстче)">
                <span>Урон врагов ×</span>
                <input type="number" min={0.1} step={0.05} value={d.enemy_damage ?? 1} onChange={(ev) => { const v = Number(ev.target.value); d.enemy_damage = v && v !== 1 ? v : undefined; commit() }} />
              </label>
              <label className="fld fld-num" data-tip="Скорость убыли потребностей (1 — как задумано)">
                <span>Голод/жажда ×</span>
                <input type="number" min={0.1} step={0.1} value={d.need_decay ?? 1} onChange={(ev) => { const v = Number(ev.target.value); d.need_decay = v && v !== 1 ? v : undefined; commit() }} />
              </label>
              <label className="fld fld-num" data-tip="Цены при покупке у торговцев (1 — как задумано, 0.8 — дешевле, 1.2 — дороже)">
                <span>Цены ×</span>
                <input type="number" min={0.1} step={0.05} value={d.prices ?? 1} onChange={(ev) => { const v = Number(ev.target.value); d.prices = v && v !== 1 ? v : undefined; commit() }} />
              </label>
              <label className="fld fld-check" data-tip="На этом уровне автосохранение выключено — только ручные слоты (если мастер их не запретил)">
                <input
                  type="checkbox"
                  checked={!!d.no_autosave}
                  onChange={(ev) => ((d.no_autosave = ev.target.checked ? true : undefined), commit())}
                />
                <span>Без автосохранений</span>
              </label>
              <button className="btn btn-small ce-del" data-tip="Удалить уровень" onClick={() => { list.splice(i, 1); setList(list) }}><Ico n="close" /> </button>
            </div>
          ))}
          <button
            className="btn btn-small"
            onClick={() => {
              const base = 'difficulty'
              let id = `${base}_${uid}`
              while (list.some((d) => d.id === id)) id = `${base}_${++uid}`
              list.push({ id, label: 'Новый уровень' })
              commit()
            }}
          >
            <Ico n="plus" /> Уровень сложности
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Таблицы мастера «осложнения и удача»: что происходит бойцу при критическом
 * провале (fumble_table) и при критическом ударе (crit_table). Бросок по весам.
 */
function CombatLuckTables({ m, commit }: { m: CampaignMeta; commit: () => void }) {
  const setCombat = (patch: Partial<NonNullable<CampaignMeta['combat']>>) => {
    const c = { ...(m.combat ?? {}), ...patch }
    m.combat = c
    commit()
  }
  const fTable = m.combat?.fumble_table ?? []
  const cTable = m.combat?.crit_table ?? []
  const fumbleKinds: Array<[string, string]> = [
    ['drop_weapon', 'Роняет оружие'],
    ['stuck', 'Оружие застряло — ход потерян'],
    ['self_hit', 'Ранит себя своим уроном'],
    ['skip_next', 'Спотыкается — ход потерян'],
  ]
  const critKinds: Array<[string, string]> = [
    ['max_damage', 'Максимальный урон (броня не спасает)'],
    ['double_damage', 'Урон удвоен (броня учитывается)'],
    ['disarm', 'Разоружение цели'],
    ['status', 'Статус цели из реестра'],
  ]
  const statuses = m.statuses ?? []
  return (
    <div className="props-group">
      <h4>Таблицы мастера: осложнения и удача</h4>
      <div className="muted small" style={{ marginBottom: 8 }}>
        Срабатывают в бою при критическом провале (d100 провал) и при критическом ударе.
        Чем больше вес записи, тем чаще она выпадает. Пустые таблицы — обычные книжные исходы.
      </div>
      <details open={fTable.length > 0}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Критические провалы ({fTable.length || 'пусто'})</summary>
        {fTable.map((e, i) => (
          <div key={i} className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px dashed var(--ed-paper-line)', padding: '6px 0' }}>
            <label className="fld fld-num" data-tip="Вес записи — шанс относительно суммы весов таблицы">
              <span>Вес</span>
              <input type="number" min={1} value={e.weight} onChange={(ev) => ((e.weight = Math.max(1, Number(ev.target.value) || 1)), commit())} />
            </label>
            <label className="fld">
              <span>Что случается</span>
              <select value={e.kind} onChange={(ev) => ((e.kind = ev.target.value as typeof e.kind), commit())}>
                {fumbleKinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="fld" style={{ flex: 1, minWidth: 180 }} data-tip="Особая строка в боевом журнале (пусто — стандартная)">
              <span>Строка в журнал</span>
              <input value={e.text ?? ''} onChange={(ev) => ((e.text = ev.target.value || undefined), commit())} />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить запись" onClick={() => (fTable.splice(i, 1), setCombat({ fumble_table: fTable.length ? fTable : undefined }))}><Ico n="close" /> </button>
          </div>
        ))}
        <button className="btn btn-small" onClick={() => setCombat({ fumble_table: [...fTable, { weight: 1, kind: 'skip_next' }] })}><Ico n="plus" /> Запись осложнения</button>
      </details>
      <details open={cTable.length > 0} style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Критические успехи ({cTable.length || 'пусто'})</summary>
        {cTable.map((e, i) => (
          <div key={i} className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px dashed var(--ed-paper-line)', padding: '6px 0' }}>
            <label className="fld fld-num" data-tip="Вес записи — шанс относительно суммы весов таблицы">
              <span>Вес</span>
              <input type="number" min={1} value={e.weight} onChange={(ev) => ((e.weight = Math.max(1, Number(ev.target.value) || 1)), commit())} />
            </label>
            <label className="fld">
              <span>Что случается</span>
              <select value={e.kind} onChange={(ev) => ((e.kind = ev.target.value as typeof e.kind), commit())}>
                {critKinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            {e.kind === 'status' && (
              <>
                <label className="fld">
                  <span>Статус</span>
                  <select value={e.status ?? ''} onChange={(ev) => ((e.status = ev.target.value || undefined), commit())}>
                    <option value="">— выбрать —</option>
                    {statuses.map((st) => <option key={st.id} value={st.id}>{st.label || st.id}</option>)}
                  </select>
                </label>
                <label className="fld fld-num" data-tip="Сколько ходов держится (пусто — как у статуса в реестре)">
                  <span>Ходов</span>
                  <input type="number" min={1} value={e.duration ?? ''} onChange={(ev) => ((e.duration = Number(ev.target.value) || undefined), commit())} />
                </label>
              </>
            )}
            <label className="fld" style={{ flex: 1, minWidth: 180 }} data-tip="Особая строка в боевом журнале (пусто — стандартная)">
              <span>Строка в журнал</span>
              <input value={e.text ?? ''} onChange={(ev) => ((e.text = ev.target.value || undefined), commit())} />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить запись" onClick={() => (cTable.splice(i, 1), setCombat({ crit_table: cTable.length ? cTable : undefined }))}><Ico n="close" /> </button>
          </div>
        ))}
        <button className="btn btn-small" onClick={() => setCombat({ crit_table: [...cTable, { weight: 1, kind: 'max_damage' }] })}><Ico n="plus" /> Запись удачи</button>
      </details>
    </div>
  )
}

/**
 * Хит-локации (книжная опция, умолчание ВЫКЛ): таблица попаданий d100.
 * Мастер решает сам — включённость и содержимое таблицы целиком его.
 */
function HitLocationsTable({ m, commit }: { m: CampaignMeta; commit: () => void }) {
  const t = m.combat?.hit_locations?.table ?? []
  const setTable = (table?: typeof t) => {
    const c = { ...(m.combat ?? {}) }
    c.hit_locations = table && table.length ? { table } : undefined
    m.combat = c
    commit()
  }
  const statuses = m.statuses ?? []
  // классическая таблица гуманоида BRP — стартовая заготовка
  const seed = () => setTable([
    { from: 1, to: 15, label: 'Левая нога' },
    { from: 16, to: 30, label: 'Правая нога' },
    { from: 31, to: 45, label: 'Живот' },
    { from: 46, to: 60, label: 'Грудь' },
    { from: 61, to: 75, label: 'Левая рука' },
    { from: 76, to: 90, label: 'Правая рука' },
    { from: 91, to: 100, label: 'Голова', damage_mult: 2 },
  ])
  const covered = t.reduce((s, e) => s + Math.max(0, e.to - e.from + 1), 0)
  return (
    <div className="props-group">
      <h4>Локации попаданий</h4>
      <div className="muted small" style={{ marginBottom: 8 }}>
        Выключено по умолчанию: удар распределяется «в тело» — общая броня и урон.
        Включите, и при каждом попадании d100 выберет локацию: у неё свои множитель
        урона, броня и статусы (рассечённая рука — штрафы, крит в голову — что пропишете).
      </div>
      <label className="fld fld-check" data-tip="Решение мастера: как настроите таблицу — так и будет">
        <input
          type="checkbox"
          checked={t.length > 0}
          onChange={(e) => { if (e.target.checked) seed(); else setTable(undefined) }}
        />
        <span>Локации попаданий включены</span>
      </label>
      {t.length > 0 && (
        <>
          {covered !== 100 && (
            <div className="char-problems small" style={{ margin: '4px 0' }}>
              Диапазоны покрывают {covered} из 100 граней d100 — броски вне таблицы идут «в тело» без множителя.
            </div>
          )}
          {t.map((e, i) => (
            <div key={i} className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px dashed var(--ed-paper-line)', padding: '6px 0' }}>
              <label className="fld fld-num">
                <span>d100 от</span>
                <input type="number" min={1} max={100} value={e.from} onChange={(ev) => ((e.from = Number(ev.target.value) || 1), commit())} />
              </label>
              <label className="fld fld-num">
                <span>до</span>
                <input type="number" min={1} max={100} value={e.to} onChange={(ev) => ((e.to = Number(ev.target.value) || 100), commit())} />
              </label>
              <label className="fld" style={{ minWidth: 130 }}>
                <span>Локация</span>
                <input value={e.label} onChange={(ev) => ((e.label = ev.target.value), commit())} />
              </label>
              <label className="fld fld-num" data-tip="Множитель урона по этой локации (1 — обычный, 2 — двойной, 0.5 — половинный)">
                <span>Урон ×</span>
                <input type="number" min={0} step={0.5} value={e.damage_mult ?? 1} onChange={(ev) => ((e.damage_mult = Number(ev.target.value) || undefined), commit())} />
              </label>
              <label className="fld fld-num" data-tip="Броня локации в очках (пусто — общая броня защитника)">
                <span>Броня</span>
                <input type="number" min={0} value={e.armor ?? ''} placeholder="общая" onChange={(ev) => ((e.armor = ev.target.value === '' ? undefined : Number(ev.target.value) || 0), commit())} />
              </label>
              <label className="fld" data-tip="Статус цели при пробившем ударе по локации">
                <span>Статус при ранении</span>
                <select value={e.status_on_hit ?? ''} onChange={(ev) => ((e.status_on_hit = ev.target.value || undefined), commit())}>
                  <option value="">— нет —</option>
                  {statuses.map((st) => <option key={st.id} value={st.id}>{st.label || st.id}</option>)}
                </select>
              </label>
              <label className="fld" data-tip="Статус цели при критическом ударе по локации">
                <span>Статус при крите</span>
                <select value={e.status_on_crit ?? ''} onChange={(ev) => ((e.status_on_crit = ev.target.value || undefined), commit())}>
                  <option value="">— нет —</option>
                  {statuses.map((st) => <option key={st.id} value={st.id}>{st.label || st.id}</option>)}
                </select>
              </label>
              <label className="fld" style={{ flex: 1, minWidth: 160 }} data-tip="Особая строка в боевом журнале (пусто — «Попадание: название локации»)">
                <span>Строка в журнал</span>
                <input value={e.text ?? ''} onChange={(ev) => ((e.text = ev.target.value || undefined), commit())} />
              </label>
              <button className="btn btn-small ce-del" data-tip="Удалить локацию" onClick={() => (t.splice(i, 1), setTable(t))}><Ico n="close" /> </button>
            </div>
          ))}
          <button className="btn btn-small" onClick={() => (t.push({ from: 1, to: 10, label: 'Локация' }), commit())}>
            <Ico n="plus" /> Локация
          </button>
          <button className="btn btn-small" style={{ marginLeft: 8 }} data-tip="Заполнить классической таблицей гуманоида (ноги/живот/грудь/руки/голова ×2)" onClick={seed}>
            Классическая таблица гуманоида
          </button>
        </>
      )}
    </div>
  )
}
