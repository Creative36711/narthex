import type { GameEngine } from '../core/engine'
import { assetUrl } from '../core/loader'
import { LiveImg } from './frames'
import type { ImageValue } from '../shared/types'

/**
 * Портрет героя (галерея/слои мастера, выбор на экране создания): стек
 * изображений с вариантом облика по состоянию. Пусто — без рендера.
 */
export function PlayerPortrait({ engine, size = 96 }: { engine: GameEngine; size?: number }) {
  const images = engine.heroPortraitImages()
  if (!images.length) return null
  return (
    <div className="hero-portrait" style={{ width: size, height: size }}>
      {images.map((img, i) => (
        <HeroPortraitFrame key={i} engine={engine} img={img} />
      ))}
    </div>
  )
}

function HeroPortraitFrame({ engine, img }: { engine: GameEngine; img: ImageValue }) {
  return <LiveImg value={img} urlOf={(frame) => assetUrl(engine.campaign, frame)} alt="" className="hero-portrait-frame" />
}
