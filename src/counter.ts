import type { CalculateMetric, Counter } from '@libp2p/interface-metrics'
import type { CounterType } from 'promjs'
import type { PrometheusCalculatedMetricOptions } from './index.js'
import { normaliseString, CalculatedMetric } from './utils.js'

export class PrometheusCounter implements Counter, CalculatedMetric {
  private readonly counter: CounterType
  private readonly calculators: CalculateMetric[]

  constructor (name: string, opts: PrometheusCalculatedMetricOptions) {
    name = normaliseString(name)
    const help = normaliseString(opts.help ?? name)
    // TODO: Use labels in counter (not used in old code)
    // const labels = opts.label != null ? [normaliseString(opts.label)] : []
    this.calculators = []

    // calculated metric
    if (opts?.calculate != null) {
      this.calculators.push(opts.calculate)
    }

    this.counter = opts.registry.create(
      'counter',
      name,
      help
    )
  }

  async calculate () {
    const values = await Promise.all(this.calculators.map(async calculate => await calculate()))
    const sum = values.reduce((acc, curr) => acc + curr, 0)

    this.counter.add(sum)
  }

  addCalculator (calculator: CalculateMetric) {
    this.calculators.push(calculator)
  }

  increment (value: number = 1): void {
    this.counter.add(value)
  }

  reset (): void {
    this.counter.reset()
  }
}
