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
    // let collect: any | undefined
    this.calculators = []

    // calculated metric
    // TODO: Implement and use collect
    // if (opts?.calculate != null) {
    //   this.calculators.push(opts.calculate)
    //   const self = this

    //   collect = async function () {
    //     await Promise.all(self.calculators.map(async calculate => {
    //       const values = await calculate()

    //       Object.entries(values).forEach(([key, value]) => {
    //         this.inc({ [label]: key }, value)
    //       })
    //     }))
    //   }
    // }

    this.counter = opts.registry.create(
      'counter',
      name,
      help
    )
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
    this.counter.reset()
  }
}
