import { runCycle, type RunResult, type Runtime } from './parity-fixture'

interface ParityBrowserApi {
  runCycle(runtime: Runtime, seed: string, dtSequence: readonly number[]): RunResult
}

declare global {
  // The browser-only bundle exposes the exact Node fixture runner to Chromium.
  var __NARTHEX_PARITY__: ParityBrowserApi
}

globalThis.__NARTHEX_PARITY__ = { runCycle }
