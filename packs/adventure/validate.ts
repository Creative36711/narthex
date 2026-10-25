import type { AdventureContent } from './types'

/** Static diagnostics behind the validator IDs declared in pack.json. */
export function validateAdventureContent(content: AdventureContent): string[] {
  const errors: string[] = []
  const start = content.scenes[content.startScene]
  if (!start) errors.push(`walk-target: unknown start scene ${content.startScene}`)
  if (start && !start.walk.nodes.some((node) => node.id === content.startNode)) {
    errors.push(`walk-target: unknown start node ${content.startNode}`)
  }

  for (const [sceneId, scene] of Object.entries(content.scenes)) {
    const nodeIds = new Set(scene.walk.nodes.map((node) => node.id))
    if (nodeIds.size !== scene.walk.nodes.length) errors.push(`walk-target: duplicate node in ${sceneId}`)
    for (const [from, to] of scene.walk.edges) {
      if (!nodeIds.has(from) || !nodeIds.has(to)) {
        errors.push(`walk-target: ${sceneId} edge ${from}→${to} has an unknown node`)
      }
    }
    const hotspotIds = new Set<string>()
    for (const hotspot of scene.hotspots) {
      if (hotspotIds.has(hotspot.id)) errors.push(`hotspot-action: duplicate ${hotspot.id} in ${sceneId}`)
      hotspotIds.add(hotspot.id)
      if (!hotspot.item && !hotspot.dialogue && !hotspot.message) {
        errors.push(`hotspot-action: ${sceneId}/${hotspot.id} has no action`)
      }
    }
  }

  const combinationIds = new Set<string>()
  for (const combination of content.combinations) {
    if (combinationIds.has(combination.id)) errors.push(`combination-recipe: duplicate ${combination.id}`)
    combinationIds.add(combination.id)
    if (combination.inputs.some((item) => !item) || !combination.output) {
      errors.push(`combination-recipe: ${combination.id} has an empty item id`)
    }
  }

  const riddleIds = new Set<string>()
  for (const riddle of content.riddles) {
    if (riddleIds.has(riddle.id)) errors.push(`riddle-solution: duplicate ${riddle.id}`)
    riddleIds.add(riddle.id)
    if (!content.scenes[riddle.scene]) errors.push(`riddle-solution: ${riddle.id} has no closeup scene`)
    if (!riddle.background) errors.push(`riddle-solution: ${riddle.id} has no background`)
    if (!riddle.solution.length) errors.push(`riddle-solution: ${riddle.id} has an empty solution`)
    if (!content.endings[riddle.ending]) errors.push(`riddle-solution: ${riddle.id} has unknown ending ${riddle.ending}`)
  }
  return errors
}
