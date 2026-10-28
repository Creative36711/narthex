export interface StateDefinition {
  title: string
  terminal?: boolean
}

export interface StateTransition {
  id: string
  from: string
  event: string
  to: string
}

export interface StateMachineDefinition {
  version: 1
  id: string
  initial: string
  states: Record<string, StateDefinition>
  transitions: StateTransition[]
}

export interface StatePanelModel {
  machineId: string
  currentState: string
  currentTitle: string
  terminal: boolean
  states: Array<{ id: string; title: string; current: boolean; terminal: boolean }>
  availableEvents: Array<{ event: string; transitionId: string; target: string; targetTitle: string }>
}
