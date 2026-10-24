import type { PackSimHook, PackViewHook } from '../../../src/core/pack/host'

export interface ProbeState {
  score: number
  steps: number[]
}

export interface ProbeEvent {
  amount: number
}

export interface ProbeFrame {
  frame: number
}

export const deterministicSim: PackSimHook<ProbeState, ProbeEvent> = ({ state, event, seed }) => ({
  score: state.score + event.amount + (seed % 7),
  steps: [...state.steps, event.amount],
})

export const drawScore: PackViewHook<ProbeState, ProbeFrame> = ({ state, frame, draw }) => {
  draw({ type: 'text', text: `score=${state.score}`, frame: frame.frame })
}

export const attemptViewWrite: PackViewHook<ProbeState, ProbeFrame> = ({ state }) => {
  const mutable = state as unknown as { score: number }
  mutable.score = 999
}

export const throwingSim: PackSimHook<ProbeState, ProbeEvent> = () => {
  throw new Error('fixture sim failure')
}
