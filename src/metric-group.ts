import type { CalculateMetric, MetricGroup, StopTimer } from '@libp2p/interface-metrics'
import type { GaugeType } from 'promjs'
import type { PrometheusCalculatedMetricOptions } from './index.js'
import { normaliseString, CalculatedMetric } from './utils.js'

export class PrometheusMetricGroup implements MetricGroup, CalculatedMetric<Record<string, number>> {
  private readonly gauge: GaugeType
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
    //         this.set({ [label]: key }, value)
    //       })
    //     }))
    //   }
    // }

    this.gauge = opts.registry.create(
      'gauge',
      name,
      help
    )
  }

  addCalculator (calculator: CalculateMetric<Record<string, number>>) {
    this.calculators.push(calculator)
  }

  update (values: Record<string, number>): void {
    Object.entries(values).forEach(([key, value]) => {
      this.gauge.set(value, { [this.label]: key })
    })
  }

  increment (values: Record<string, number | unknown>): void {
    Object.entries(values).forEach(([key, value]) => {
      const inc = typeof value === 'number' ? value : 1

      this.gauge.add(inc, { [this.label]: key })
    })
  }

  decrement (values: Record<string, number | unknown>): void {
    Object.entries(values).forEach(([key, value]) => {
      const dec = typeof value === 'number' ? value : 1

      this.gauge.sub(dec, { [this.label]: key })
    })
  }

  reset (): void {
    this.gauge.reset()
  }

  timer (key: string): StopTimer {
    const startDate = new Date()

    return () => {
      const timeElapsedInMs = (new Date()).getTime() - startDate.getTime()

      this.gauge.set(timeElapsedInMs / 1000, {
        key: 0
      })
    }
  }
}
