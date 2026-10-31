/** Public campaign model barrel; declarations live in bounded domain modules.
 * Entity `breathe?: boolean` is declared in ./types/entities.
 * `DlgLine.speaker?: string` (Присутствие спикера) is declared in ./types/dialogue.
 */
export * from './types/foundations'
export * from './types/characters'
export * from './types/campaign-visual'
export * from './types/campaign'
export * from './types/world'
export * from './types/scene-art'
export * from './types/world-rules'
export * from './types/entities'
export * from './types/audio'
export * from './types/dialogue'
export * from './types/adventure'
export * from './types/rules'
export * from './types/generators'
export * from './types/state'
export * from './types/saves'
export * from './types/runtime'
export { featureOn } from '../core/caps'
