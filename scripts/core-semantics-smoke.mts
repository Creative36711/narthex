/**
 * Смоук «якоря семантики ядра» (не юнит-тесты фреймворка — тот же стиль, что и
 * остальные scripts/*-smoke.mts): периодически доказывает, что ключевые
 * контракты src/core не дрейфуют. Раньше эти места приходилось перепроверять
 * чтением кода: абсолютный tick_elapsed vs «от старта» elapsed_ge, клэмпы
 * потребностей 0..max и «общий стол», клэмп HP и смерть на нуле, флаговые
 * эффекты/условия, потолок вложенности fire_rule.
 *
 * Запуск: npx tsx scripts/core-semantics-smoke.mts
 */

let failures = 0
function expect(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    console.log(`✓ ${name}`)
  } else {
    failures += 1
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── минимальная кампания-заглушка ────────────────────────────────────────────

function makeMeta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'semantics-probe',
    title: 'Семантика',
    version: '0.1.0',
    starting_tick: 16, // ненулевой старт — именно он ломал tick_elapsed vs elapsed_ge
    features: overrides.features ?? { needs: true },
    needs: [
      { id: 'hunger', label: 'Голод', max: 100, restore_per_tick: 0 },
    ],
    default_player: 'hero',
    skills: [],
    ...overrides,
  }
}

