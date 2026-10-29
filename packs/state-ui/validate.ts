import type { StateMachineDefinition } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Semantic checks that JSON Schema cannot express with local references alone. */
export function validateStateMachine(value: unknown): string[] {
  const problems: string[] = []
  if (!isRecord(value)) return ['machine must be an object']

  const machine = value as unknown as Partial<StateMachineDefinition>
  if (typeof machine.id !== 'string' || machine.id.trim() === '') problems.push('id must be a non-empty string')
  const states = machine.states
  if (!isRecord(states) || Object.keys(states).length === 0) {
    problems.push('states must be a non-empty object')
    return problems
  }

  const stateIds = Object.keys(states)
  const knownStates = new Set(stateIds)
  if (typeof machine.initial !== 'string' || !knownStates.has(machine.initial)) {
    problems.push(`initial state "${String(machine.initial)}" is not declared`)
  }

  for (const [id, state] of Object.entries(states)) {
    if (!isRecord(state) || typeof state.title !== 'string' || state.title.trim() === '') {
      problems.push(`state "${id}" must have a non-empty title`)
    }
    if (isRecord(state) && state.terminal !== undefined && typeof state.terminal !== 'boolean') {
      problems.push(`state "${id}" terminal must be boolean when specified`)
    }
  }

  if (!Array.isArray(machine.transitions)) {
    problems.push('transitions must be an array')
    return problems
  }

  const transitionIds = new Set<string>()
  const stateEvents = new Set<string>()
  const reachable = new Set<string>()
  const outgoing = new Map<string, number>()
  for (const [index, candidate] of machine.transitions.entries()) {
    if (!isRecord(candidate)) {
      problems.push(`transition ${index} must be an object`)
      continue
    }
    const { id, from, event, to } = candidate
    if (typeof id !== 'string' || id.trim() === '' || typeof from !== 'string' ||
      typeof event !== 'string' || event.trim() === '' || typeof to !== 'string') {
      problems.push(`transition ${index} must have non-empty id/from/event/to strings`)
      continue
    }
    if (transitionIds.has(id)) problems.push(`duplicate transition id "${id}"`)
    transitionIds.add(id)
    const key = `${from}\u0000${event}`
    if (stateEvents.has(key)) problems.push(`ambiguous event "${event}" from state "${from}"`)
    stateEvents.add(key)
    if (!knownStates.has(from)) problems.push(`transition "${id}" has unknown source state "${from}"`)
    if (!knownStates.has(to)) problems.push(`transition "${id}" has unknown target state "${to}"`)
    if (knownStates.has(from) && isRecord(states[from]) && states[from].terminal === true) {
      problems.push(`terminal state "${from}" has outgoing transition "${id}"`)
    }
    outgoing.set(from, (outgoing.get(from) ?? 0) + 1)
  }

  if (typeof machine.initial === 'string' && knownStates.has(machine.initial)) {
    const queue = [machine.initial]
    reachable.add(machine.initial)
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const transition of machine.transitions) {
        if (isRecord(transition) && transition.from === current && typeof transition.to === 'string' &&
          knownStates.has(transition.to) && !reachable.has(transition.to)) {
          reachable.add(transition.to)
          queue.push(transition.to)
        }
      }
    }
  }
  for (const id of stateIds) {
    if (!reachable.has(id)) problems.push(`state "${id}" is unreachable from initial state`)
    const state = states[id]
    if (isRecord(state) && state.terminal !== true && (outgoing.get(id) ?? 0) === 0) {
      problems.push(`non-terminal state "${id}" has no outgoing transition`)
    }
  }
  if (!stateIds.some((id) => isRecord(states[id]) && states[id].terminal === true)) {
    problems.push('machine must declare at least one terminal state')
  }

  return problems
}
