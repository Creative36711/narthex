import type { StateMachineDefinition, StatePanelModel } from './types'

/** Read-only projection consumed by the pack panel; it never mutates machine data. */
export function buildStatePanel(
  machine: StateMachineDefinition,
  currentState: string,
): StatePanelModel {
  const current = machine.states[currentState]
  if (!current) throw new TypeError(`Unknown current state "${currentState}" in machine "${machine.id}".`)

  return {
    machineId: machine.id,
    currentState,
    currentTitle: current.title,
    terminal: current.terminal === true,
    states: Object.entries(machine.states).map(([id, state]) => ({
      id,
      title: state.title,
      current: id === currentState,
      terminal: state.terminal === true,
    })),
    availableEvents: machine.transitions
      .filter((transition) => transition.from === currentState)
      .map((transition) => ({
        event: transition.event,
        transitionId: transition.id,
        target: transition.to,
        targetTitle: machine.states[transition.to]?.title ?? transition.to,
      })),
  }
}
