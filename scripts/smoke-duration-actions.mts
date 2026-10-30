import '../packs/narrative/operations'
/**
 * Смоук «длительные действия» (dz.20): доказывает семантику движка
 * runTicksFlow/requestDurationAction/campRest без UI. Якоря:
 *  — почасовая честность: per_tick применяется за КАЖДЫЙ прожитый тик,
 *    прерывание отдаёт лишь прожитую долю;
 *  — interrupt_rule стреляет при прерывании, on_finish — только при полном завершении;
 *  — break_when останавливает цикл как прерывание;
 *  — белый список per_tick: внешние эффекты пропускаются с записью в журнал;
 *  — кламп длины в min..max и шаг step;
 *  — доступность available_when;
 *  — лагерь: окно выбора (min_ticks/max_ticks), rest/heal/grow по завершении, restore разово.
 *
 * Запуск: npm run smoke:duration-actions  (tsx scripts/smoke-duration-actions.mts)
 */

let failures = 0
function expect(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`✓ ${name}`)
  else { failures += 1; console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function makeMeta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'duration-probe',
    title: 'Длительные действия',
    version: '0.1.0',
    starting_tick: 0,
    tick_label: 'ч',
    features: { needs: true, skills: true },
    needs: [
      { id: 'rest', label: 'Бодрость', max: 100, decay_per_tick: 0, restore_per_tick: 0 },
    ],
    default_player: 'hero',
    skills: [],
    ...overrides,
  }
}

function makeCampaign(metaOverrides: Record<string, unknown> = {}, rules: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    meta: makeMeta(metaOverrides),
    world: { locations: [], nav: {} },
    scenes: {},
    entities: {
      hero: { id: 'hero', label: 'Герой', stats: { HP: 50, MP: 20 }, skills: {} },
    },
    rules,
    quests: {},
    arenas: {},
    recipes: {},
    codex: {},
    cutscenes: {},
    encounters: {},
    dialogues: {},
    themes: {},
    media: {},
  }
}

