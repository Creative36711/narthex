import seedrandom from 'seedrandom'

/** Сидируемый ГПСЧ забега (ТЗ 4.10: при рестарте зерно пересоздаётся). */
export class PRNG {
  private rng: seedrandom.PRNG
  readonly seed: string

  constructor(seed?: string) {
    this.seed = seed ?? Math.random().toString(36).slice(2, 10)
    this.rng = seedrandom(this.seed)
  }

  /** [0, 1) */
  next(): number {
    return this.rng()
  }

  /** целое [min, max] включительно */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }
}
