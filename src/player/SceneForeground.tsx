import type { GameEngine, SlotOccupant } from '../core/engine'
import { assetUrl, assetUrlOrNull } from '../core/loader'
import type { ItemDef, SceneDef, SlotDef, SlotUseWith } from '../shared/types'
import { LiveImg } from './frames'

type UseOption = { itemId: string; label: string; use: SlotUseWith }

interface Props {
  engine: GameEngine
  scene: SceneDef
  stateKey: string
  occupants: SlotOccupant[]
  canvas: { w: number; h: number }
  onUseRequest: (slot: SlotDef, options: UseOption[]) => void
  onInteractRequest: (item: ItemDef) => void
}

/**
 * Спрайты, портреты и невидимые точки «использовать предмет» внутри сцены.
 * Вынесено из SceneScreen: сам экран перевалил за лимит модуля, а этот слой
 * не знает ни про фон, ни про навигацию — только про сущности на сцене.
 */
export function SceneForeground({ engine, scene, stateKey, occupants, canvas, onUseRequest, onInteractRequest }: Props) {
  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  return (
    <div className="scene-foreground">
        {[...occupants]
          .filter((o): o is typeof o & { entity: NonNullable<typeof o.entity> } => o.entity != null)
          .sort((a, b) => a.slot.y + a.slot.h - (b.slot.y + b.slot.h))
          .map(({ slot, entity }) => {
            const npc = entity.type === 'npc' ? entity : null
            const item = entity.type === 'item' ? (entity as ItemDef) : null
            const forced = npc ? engine.entityState(npc.id) : undefined
            const stateOfSprite = forced ?? slot.sprite_state
            const sprite = npc
              ? (stateOfSprite && npc.scene_sprite_states?.[stateOfSprite]) || npc.scene_sprite
              : item?.scene_sprite
            const scale = slot.sprite_scale ?? 1
            const interactable = !item || engine.itemInteractable(item)
            const hasInteractChoices = !!item && interactable && engine.itemInteractOptions(item).length > 0
            const shouldBreathe = entity.type === 'npc' ? (entity.breathe !== false) : !!entity.breathe
            const isEnvironmental = slot.environmental || (!sprite && entity.type === 'item')
            const isPlainItem = entity.type === 'item' && !sprite
            const displayLabel = npc ? engine.npcLabel(npc) : entity.label
            return (
              <button
                key={`${stateKey}-${slot.id}`}
                className={`slot-hotspot slot-${entity.type} scene-slot-enter ${sprite ? 'slot-sprited' : ''}${isPlainItem ? ' slot-item-plain' : ''}${isEnvironmental ? ' slot-environmental' : ''}${!interactable ? ' slot-inert' : ''}`}
                style={{
                  left: pct(slot.x, canvas.w),
                  top: pct(slot.y, canvas.h),
                  width: pct(slot.w, canvas.w),
                  height: pct(slot.h, canvas.h),
                }}
                disabled={!interactable}
                onClick={() => {
                  engine.fireTrigger('interact', { entityId: entity.id })
                  engine.inspectEntity(entity.id)
                  // «ключ к двери» (блок 8 ТЗ): НПС — диалог, иначе при наличии
                  // подходящих предметов — модалка выбора
                  if (entity.type !== 'npc') {
                    const options = engine.slotUseOptions(slot)
                    if (options.length) {
                      onUseRequest(slot, options)
                      return
                    }
                    if (hasInteractChoices && item) {
                      onInteractRequest(item)
                      return
                    }
                  }
                  engine.interactWithSlot({ slot, entity })
                }}
                data-tip={`${displayLabel}${engine.descOf(entity.id) ? `\n${engine.descOf(entity.id)}` : ''}`}
              >
                {sprite ? (
                  <>
                    {entity.shadow !== false && <span className="sprite-shadow" />}
                    <span className="slot-sprite-box" style={{ height: `${scale * 100}%` }}>
                      <LiveImg
                        className={`slot-sprite${shouldBreathe ? ' cf-breathe' : ''}`}
                        value={sprite}
                        tickKey={stateOfSprite ?? ''}
                        urlOf={(f) => assetUrl(engine.campaign, f)}
                        alt={displayLabel}
                      />
                    </span>
                  </>
                ) : (
                  (() => {
                    const portraitSrc = npc
                      ? assetUrlOrNull(engine.campaign, npc.portrait?.neutral)
                      : null
                    if (portraitSrc) {
                      return (
                        <img
                          className="slot-portrait"
                          src={portraitSrc}
                          alt={displayLabel}
                          draggable={false}
                        />
                      )
                    }
                    if (isEnvironmental) {
                      // У хотспотов окружения и предметов без спрайта убираем любые маркеры и глифы,
                      // оставляем только аккуратную плашку по центру
                      return null
                    }
                    return (
                      <span className={`slot-marker slot-marker-${entity.type}`} aria-hidden>
                        <span className="slot-marker-glyph">◆</span>
                      </span>
                    )
                  })()
                )}
                {isEnvironmental ? (
                  <span className="slot-env-label">{displayLabel}</span>
                ) : (
                  <span className="slot-label">{displayLabel}</span>
                )}
              </button>
            )
          })}

        {/* пустые слоты с «ключом к двери» (блок 8 ТЗ): невидимые точки применения */}
        {scene.slots
          .filter((slot) => {
            const taken = occupants.some((o) => o.slot.id === slot.id && o.entity)
            return !taken && engine.slotUseOptions(slot).length > 0
          })
          .map((slot) => {
            const isEnv = !!slot.environmental
            return (
              <button
                key={slot.id}
                className={`slot-hotspot slot-usewith${isEnv ? ' slot-environmental' : ''}`}
                style={{
                  left: pct(slot.x, canvas.w),
                  top: pct(slot.y, canvas.h),
                  width: pct(slot.w, canvas.w),
                  height: pct(slot.h, canvas.h),
                }}
                onClick={() => onUseRequest(slot, engine.slotUseOptions(slot))}
                data-tip={slot.label ? `Использовать предмет: ${slot.label}` : 'Использовать предмет'}
              >
                {isEnv && <span className="slot-env-label">{slot.label || 'Использовать предмет'}</span>}
              </button>
            )
          })}
    </div>
  )
}