async function main(): Promise<void> {
  const { GameEngine } = await import('../src/core/engine')
  type AnyEngine = InstanceType<typeof GameEngine>
  const CAMP_LOC = { regions: [{ id: 'r1', label: 'Р', locations: [{ id: 'loc1', label: 'Свалка', camp: true, scenes: [] }] }], nav: {} }

  const fresh = (meta: Record<string, unknown> = {}, rules: Record<string, unknown> = {}): AnyEngine => {
    const eng = new GameEngine(makeCampaign(meta, rules) as never)
    // лагерь требует location с camp: true — ставим состояние напрямую
    eng.state.region = 'r1'
    eng.state.location = 'loc1'
    return eng
  }
  const withCampWorld = (eng: AnyEngine): AnyEngine => {
    ;(eng.campaign as Record<string, unknown>).world = CAMP_LOC
    return eng
  }

  // ── 1. лагерь: окно выбора с min/max, честные тики, rest/heal после ────────
  {
    const eng = withCampWorld(fresh({
      rest: { hp: '1d1' },
      camping: { ticks: 8, min_ticks: 2, max_ticks: 10 },
    }))
    eng.state.player.hp = 10
    expect('campAvailable: даёт отдохнуть', eng.campAvailable().ok === true)
    eng.requestCampRest()
    const info = eng.durationRequestInfo()
    expect('окно выбора открылось для лагеря', info !== null)
    expect('границы окна = min_ticks..max_ticks', info?.min === 2 && info?.max === 10, JSON.stringify(info))
    const tick0 = eng.state.tick
    eng.confirmDurationRequest(6)
    expect('ночлег 6 часов: tick +6', eng.state.tick - tick0 === 6, `Δtick=${eng.state.tick - tick0}`)
    expect('лечение отдыха применилось (1d1 = +1 HP)', eng.state.player.hp === 11, `hp=${eng.state.player.hp}`)
    expect('запрос закрыт после подтверждения', eng.durationRequestInfo() === null)
  }

  // ── 2. лагерь: per_tick честно почасовой + restore разово ──────────────────
  {
    const eng = withCampWorld(fresh({
      camping: { ticks: 4, restore: { rest: 10 }, per_tick: [{ type: 'change_need', need: 'rest', delta: 3 }] },
    }))
    eng.state.player.needs = { rest: 50 }
    eng.campRest(4)
    // 4 тика × +3 (per_tick почасово) + 10 разово
    expect('per_tick × N + restore разово', eng.state.player.needs.rest === 72, `need=${eng.state.player.needs.rest}`)
  }

  // ── 3. кастомное действие: реестр, окно, on_finish один раз ────────────────
  {
    const eng = fresh({
      duration_actions: [{
        id: 'nap', label: 'Дневной сон', min_ticks: 2, max_ticks: 6, step: 2,
        per_tick: [{ type: 'change_need', need: 'rest', delta: 4 }],
        on_finish: [{ type: 'set_flag', flag: 'well_rested', value: 1 }],
      }],
    })
    eng.state.player.needs = { rest: 10 }
    eng.requestDurationAction('nap')
    const info = eng.durationRequestInfo()
    expect('окно выбора кастомного действия', info?.label === 'Дневной сон' && info?.min === 2 && info?.max === 6 && info?.step === 2)
    const tick0 = eng.state.tick
    eng.confirmDurationRequest(5) // выравнивается по step=2 вверх → 6 (js round 1.5→2)
    expect('tick +6 (step=2 выровнял 5→6)', eng.state.tick - tick0 === 6, `Δtick=${eng.state.tick - tick0}`)
    expect('per_tick 6×+4 = +24', eng.state.player.needs.rest === 34, `need=${eng.state.player.needs.rest}`)
    expect('on_finish применён (флаг поставлен)', eng.state.flags?.well_rested === 1)
  }

  // ── 4. прерывание: interrupt_chance_per_tick=1 — первый же тик, правило стреляет ──
  {
    const eng = fresh({
      duration_actions: [{
        id: 'guard', label: 'Дежурство', min_ticks: 4, max_ticks: 4,
        per_tick: [{ type: 'change_need', need: 'rest', delta: 2 }],
        interrupt_chance_per_tick: 1,
        interrupt_rule: 'woke',
        on_finish: [{ type: 'set_flag', flag: 'done', value: 1 }],
      }],
    }, {
      woke: { id: 'woke', label: 'Шум', once: false, manual: true, conditions: [], effects: [{ type: 'set_flag', flag: 'interrupted', value: 1 }] },
    })
    eng.state.player.needs = { rest: 0 }
    const tick0 = eng.state.tick
    eng.requestDurationAction('guard') // min==max → старт сразу
    expect('прерывание после 1-го тика (Δtick=1)', eng.state.tick - tick0 === 1, `Δtick=${eng.state.tick - tick0}`)
    expect('прожитый тик дал свою долю (+2)', eng.state.player.needs.rest === 2, `need=${eng.state.player.needs.rest}`)
    expect('interrupt_rule сработал', eng.state.flags?.interrupted === 1)
    expect('on_finish НЕ применён при прерывании', (eng.state.flags?.done ?? 0) === 0)
  }

  // ── 5. break_when: останавливает как прерывание ─────────────────────────────
  {
    const eng = fresh({
      duration_actions: [{
        id: 'meditate', label: 'Медитация', min_ticks: 1, max_ticks: 8,
        break_when: [{ type: 'variable_compare', var: 'alarm', operator: '>=', value: 1 }],
        interrupt_rule: 'bell',
        on_finish: [{ type: 'set_flag', flag: 'zen', value: 1 }],
      }],
    }, {
      bell: { id: 'bell', label: 'Колокол', once: false, manual: true, conditions: [], effects: [{ type: 'set_flag', flag: 'bell_rang', value: 1 }] },
    })
    eng.state.variables = { alarm: 1 }
    const tick0 = eng.state.tick
    eng.requestDurationAction('meditate')
    eng.confirmDurationRequest(8)
    expect('break_when оборвал после 1 тика', eng.state.tick - tick0 === 1, `Δtick=${eng.state.tick - tick0}`)
    expect('правило прерывания из break_when сработало', eng.state.flags?.bell_rang === 1)
    expect('on_finish не применён', (eng.state.flags?.zen ?? 0) === 0)
  }

  // ── 6. белый список per_tick: запрещённые эффекты пропускаются ──────────────
  {
    const eng = fresh({
      duration_actions: [{
        id: 'dark_watch', label: 'Тёмная вахта', min_ticks: 2, max_ticks: 2,
        per_tick: [
          { type: 'change_variable', variable: 'corruption', delta: 99 }, // вне белого списка
          { type: 'change_hp', delta: 1 },                                  // в белом списке
        ],
      }],
    })
    eng.state.player.hp = 40
    eng.requestDurationAction('dark_watch')
    expect('запрещённый эффект пропущен (переменная не появилась)', (eng.state.variables?.corruption ?? 0) === 0)
    expect('разрешённый эффект пошёл 2×+1 HP', eng.state.player.hp === 42, `hp=${eng.state.player.hp}`)
    expect('в журнале есть предупреждение о белом списке',
      eng.state.log.some((l: string) => l.includes('белого списка') || l.includes('белый список')),
    )
  }

  // ── 7. кламп длины и немедленный старт через эффект start_duration_action ──
  {
    const eng = fresh({
      duration_actions: [{ id: 'read', label: 'Чтение', min_ticks: 2, max_ticks: 4 }],
    })
    const tick0 = eng.state.tick
    eng.applyEffect({ type: 'start_duration_action', action: 'read', ticks: 3 } as never)
    expect('эффект с ticks идёт сразу, +3', eng.state.tick - tick0 === 3, `Δtick=${eng.state.tick - tick0}`)
    eng.applyEffect({ type: 'start_duration_action', action: 'read', ticks: 99 } as never)
    expect('длина клапится к max=4', eng.state.tick - tick0 === 7, `Δtick=${eng.state.tick - tick0}`)
    // без ticks и min==max чинится через request; здесь min!=max — откроется окно
    eng.applyEffect({ type: 'start_duration_action', action: 'read' } as never)
    expect('без ticks открывается окно выбора', eng.durationRequestInfo() !== null)
    eng.cancelDurationRequest()
    expect('отмена окна работает', eng.durationRequestInfo() === null)
  }

  // ── 8. available_when: ложные условия запрещают действие ────────────────────
  {
    const eng = fresh({
      duration_actions: [{
        id: 'night_rite', label: 'Ночной ритуал', min_ticks: 3, max_ticks: 3,
        available_when: [{ type: 'time_of_day', value: 'night' }],
      }],
    })
    eng.state.tick = 12 // полдень
    const tick0 = eng.state.tick
    eng.requestDurationAction('night_rite', 3)
    expect('available_when=false: действие не запустилось', eng.state.tick === tick0)
  }

  // ── 9. неизвестный id — журнальная ошибка, не краш ──────────────────────────
  {
    const eng = fresh({ duration_actions: [] })
    eng.requestDurationAction('ghost')
    expect('неизвестный id: запись в журнал', eng.state.log.some((l: string) => l.includes("'ghost'")))
  }

  if (failures > 0) {
    console.error(`\n${failures} проверок упало`)
    process.exit(1)
  }
  console.log('\nВсе проверки длительных действий зелёные.')
}

await main()
