# NAR-1.12 — manifest order is execution order

## Decision

The manifest is the authoritative order for rules and encounter tables. The loader may fetch files concurrently, but it applies each completed result only after `Promise.all` has returned its input-ordered result array. It then records explicit `ruleOrder` and `encounterOrder` ID lists on `CampaignData`. The explicit lists matter because JavaScript enumerates integer-like object keys numerically, not in insertion order.

Rule checks and trigger dispatch traverse `ruleOrder`. Rules inserted after loading are appended after the manifest-listed rules. Encounter tables are ordered first by `manifest.encounters`, then by encounter-table files encountered in `manifest.rules` (the loader's existing compatibility behavior). Duplicate rule IDs retain the existing first-definition-wins behavior; duplicate encounter IDs resolve to the last manifest occurrence while keeping the ID's first position in the order list.

## Why

The previous loader launched one async callback per manifest file and assigned into shared `rules`/`encounters` objects as each request completed. `Promise.all` waits for all callbacks, but mutations inside those callbacks happen on completion, so network timing determined dictionary insertion order. Rule checks and trigger dispatch used `Object.values(campaign.rules)`, allowing that timing to change rule firing order, `fired_rules`, log order, and replay hashes. Encounter-table dictionary order had the same race.

## Verification

`npm run smoke:manifest-order` forces earlier manifest entries to finish last and checks ordered IDs plus rule traversal. It fails against the previous loader and passes with this decision. The phase report records the seed-7, 20-run oracle and all required gates.

## Scope assumption

The phase scope names source, probe, package registration, and this decision note, but not the tracked generated CLI bundle. For the required `node public/ai/cf-play.mjs` oracle, the bundle is rebuilt locally for validation and restored afterward; the generated bundle is therefore not a PR file. The campaign and its §2 oracle remain untouched.
