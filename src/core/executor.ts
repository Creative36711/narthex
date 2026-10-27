/**
 * Контракт исполнителя — то немногое, что ядро знает о цикле.
 *
 * Ядро не спрашивает «какой сейчас рантайм» и не ветвится по нему (ADR 0002,
 * ADR 0013). Оно получает время шагом и события ввода, а отдаёт результат.
 * Пошаговый и непрерывный циклы — две реализации одного контракта.
 */
import { stateFingerprint } from './fingerprint'

/** Одно действие игрока: нажатие, а не «клавиша зажата». */
export interface ExecutorInput {
  /** id действия: `move`, `interact`, `use` — из ядра или из пака */
  readonly action: string
  /**
   * Когда внутри шага это случилось, мс от его начала.
   * Непрерывному циклу нужно, чтобы ввод не «телепортировал»; пошаговый
   * обычно получает 0 и не смотрит.
   */
  readonly at?: number
  /** Аргумент действия: направление, слот, id предмета. */
  readonly value?: number | string
}

/** Итог одного шага. */
export interface ExecutorStep {
  /** Состояние изменилось — представлению есть смысл перерисоваться. */
  readonly changed: boolean
  /** Игровое время после шага, мс. */
  readonly clock: number
}

/**
 * Исполнитель: один шаг — один вызов.
 *
 * `step` не бросает исключения на обычных игровых ситуациях: отказ действия —
 * это `changed: false` и сообщение в состоянии, а не падение. Исключение —
 * дефект кода или нарушение контракта пака.
 */
export interface Executor<State = unknown> {
  readonly state: State
  readonly paused: boolean
  /** Игровое время, мс. У пошагового цикла — тики, переведённые в мс. */
  readonly clock: number
  step(dt: number, input?: readonly ExecutorInput[]): ExecutorStep
  pause(): void
  resume(): void
  /** Пересоздать ГПСЧ: после этого прогон воспроизводим по зерну. */
  setSeed(seed: string): void
  /** Отпечаток состояния для сравнения прогонов и сред (см. fingerprint.ts). */
  fingerprint(): string
}

/** Что нужно фабрике, чтобы собрать цикл. */
export interface ExecutorOptions<State = unknown> {
  readonly seed?: string
  /** Продолжение сохранённого забега: состояние важнее зерна. */
  readonly state?: State
}

/**
 * Фабрика цикла. `cf-play` и браузер получают её снаружи и не знают, какая
 * внутри: выбор цикла — это выбор фабрики, а не ветвление в коде обвязки.
 */
export type ExecutorFactory<State = unknown> = (
  options?: ExecutorOptions<State>,
) => Executor<State>

/** Отпечаток состояния: короткая обёртка, чтобы реализации не дублировали правило. */
export function fingerprintOf(state: unknown): string {
  return stateFingerprint(state)
}
