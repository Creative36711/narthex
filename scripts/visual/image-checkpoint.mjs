export const IMAGE_CHECKPOINT_BUDGET_MS = 3000

function inspectImageDom(inspectImages) {
  const fullText = document.body.innerText
  const text = fullText.replace(/\n{2,}/g, '\n').slice(0, 1500)
  const images = [...document.querySelectorAll('img')]
  const broken = images.filter((image) => image.complete && image.naturalWidth === 0)
  const emptySrc = images.filter((image) => !(image.getAttribute('src') || '').trim())
  const brokenPortraits = [...document.querySelectorAll('.dialogue-portrait img, .message-portrait')]
    .filter((image) => image.complete && image.naturalWidth === 0)
  const result = {
    text,
    buttons: [...document.querySelectorAll('button')].map((button) => (button.innerText || '').trim()).filter(Boolean).slice(0, 40),
    brokenImages: broken.length,
    emptySrcImages: emptySrc.length,
    brokenPortraitImages: brokenPortraits.length,
    videos: document.querySelectorAll('video').length,
  }
  if (inspectImages) {
    const brokenUrls = broken.map((image) => image.currentSrc || image.src || '')
    const brokenPortraitUrls = brokenPortraits.map((image) => image.currentSrc || image.src || '')
    const emptySrcUrls = emptySrc.map((image) => image.currentSrc || image.src || '(empty src)')
    result.brokenImageUrls = brokenUrls
    result.brokenImageSources = [...new Set(brokenUrls)]
    result.brokenPortraitImageUrls = brokenPortraitUrls
    result.brokenPortraitImageSources = [...new Set(brokenPortraitUrls)]
    result.emptySrcImageUrls = emptySrcUrls
    result.emptySrcImageSources = [...new Set(emptySrcUrls)]
    result.rawNpcIds = (fullText.match(/\bnpc_[a-z0-9_-]+\b/gi) || []).length
  }
  return result
}

async function captureCheckpointBeforeFallback({ timeoutMs, inspectImages }) {
  const snapshotDom = (includeImages) => {
    const fullText = document.body.innerText
    const text = fullText.replace(/\n{2,}/g, '\n').slice(0, 1500)
    const images = [...document.querySelectorAll('img')]
    const broken = images.filter((image) => image.complete && image.naturalWidth === 0)
    const emptySrc = images.filter((image) => !(image.getAttribute('src') || '').trim())
    const brokenPortraits = [...document.querySelectorAll('.dialogue-portrait img, .message-portrait')]
      .filter((image) => image.complete && image.naturalWidth === 0)
    const result = {
      text,
      buttons: [...document.querySelectorAll('button')].map((button) => (button.innerText || '').trim()).filter(Boolean).slice(0, 40),
      brokenImages: broken.length,
      emptySrcImages: emptySrc.length,
      brokenPortraitImages: brokenPortraits.length,
      videos: document.querySelectorAll('video').length,
    }
    if (includeImages) {
      const brokenUrls = broken.map((image) => image.currentSrc || image.src || '')
      const brokenPortraitUrls = brokenPortraits.map((image) => image.currentSrc || image.src || '')
      const emptySrcUrls = emptySrc.map((image) => image.currentSrc || image.src || '(empty src)')
      result.brokenImageUrls = brokenUrls
      result.brokenImageSources = [...new Set(brokenUrls)]
      result.brokenPortraitImageUrls = brokenPortraitUrls
      result.brokenPortraitImageSources = [...new Set(brokenPortraitUrls)]
      result.emptySrcImageUrls = emptySrcUrls
      result.emptySrcImageSources = [...new Set(emptySrcUrls)]
      result.rawNpcIds = (fullText.match(/\bnpc_[a-z0-9_-]+\b/gi) || []).length
    }
    return result
  }
  const startedAt = performance.now()
  const deadline = startedAt + timeoutMs
  const brokenElements = new Set()
  const emptySrcElements = new Set()
  const brokenPortraitElements = new Set()
  const sourceByImage = new Map()

  const noteImage = (image) => {
    if (!(image instanceof HTMLImageElement)) return
    const srcAttribute = image.getAttribute('src') || ''
    const source = srcAttribute.trim() ? (image.currentSrc || image.src || srcAttribute) : '(empty src)'
    if (!sourceByImage.has(image)) sourceByImage.set(image, source)
    if (image.complete && image.naturalWidth === 0) {
      brokenElements.add(image)
      if (image.matches('.dialogue-portrait img, .message-portrait')) brokenPortraitElements.add(image)
    }
    if (!srcAttribute.trim()) emptySrcElements.add(image)
  }

  const onImageEvent = (event) => {
    noteImage(event.target)
    checkComplete()
  }
  const noteAddedImages = (node) => {
    if (!(node instanceof Element)) return
    if (node.matches('img')) noteImage(node)
    node.querySelectorAll('img').forEach(noteImage)
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') noteImage(record.target)
      for (const node of record.addedNodes) noteAddedImages(node)
    }
    checkComplete()
  })

  let completeTimer
  let resolveComplete
  let completed = false
  const completePromise = new Promise((resolve) => { resolveComplete = resolve })
  const finish = (completeReached) => {
    if (completed) return
    completed = true
    clearTimeout(completeTimer)
    resolveComplete(completeReached)
  }
  const checkComplete = () => {
    const images = [...document.images]
    images.forEach(noteImage)
    if (images.every((image) => image.complete)) {
      finish(true)
    } else if (performance.now() >= deadline) {
      finish(false)
    } else {
      clearTimeout(completeTimer)
      completeTimer = setTimeout(checkComplete, 0)
    }
  }

  document.addEventListener('load', onImageEvent, true)
  document.addEventListener('error', onImageEvent, true)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['src'], childList: true, subtree: true })
  const completeReached = timeoutMs <= 0
    ? (() => { checkComplete(); return [...document.images].every((image) => image.complete) })()
    : (checkComplete(), await completePromise)

  observer.disconnect()
  document.removeEventListener('load', onImageEvent, true)
  document.removeEventListener('error', onImageEvent, true)

  const result = snapshotDom(inspectImages)
  if (inspectImages) {
    const currentBroken = [...document.images].filter((image) => image.complete && image.naturalWidth === 0)
    const currentEmptySrc = [...document.images].filter((image) => !(image.getAttribute('src') || '').trim())
    const currentBrokenPortraits = [...document.querySelectorAll('.dialogue-portrait img, .message-portrait')]
      .filter((image) => image.complete && image.naturalWidth === 0)
    const allBroken = new Set([...brokenElements, ...currentBroken])
    const allEmptySrc = new Set([...emptySrcElements, ...currentEmptySrc])
    const allBrokenPortraits = new Set([...brokenPortraitElements, ...currentBrokenPortraits])
    const brokenUrls = [...allBroken].map((image) => sourceByImage.get(image) || image.currentSrc || image.src || '')
    const emptySrcUrls = [...allEmptySrc].map((image) => sourceByImage.get(image) || '(empty src)')
    const brokenPortraitUrls = [...allBrokenPortraits].map((image) => sourceByImage.get(image) || image.currentSrc || image.src || '')
    result.brokenImages = allBroken.size
    result.brokenImageUrls = brokenUrls
    result.brokenImageSources = [...new Set(brokenUrls)]
    result.brokenPortraitImages = allBrokenPortraits.size
    result.brokenPortraitImageUrls = brokenPortraitUrls
    result.brokenPortraitImageSources = [...new Set(brokenPortraitUrls)]
    result.emptySrcImages = allEmptySrc.size
    result.emptySrcImageUrls = emptySrcUrls
    result.emptySrcImageSources = [...new Set(emptySrcUrls)]
  }
  return {
    checkpoint: result,
    completeReached,
    completeWaitMs: Math.max(0, performance.now() - startedAt),
  }
}

