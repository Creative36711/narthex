/**
 * Смоук «время на провал крафта» (экономика попыток, кейс «дыхатель»):
 *  — рецепт без fail_time_ticks: промах не тратит время (старое поведение);
 *  — рецепт с fail_time_ticks: промах проматывает тики, а успех — как раньше time_ticks;
 *  — аудит подсвечивает рецепт skill+time_ticks без fail_time_ticks и не ругает заданный.
 *
 * Запуск: npm run smoke:craft-fail-time
 */

let failures = 0
function expect(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`✓ ${name}`)
  else { failures += 1; console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function makeCampaign(): Record<string, unknown> {
  return {
    meta: {
      id: 'craft-fail-probe', title: 'Промах', version: '0.1.0',
      starting_tick: 0, tick_label: 'ч',
      features: { inventory: true, skills: true },
      needs: [], default_player: 'hero', skills: [{ id: 'repair', label: 'Ремонт' }],
    },
    world: { regions: [], nav: {} },
    scenes: {},
    entities: {
      hero: { id: 'hero', label: 'Герой', stats: { HP: 50, MP: 20 }, skills: { repair: 50 } },
      item_cloth: { id: 'item_cloth', label: 'Тряпьё', type: 'item', stackable: true },
      item_scrap: { id: 'item_scrap', label: 'Хлам', type: 'item', stackable: true },
      item_filter: { id: 'item_filter', label: 'Дыхатель', type: 'item' },
    },
    rules: {}, quests: {}, arenas: {},
    recipes: {
      recipe_free_fail: {
        id: 'recipe_free_fail', label: 'Бинт',
        inputs: [{ item: 'item_cloth', quantity: 1 }],
        skill: { id: 'repair', difficulty: 40 },
        time_ticks: 4,
        output: { item: 'item_filter', quantity: 1 },
      },
      recipe_costly_fail: {
        id: 'recipe_costly_fail', label: 'Дыхатель',
        inputs: [{ item: 'item_cloth', quantity: 1 }, { item: 'item_scrap', quantity: 1 }],
        skill: { id: 'repair', difficulty: 40 },
        time_ticks: 4, fail_time_ticks: 2,
        output: { item: 'item_filter', quantity: 1 },
      },
    },
    codex: {}, cutscenes: {}, encounters: {}, dialogues: {}, themes: {}, media: {},
  }
}

async function main(): Promise<void> {
  const { GameEngine } = await import('../src/core/engine')
  type AnyEngine = InstanceType<typeof GameEngine>
  const rig = (next: () => number): AnyEngine => {
    const eng = new GameEngine(makeCampaign() as never)
    eng.addItem('item_cloth', 5)
    eng.addItem('item_scrap', 5)
    // детерминированный бросок: 0.999 → промах, 0.0001 → успех
    ;(eng as unknown as { rng: unknown }).rng = {
      next, int: (min: number, max: number) => (next() < 0.5 ? min : max), chance: () => false,
      pick: (arr: unknown[]) => arr[0], seed: 'probe',
    }
    return eng
  }
  const has = (eng: AnyEngine, item: string, n: number): boolean =>
    (eng.state.player.inventory ?? []).filter((e: { item?: string; id?: string }) => (e.item ?? e.id) === item)
      .reduce((sum: number, e: { quantity?: number; count?: number }) => sum + (e.quantity ?? e.count ?? 1), 0) >= n

  // ── 1. без fail_time_ticks: промах не тратит время, материалы целы ────────
  {
    const eng = rig(() => 0.999)
    const t0 = eng.state.tick
    const ok = eng.craft('recipe_free_fail')
    expect('промах возвращает false', ok === false)
    expect('промах без поля не тратит время', eng.state.tick === t0, `Δtick=${eng.state.tick - t0}`)
    expect('материалы целы после промаха', has(eng, 'item_cloth', 5))
  }

  // ── 2. fail_time_ticks=2: промах тратит 2 тика и сообщает об этом ─────────
  {
    const eng = rig(() => 0.999)
    const t0 = eng.state.tick
    const ok = eng.craft('recipe_costly_fail')
    expect('промах возвращает false', ok === false)
    expect('промах тратит fail_time_ticks=2', eng.state.tick - t0 === 2, `Δtick=${eng.state.tick - t0}`)
    expect('материалы целы при платном промахе', has(eng, 'item_cloth', 5) && has(eng, 'item_scrap', 5))
    expect('сообщение сообщает цену промаха',
      eng.messages.some((m: { text: string }) => m.text.includes('Потрачено 2 тик')),
    )
  }

  // ── 3. успех: как раньше time_ticks=4, материалы списались ────────────────
  {
    const eng = rig(() => 0.0001)
    const t0 = eng.state.tick
    const ok = eng.craft('recipe_costly_fail')
    expect('успех возвращает true', ok === true)
    expect('успех тратит time_ticks=4', eng.state.tick - t0 === 4, `Δtick=${eng.state.tick - t0}`)
    expect('успех списал материалы и выдал результат', has(eng, 'item_filter', 1) && has(eng, 'item_scrap', 4) && !has(eng, 'item_scrap', 5))
  }

  // ── 4. аудит: подсветка skill+time_ticks без fail_time_ticks ──────────────
  {
    const { EditorStore } = await import('../src/editor/store')
    const { validateCampaign, formatCampaignAuditReport } = await import('../src/editor/campaignAudit')
    const buildStore = (recipe: Record<string, unknown>): InstanceType<typeof EditorStore> => {
      const store = new EditorStore()
      store.meta = { id: 'audit-probe', title: 'p', version: '0.1.0', needs: [] } as never
      store.world = { regions: [], nav: {} } as never
      store.manifest.recipes = ['r1.json']
      store.jsonFiles.set('recipes/r1.json', recipe)
      return store
    }
    const bare = { id: 'r_bare', label: 'Бинт', inputs: [{ item: 'item_cloth', quantity: 1 }], skill: { id: 'repair', difficulty: 40 }, time_ticks: 4, output: { item: 'item_filter', quantity: 1 } }
    const priced = { ...bare, id: 'r_priced', fail_time_ticks: 2 }
    const repBare = formatCampaignAuditReport(await validateCampaign(buildStore(bare)))
    const repPriced = formatCampaignAuditReport(await validateCampaign(buildStore(priced)))
    expect('аудит подсвечивает бесплатный промах', repBare.includes('fail_time_ticks'), repBare.slice(0, 300))
    expect('аудит молчит при заданном fail_time_ticks', !repPriced.includes('fail_time_ticks'))
  }

  if (failures > 0) {
    console.error(`\n${failures} проверок упало`)
    process.exit(1)
  }
  console.log('\nВсе проверки времени промаха крафта зелёные.')
}

await main()
