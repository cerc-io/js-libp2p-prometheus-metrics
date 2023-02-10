import type { CounterGroup, CalculateMetric } from '@libp2p/interface-metrics'
import type { CounterType } from 'promjs'
import { normaliseString, CalculatedMetric } from './utils.js'
import type { PrometheusCalculatedMetricOptions } from './index.js'

export class PrometheusCounterGroup implements CounterGroup, CalculatedMetric<Record<string, number>> {
  private readonly counter: CounterType
  private readonly label: string
  private readonly calculators: Array<CalculateMetric<Record<string, number>>>

  constructor (name: string, opts: PrometheusCalculatedMetricOptions<Record<string, number>>) {
    name = normaliseString(name)
    const help = normaliseString(opts.help ?? name)
    this.label = normaliseString(opts.label ?? name)
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
    await Promise.all(this.calculators.map(async calculate => {
      const values = await calculate()

      Object.entries(values).forEach(([key, value]) => {
        this.counter.add(value, { [this.label]: key })
      })
    }))
  }

  addCalculator (calculator: CalculateMetric<Record<string, number>>) {
    this.calculators.push(calculator)
  }

  increment (values: Record<string, number | unknown>): void {
    Object.entries(values).forEach(([key, value]) => {
      const inc = typeof value === 'number' ? value : 1

      this.counter.add(inc, { [this.label]: key })
    })
  }

  reset (): void {
    this.counter.resetAll()
  }
}
