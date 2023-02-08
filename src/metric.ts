import type { Metric, StopTimer, CalculateMetric } from '@libp2p/interface-metrics'
import type { GaugeType } from 'promjs'
import type { PrometheusCalculatedMetricOptions } from './index.js'
import { normaliseString } from './utils.js'

export class PrometheusMetric implements Metric {
  private readonly gauge: GaugeType
  private readonly calculators: CalculateMetric[]

  constructor (name: string, opts: PrometheusCalculatedMetricOptions) {
    name = normaliseString(name)
    const help = normaliseString(opts.help ?? name)
    // TODO: Use labels in counter (not used in old code)
    // const labels = opts.label != null ? [normaliseString(opts.label)] : []
    // let collect: any | undefined
    this.calculators = []

    // calculated metric
    // TODO: Implement and use collect
    // if (opts?.calculate != null) {
    //   this.calculators.push(opts.calculate)
    //   const self = this

    //   collect = async function () {
    //     const values = await Promise.all(self.calculators.map(async calculate => await calculate()))
    //     const sum = values.reduce((acc, curr) => acc + curr, 0)

    //     this.set(sum)
    //   }
    // }

    this.gauge = opts.registry.create(
      'gauge',
      name,
      help
    )
  }

  addCalculator (calculator: CalculateMetric) {
    this.calculators.push(calculator)
  }

  update (value: number): void {
    this.gauge.set(value)
  }

  increment (value: number = 1): void {
    this.gauge.add(value)
  }

  decrement (value: number = 1): void {
    this.gauge.sub(value)
  }

  reset (): void {
    this.gauge.reset()
  }

  timer (): StopTimer {
    const startDate = new Date()

    return () => {
      const timeElapsedInMs = (new Date()).getTime() - startDate.getTime()

      this.gauge.set(timeElapsedInMs / 1000)
    }
  }
}
