/**
 * Смоук политики намеренно отсутствующих медиа (D-076).
 *
 * Проверяет то, что раньше держал жёсткий список путей внутри браузерного
 * экзамена: объявление живёт в кампании, а не в тесте.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  classifyImageFailure,
  declaredAbsences,
  isImagePath,
  isInternalCampaign,
  normalizeAssetPath,
  splitImageFailures,
} from './visual/absence-policy.mjs'

const repoRoot = resolve(import.meta.dirname, '..')
const temp = await mkdtemp(join(tmpdir(), 'cf-absence-policy-'))

const writeJson = async (file: string, value: unknown) => {
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

try {
  // ── нормализация путей ─────────────────────────────────────────────
  assert.equal(normalizeAssetPath('/campaigns/x/assets/img/a.jpg?t=1'), 'campaigns/x/assets/img/a.jpg')
  assert.equal(normalizeAssetPath('/assets/img/a%20b.jpg'), 'assets/img/a b.jpg')
  assert.equal(isImagePath('assets/img/a.JPG'), true)
  assert.equal(isImagePath('assets/audio/a.mp3'), false)

  // ── политика на временных каталогах ────────────────────────────────
  await writeJson(join(temp, 'dev', 'dev-fixture.json'), {
    visibility: 'internal',
    known_absent_images: ['assets/img/scenes/missing.jpg'],
  })
  await writeJson(join(temp, 'showcase', 'campaign.json'), { id: 'showcase', title: 'Проект' })
  await writeJson(join(temp, 'legacy', 'smoke-fixture.json'), {
    visibility: 'internal',
    known_absent_images: ['./assets/img/x.jpg'],
  })

  assert.deepEqual(declaredAbsences(temp, 'dev'), ['assets/img/scenes/missing.jpg'])
  assert.deepEqual(declaredAbsences(temp, 'showcase'), [], 'у витрины объявлений быть не может')
  assert.deepEqual(declaredAbsences(temp, 'legacy'), ['./assets/img/x.jpg'], 'старый маркер тоже читается')
  assert.equal(isInternalCampaign(temp, 'dev'), true)
  assert.equal(isInternalCampaign(temp, 'showcase'), false)

  // ── классификация ──────────────────────────────────────────────────
  const declared = declaredAbsences(temp, 'dev')
  assert.equal(classifyImageFailure({ path: 'assets/img/scenes/missing.jpg', status: 200, contentType: 'text/html', declared }), 'declared')
  assert.equal(classifyImageFailure({ path: 'assets/img/scenes/other.jpg', status: 404, contentType: 'text/html', declared }), 'unexpected')
  assert.equal(classifyImageFailure({ path: 'assets/img/scenes/missing.jpg', status: 200, contentType: 'image/jpeg', declared }), 'stale')

  const { declaredHits, findings } = splitImageFailures([
    { path: 'assets/img/scenes/missing.jpg', status: 200, contentType: 'text/html' },
    { path: 'assets/img/scenes/typo.jpg', status: 404, contentType: 'text/html' },
  ], declared)
  assert.equal(declaredHits.length, 1)
  assert.equal(findings.length, 1)
  assert.equal(findings[0]!.path, 'assets/img/scenes/typo.jpg')

  // ── витринный проект строгий: у fmv-crossing маркера нет ───────────
  const campaignsRoot = join(repoRoot, 'public/campaigns')
  assert.deepEqual(declaredAbsences(campaignsRoot, 'fmv-crossing'), [], 'витрина не объявляет отсутствий')
  assert.equal(isInternalCampaign(campaignsRoot, 'fmv-crossing'), false)
  assert.equal(classifyImageFailure({
    path: 'assets/img/scenes/anything.jpg',
    status: 404,
    contentType: 'text/html',
    declared: declaredAbsences(campaignsRoot, 'fmv-crossing'),
  }), 'unexpected', 'любое отсутствие у витрины — находка')

  // ── реальные полигоны объявляют ровно то, чего нет ─────────────────
  for (const id of ['ash-of-caerden', 'ash-of-caerden-adventure']) {
    const list = declaredAbsences(campaignsRoot, id)
    assert.equal(list.length, 27, `${id}: ожидались 27 объявленных отсутствий, получено ${list.length}`)
    for (const ref of list) {
      assert.ok(ref.startsWith('assets/'), `${id}: ${ref} вне assets/`)
      assert.equal(existsSync(join(campaignsRoot, id, ref)), false, `${id}: ${ref} объявлен отсутствующим, но существует`)
    }
  }

  console.log('✓ smoke:absence-policy — объявления читаются из кампании, витрина остаётся строгой')
} finally {
  await rm(temp, { recursive: true, force: true })
}
