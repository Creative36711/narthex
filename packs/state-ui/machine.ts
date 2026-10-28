import type { StateMachineDefinition } from './types'

/** Apply exactly one named event; ambiguous or unavailable events fail loudly. */
export function advanceState(
  machine: StateMachineDefinition,
  currentState: string,
  event: string,
): string {
  if (!Object.hasOwn(machine.states, currentState)) {
    throw new TypeError(`Unknown current state "${currentState}" in machine "${machine.id}".`)
  }
  const matches = machine.transitions.filter((transition) =>
    transition.from === currentState && transition.event === event,
  )
  if (matches.length === 0) {
    throw new TypeError(`No transition for event "${event}" from state "${currentState}".`)
  }
  if (matches.length > 1) {
    throw new TypeError(`Ambiguous transition for event "${event}" from state "${currentState}".`)
  }
  return matches[0]!.to
}