export async function captureImageMetrics(page, inspectImages = false) {
  return page.evaluate(inspectImageDom, inspectImages)
}

export async function waitForImagesSuccessful(page, timeoutMs) {
  if (timeoutMs <= 0) return false
  try {
    await page.waitForFunction(
      () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      undefined,
      { timeout: timeoutMs },
    )
    return true
  } catch {
    return false
  }
}

/**
 * Attach load/error observers before waiting for `complete`, then freeze the
 * checkpoint synchronously when the condition becomes true. This captures a
 * broken image before a next-frame fallback. The strict success wait runs only
 * afterwards and receives the remainder of the same total budget.
 */
export async function observeImageCheckpoint(page, {
  inspectImages = false,
  timeoutMs = IMAGE_CHECKPOINT_BUDGET_MS,
} = {}) {
  const startedAt = Date.now()
  const initialBudgetMs = Math.max(0, timeoutMs - (Date.now() - startedAt))
  const captured = await page.evaluate(captureCheckpointBeforeFallback, {
    inspectImages,
    timeoutMs: initialBudgetMs,
  })
  const checkpointAt = Date.now()
  const remainingMs = Math.max(0, timeoutMs - (checkpointAt - startedAt))
  const strictWaitStartedAt = Date.now()
  const strictWaitReached = await waitForImagesSuccessful(page, remainingMs)
  const strictWaitFinishedAt = Date.now()
  const settled = await captureImageMetrics(page, inspectImages)
  return {
    checkpoint: captured.checkpoint,
    settled,
    timing: {
      budgetMs: timeoutMs,
      completeReached: captured.completeReached,
      completeWaitMs: captured.completeWaitMs,
      strictWaitBudgetMs: remainingMs,
      strictWaitReached,
      strictWaitElapsedMs: Math.max(0, strictWaitFinishedAt - strictWaitStartedAt),
      totalWaitMs: captured.completeWaitMs + Math.max(0, strictWaitFinishedAt - strictWaitStartedAt),
    },
  }
}
