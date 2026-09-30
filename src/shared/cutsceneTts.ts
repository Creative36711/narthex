import type { CutsceneSlide } from './types'
import type { PlayerSettings } from './settings'

/** TTS озвучивает текстовые слайды без своей дорожки, даже при заданном duration. */
export function cutsceneTtsEligible(
  slide: CutsceneSlide,
  settings: Pick<PlayerSettings, 'tts_enabled' | 'voice_muted'>,
  volume: number,
): boolean {
  const videoOnly = !!slide.video && !slide.art && !slide.image
  return !slide.voice && !videoOnly && !!slide.text?.trim() && settings.tts_enabled && !settings.voice_muted && volume > 0
}
