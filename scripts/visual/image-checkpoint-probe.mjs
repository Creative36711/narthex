#!/usr/bin/env node
import assert from 'node:assert/strict'
import { launchChromium, chromiumVersion } from './local-browser.mjs'
import { IMAGE_CHECKPOINT_BUDGET_MS, observeImageCheckpoint } from './image-checkpoint.mjs'

const selected = process.argv[2] || 'all'
const definitions = [
  { id: 'temporary', repetitions: 8 },
  { id: 'persistent', repetitions: 1 },
  { id: 'empty-src', repetitions: 1 },
  { id: 'healthy', repetitions: 1 },
]
const cases = selected === 'all' ? definitions : definitions.filter((definition) => definition.id === selected)
assert.ok(cases.length, `unknown case ${selected}; use all, temporary, persistent, empty-src, or healthy`)

const browser = await launchChromium()
const context = await browser.newContext()
const attempts = []
try {
  for (const definition of cases) {
    for (let attempt = 1; attempt <= definition.repetitions; attempt++) {
      const page = await context.newPage()
      await page.route('https://image-probe.invalid/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body>not an image</body></html>',
      }))
      await page.setContent('<!doctype html><html><body></body></html>', { waitUntil: 'domcontentloaded' })
      await page.evaluate(({ kind, repetition }) => {
        const image = document.createElement('img')
        image.id = 'probe-image'
        const addFallback = () => {
          const fallback = document.createElement('div')
          fallback.id = 'probe-fallback'
          fallback.textContent = `fallback-${kind}`
          document.body.append(fallback)
        }
        document.body.append(image)

        if (kind === 'temporary') {
          image.addEventListener('error', () => requestAnimationFrame(() => {
            addFallback()
            image.remove()
          }), { once: true })
          image.src = `https://image-probe.invalid/temporary-${repetition}.png`
        } else if (kind === 'persistent') {
          image.addEventListener('error', () => requestAnimationFrame(addFallback), { once: true })
          image.src = `https://image-probe.invalid/persistent-${repetition}.png`
        } else if (kind === 'empty-src') {
          image.setAttribute('src', '')
          requestAnimationFrame(() => {
            addFallback()
            image.remove()
          })
        } else if (kind === 'healthy') {
          image.addEventListener('load', () => requestAnimationFrame(addFallback), { once: true })
          const canvas = document.createElement('canvas')
          canvas.width = 1
          canvas.height = 1
          canvas.getContext('2d').fillRect(0, 0, 1, 1)
          image.src = canvas.toDataURL('image/png')
        }
      }, { kind: definition.id, repetition: attempt })

      if (definition.id === 'healthy') {
        await page.waitForFunction(() => {
          const image = document.querySelector('#probe-image')
          return image?.complete && image.naturalWidth > 0
        }, undefined, { timeout: 1000 })
      }

      const { checkpoint, settled, timing } = await observeImageCheckpoint(page, {
        inspectImages: true,
        timeoutMs: IMAGE_CHECKPOINT_BUDGET_MS,
      })
      const post = await page.evaluate(() => ({
        fallbackVisible: !!document.querySelector('#probe-fallback'),
        imagePresent: !!document.querySelector('#probe-image'),
      }))
      const finding = checkpoint.brokenImages > 0
        || checkpoint.emptySrcImages > 0
        || settled.brokenImages > 0
        || settled.emptySrcImages > 0
      attempts.push({
        kind: definition.id,
        checkpointBroken: checkpoint.brokenImages,
        checkpointEmptySrc: checkpoint.emptySrcImages,
        settledBroken: settled.brokenImages,
        settledEmptySrc: settled.emptySrcImages,
        ...post,
        finding,
        timing,
      })
      await page.close()
    }
  }
} finally {
  await context.close()
  await browser.close()
}

for (const definition of cases) {
  const rows = attempts.filter((attempt) => attempt.kind === definition.id)
  const captured = rows.filter((attempt) => attempt.kind === 'temporary' ? attempt.checkpointBroken === 1 : true).length
  const retained = rows.filter((attempt) => attempt.finding).length
  const details = rows.map((attempt) => `${attempt.checkpointBroken}/${attempt.settledBroken} broken, empty=${attempt.checkpointEmptySrc}/${attempt.settledEmptySrc}, fallback=${attempt.fallbackVisible}`).join('; ')
  let expectedRc
  if (definition.id === 'temporary') {
    assert.equal(captured, rows.length, 'each transient broken image must be counted before its next-frame fallback')
    assert.equal(rows.filter((attempt) => attempt.settledBroken === 0).length, rows.length, 'each temporary image must be removed by its fallback')
    assert.equal(retained, rows.length, 'the frozen pre-fallback finding must remain blocking')
    expectedRc = 1
  } else if (definition.id === 'persistent') {
    assert.equal(rows[0].checkpointBroken, 1)
    assert.equal(rows[0].settledBroken, 1, 'the broken image must remain visible after fallback')
    assert.equal(rows[0].imagePresent, true)
    assert.equal(rows[0].fallbackVisible, true)
    assert.equal(rows[0].finding, true)
    expectedRc = 1
  } else if (definition.id === 'empty-src') {
    assert.equal(rows[0].checkpointEmptySrc, 1, 'empty src must be counted before fallback')
    assert.equal(rows[0].settledEmptySrc, 0, 'the next-frame fallback removes the empty-src image')
    assert.equal(rows[0].imagePresent, false)
    assert.equal(rows[0].fallbackVisible, true)
    assert.equal(rows[0].finding, true, 'the frozen empty-src finding must remain blocking')
    expectedRc = 1
  } else {
    assert.equal(rows[0].checkpointBroken, 0)
    assert.equal(rows[0].checkpointEmptySrc, 0)
    assert.equal(rows[0].settledBroken, 0)
    assert.equal(rows[0].finding, false)
    assert.equal(rows[0].fallbackVisible, true)
    expectedRc = 0
  }
  assert.ok(rows.every((attempt) => attempt.timing.budgetMs === 3000))
  assert.ok(rows.every((attempt) => attempt.timing.completeWaitMs + attempt.timing.strictWaitBudgetMs <= 3000))
  assert.ok(rows.every((attempt) => attempt.timing.totalWaitMs <= 3000))
  console.log(`IMAGE-CHECKPOINT-PROBE case=${definition.id} attempts=${rows.length}/${definition.repetitions} browser=${chromiumVersion()} results=[${details}] retained-findings=${retained}/${rows.length} wait-budget=3000ms production-rc=${expectedRc}`)
}

const productionRc = attempts.some((attempt) => attempt.finding) ? 1 : 0
process.exitCode = productionRc
