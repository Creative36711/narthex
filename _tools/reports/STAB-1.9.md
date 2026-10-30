# STAB-1.9 — refresh the published campaign-audit bundle

Date: 2026-10-30
Base SHA: `f961b9e7b16bc00988076206b538eaedfc60ffe8` (fresh `origin/main`).
Bundle-only commit: `378d07ef82583f9bbf638b9cbc8d73952f3c0f97`.

## Change

`npm run check:audit-bundle` initially found the published artifact stale against the generator. I regenerated it only with the authorized `npm run build:ai-bundle`; no hand edits were made.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| Before | 994,538 | `a175060b65e1ae13e567c2c0c73664c994a33738b0f9023b95c6b8ff18d1dce8` |
| After | 1,002,333 | `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d` |

The first mismatch was at byte `10267`. The only changed `public/ai` file is `public/ai/campaign-audit.mjs`; the generator reported its three standard non-React Ajv helper renames. No source, scripts, package metadata, golden, campaign, or contract files were changed.

## Command results

| Command | RC | Result |
|---|---:|---|
| `npm ci` | 0 | Node `v22.22.3`, npm `10.9.8`; npm reported 4 dependency advisories. |
| Initial `npm run check:audit-bundle` | 1 | Expected stale-artifact failure; old size/hash above, generated size/hash below, first differing byte 10,267. |
| First `npm run build:ai-bundle` | 0 | Standard generator produced the new artifact. |
| Post-build `npm run check:audit-bundle` | 0 | Exact byte match: 1,002,333 bytes, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`. |
| `npm run lint` | 0 | 0 errors, 1,514 warnings. |
| `npm run cf-play:negative` | 0 | The script confirmed the expected warning-only rejection in source and the checked-in cf-play executable. Both underlying checks returned rc 1, verdict `failed`, 0 errors, 1 warning, with `warning не допускается: 1`. |
| `npm run pack:ai-kit` | 0 | Packed the generated AI kit. |
| `unzip -q dist-ai/__chronicle_ai__-kit.zip -d /tmp/stab19-unpacked` | 0 | Tested the actual unpacked kit; temporary pack output was removed after tests. |
| Source `cf-play check` on `stone-tablet-siege` | 0 | Positive reference: verdict `ok`, 0 errors, 0 warnings. |
| Unpacked-kit `cf-play check` on `stone-tablet-siege` | 0 | Same positive result: verdict `ok`, 0 errors, 0 warnings. |
| Source `cf-play check` on `_tools/fixtures/cf-play-warning` | 1 | Expected negative: verdict `failed`, 0 errors, 1 warning, fatal warning diagnostic. |
| Unpacked-kit `cf-play check` on `_tools/fixtures/cf-play-warning` | 1 | Same expected negative result as source. |
| Second `npm run build:ai-bundle` | 0 | SHA-256 remained `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`. |
| `git diff --exit-code -- public/ai/campaign-audit.mjs` after second build | 0 | No byte changed. |
| `git status --porcelain -- public/ai` after second build | 0 | Empty. |
| Final `npm run check:audit-bundle` | 0 | Exact match still passes. |
| `git diff --check` | 0 | No whitespace errors. |

No other `public/ai/*.mjs` file changed. `.golden/**`, campaign fixtures, contracts, source, and generator scripts remain untouched.
