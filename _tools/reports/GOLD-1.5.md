# GOLD-1.5 — Campaign ending reachability

**Verdict: PASS.** Three distinct ending data IDs were reached consecutively in one Chromium browser context; no flags, scenes, or ending states were set by the runner.

- Branch: `arena/85295e1f-narthex`
- Campaign: Каркас: Дело о седьмой помпе (`b7305faa-8e10-4d26-96bb-f1b5ed5e493f`)
- Pinned commit: `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`; archive SHA-256: `d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b`; imported tree SHA-256: `132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76`
- Browser: Chromium 131.0.6778.0; viewport: 1440×900; same tab/context for all three runs
- Imported ending data: 9; reached: 3; distinct reached IDs: 3

## Reached endings

| Ending ID | Scene | Step count | Elapsed time | Final dialogue |
|---|---|---:|---:|---|
| `ending_pump` | `scene_pump_hall` | 23 | 81.75 s | **Затвор держит. Теперь отдай сердцевину.** — “Слышал, как он сел, — по трубам слышно. Ладно. Бери сердцевину и ключ от схрона. Только не торопи воду: она помнит, кто её торопил.” |
| `ending_vein` | `scene_face` | 19 | 50.19 s | **Вложить сердцевину в стену.** — “Ты кладёшь ладонь на камень. Он тёплый и отвечает на пульс.” “Бери. И помни: я помню всех, кто брал, — и всех, кто вернул.” |
| `ending_closed` | `scene_office` | 26 | 65.85 s | **Отдать гроссбух и закрыть дело.** — “Вот и хорошо. Дело закрыто, виновный установлен, город спит.” |

## All campaign endings

| Ending ID | Status | Reason / title |
|---|---|---|
| `ending_pump` | reached | Runtime meta store contains data ID ending_pump; final screen title matched. |
| `ending_silence_kell` | unreached | Не запускался маршрут взрыва затвора с гибелью Келла; в этом прогоне выбраны другие три финала. |
| `ending_silence_stood` | unreached | Не запускался финальный разговор/проверка убеждения Келла у затвора. |
| `ending_silence_rigged` | unreached | Не собирался заряд и не выполнялся маршрут установки на замедлитель. |
| `ending_silence` | unreached | Базовая ветка «Тишина» не выбиралась; выполнены помпа, Жила и закрытие дела. |
| `ending_vein` | reached | Runtime meta store contains data ID ending_vein; final screen title matched. |
| `ending_closed` | reached | Runtime meta store contains data ID ending_closed; final screen title matched. |
| `ending_flood` | unreached | Срок 72 часа намеренно не выжидался; финал потопа не запускался. |
| `ending_death` | unreached | Смерть героя намеренно не вызывалась; это не один из трёх проверяемых маршрутов. |

## Browser diagnostics

- pageerror: **0**
- Empty-background samples: **0** / 55
- Console errors: **4**
- **ending_pump / start:** `Failed to load resource: the server responded with a status of 404 (Not Found)`
- **ending_pump / start:** `Failed to load resource: the server responded with a status of 404 (Not Found)`
- **ending_vein / start:** `Failed to load resource: the server responded with a status of 404 (Not Found)`
- **ending_closed / start:** `Failed to load resource: the server responded with a status of 404 (Not Found)`
- HTTP error responses: 4 (optional project.json 404s: 4)
- Failed requests: 3

## Final frames

- `_tools/reports/GOLD-1.5/ending_pump.png` — 1440×900, 1005536 bytes
- `_tools/reports/GOLD-1.5/ending_vein.png` — 1440×900, 1151320 bytes
- `_tools/reports/GOLD-1.5/ending_closed.png` — 1440×900, 1039890 bytes

## Acceptance gates and supplementary checks

- `npm run golden:import`: **rc=0 twice**; both imports reported the identical tree SHA-256 `132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76`.
- `npm run golden:play`: **rc=0**; the pre-existing GOLD-1.2 outputs were retained.
- `npm run check:contracts`: **rc=0**; `npm run check:pack-boundary`: **rc=0**. Protected-path diff (`src/core`, `packs`, `docs/contracts`, `public/campaigns/index.json`): **0 files**.
- `cf-play check` on `.golden/karkas`: **rc=0** both from the source CLI and from `cf-play.mjs` in the packed-and-unpacked AI kit. Static scan: 12 scenes, 5 locations, 11 dialogues, 118 Ink nodes, 0 errors and 3 unread-flag warnings (`case136_read`, `shaft_roped`, `vein_hidden`). Seeds 1–5 ended in death (four time-outs, one combat death); coverage was 4/12 reachable scenes. This seed sweep is separate from, and does not replace, the three browser UI routes above.
- Supplementary `npm run check:guide`: **rc=1** before its kit-unpack assertions, because the checked-in `public/ai/cf-play.mjs` (1,070,995 bytes; SHA-256 `87f77eadeef9ebf5a5f9149f733bfa6f88a07341ac65f7b1faa6e0cc03eb62df`) differs from a fresh source bundle (same byte count; SHA-256 `17b00fd40c11ad07d9c0d65ec3dd94608d1e1b1e8737c257d04dd36098729bf2`). The packed kit was separately unpacked and its CLI check passed as noted above. The out-of-scope `public/ai/cf-play.mjs` was not changed.

## Dialogue-choice ID convention

The pinned DlgDoc choice objects have no native stable IDs. For each intended choice, the runner resolves an auxiliary source reference in the pinned data, matches it uniquely against the currently rendered choices, records the live 0-based runtime ID as `runtime:<npc>#<node>[<live-index>]`, rechecks the indexed button text, and clicks that exact button. Selected runtime IDs and source references are in the run log; the reversible convention is documented in `docs/decisions/GOLD-1.5.md`.