function makeCampaign(metaOverrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    meta: makeMeta(metaOverrides),
    world: { locations: [], nav: {} },
    scenes: {},
    entities: {
      hero: { id: 'hero', label: 'Герой', stats: { HP: 50, MP: 20 }, skills: {} },
    },
    rules: {},
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
  const { evalCondition } = await import('../src/core/conditions')
  const { startTick } = await import('../src/shared/types')

  type AnyEngine = InstanceType<typeof GameEngine>
  const fresh = (metaOverrides: Record<string, unknown> = {}): AnyEngine =>
    new GameEngine(makeCampaign(metaOverrides) as never)

  // ── 1. тики: tick_elapsed абсолютен, elapsed_ge — от начала забега ─────────
  {
    const eng = fresh()
    eng.state.tick = 100
    const st = startTick(eng.campaign.meta) // = 16 (starting_tick)
    expect('startTick читает starting_tick', st === 16, `st=${st}`)
    expect(
      'tick_elapsed сравнивает с абсолютным тиком (граница)',
      evalCondition({ type: 'tick_elapsed', min_tick: 100 } as never, eng) === true &&
        evalCondition({ type: 'tick_elapsed', min_tick: 101 } as never, eng) === false,
    )
    expect(
      'elapsed_ge считает «прошло с начала забега» (tick − startTick)',
      evalCondition({ type: 'elapsed_ge', min: 84 } as never, eng) === true &&
        evalCondition({ type: 'elapsed_ge', min: 85 } as never, eng) === false,
      '100-16=84: min 84 истинно, min 85 ложно',
    )
  }

  // ── 2. флаговые эффекты и условия ──────────────────────────────────────────
  {
    const eng = fresh()
    eng.applyEffect({ type: 'set_flag', flag: 'probe' } as never)
    const afterSet = !!eng.state.flags['probe'] &&
      evalCondition({ type: 'flag_set', flag: 'probe' } as never, eng) === true &&
      evalCondition({ type: 'flag_not_set', flag: 'probe' } as never, eng) === false
    eng.applyEffect({ type: 'clear_flag', flag: 'probe' } as never)
    const afterClear = !eng.state.flags['probe'] &&
      evalCondition({ type: 'flag_set', flag: 'probe' } as never, eng) === false &&
      evalCondition({ type: 'flag_not_set', flag: 'probe' } as never, eng) === true
    expect('set_flag ставит флаг; flag_set/flag_not_set читают его', afterSet)
    expect('clear_flag снимает флаг', afterClear)
  }

  // ── 3. потребности: клэмп 0..max, «общий стол», feature-gate ──────────────
  {
    const eng = fresh()
    eng.state.player.needs['hunger'] = 30
    eng.changeNeed('hunger', 95)
    expect('changeNeed клэмпит сверху к max', eng.state.player.needs['hunger'] === 100,
      `hunger=${eng.state.player.needs['hunger']}`)
    eng.changeNeed('hunger', -160)
    expect('changeNeed клэмпит снизу к 0 (смерть/правило нуля отдельно)', eng.state.player.needs['hunger'] === 0,
      `hunger=${eng.state.player.needs['hunger']}`)

    // «общий стол»: напарник, отслеживающий потребность, делит рост; убыль — личная
    const eng2 = fresh()
    eng2.state.player.needs['hunger'] = 10
    ;(eng2.state as never)['party'] = [{ entity: 'npc_comp', label: 'Сосед', needs: { hunger: 40 } }]
    eng2.changeNeed('hunger', 20)
    const party = (eng2.state as unknown as { party: Array<{ needs: Record<string, number> }> }).party
    expect('рост потребности делится с напарником', eng2.state.player.needs['hunger'] === 30 && party[0]!.needs['hunger'] === 60,
      `hero=${eng2.state.player.needs['hunger']} comp=${party[0]!.needs['hunger']}`)
    eng2.changeNeed('hunger', -5)
    expect('убыль потребности напарнику не передаётся', party[0]!.needs['hunger'] === 60,
      `comp=${party[0]!.needs['hunger']}`)

    // feature-гейт: без включённой механики потребность не движется
    const eng3 = fresh({ features: {}, needs: [] })
    eng3.state.player.needs['hunger'] = 42
    eng3.changeNeed('hunger', 10)
    expect('без feature «needs» changeNeed — no-op', eng3.state.player.needs['hunger'] === 42,
      `hunger=${eng3.state.player.needs['hunger']}`)
  }

  // ── 4. HP: клэмп к max, смерть на нуле ─────────────────────────────────────
  {
    const eng = fresh()
    eng.state.player.hp = 50
    eng.state.player.max_hp = 60
    eng.changeHp(25)
    expect('changeHp клэмпит к max_hp', eng.state.player.hp === 60, `hp=${eng.state.player.hp}`)
    eng.changeHp(-200)
    expect('HP ≤ 0 → game_over', eng.state.player.hp <= 0 && !!eng.state.game_over,
      `hp=${eng.state.player.hp} game_over=${JSON.stringify(eng.state.game_over)}`)

    // неубывание: лечение не снимает game_over (смерть — конец забега)
    eng.changeHp(10)
    expect('после game_over лечение забега не воскрешает', !!eng.state.game_over,
      `game_over=${JSON.stringify(eng.state.game_over)}`)
  }

  // ── 5. fire_rule: один вложенный вызов разрешён, второй обрезается ─────────
  {
    const camp = makeCampaign()
    camp.rules = {
      rule_a: { conditions: [], effects: [{ type: 'set_flag', flag: 'A' }, { type: 'fire_rule', rule: 'rule_b' }] },
      rule_b: { conditions: [], effects: [{ type: 'set_flag', flag: 'B' }, { type: 'fire_rule', rule: 'rule_c' }] },
      rule_c: { conditions: [], effects: [{ type: 'set_flag', flag: 'C' }] },
    }
    const eng = new GameEngine(camp as never)
    eng.applyEffects([{ type: 'fire_rule', rule: 'rule_a' }] as never)
    expect(
      'цепочка A→B срабатывает, третий уровень (C) обрезан потолком вложенности',
      !!eng.state.flags['A'] && !!eng.state.flags['B'] && !eng.state.flags['C'],
      `flags=${Object.keys(eng.state.flags).join(',') || '-'}`,
    )
  }

  console.log(failures === 0 ? '\nвсе якоря зелёные' : `\n${failures} якорь(ей) упал(и)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('смоук упал целиком:', e)
  process.exit(1)
})
