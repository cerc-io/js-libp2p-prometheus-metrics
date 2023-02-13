import type { CalculatedMetricOptions, Counter, CounterGroup, Metric, MetricGroup, MetricOptions, Metrics } from '@libp2p/interface-metrics'
import promImport, { RegistryType, GaugeType, CounterType } from 'promjs'
import type { MultiaddrConnection, Stream, Connection } from '@libp2p/interface-connection'
import type { Duplex } from 'it-stream-types'
import each from 'it-foreach'
import { PrometheusMetric } from './metric.js'
import { PrometheusMetricGroup } from './metric-group.js'
import { PrometheusCounter } from './counter.js'
import { PrometheusCounterGroup } from './counter-group.js'
import { logger } from '@libp2p/logger'

const log = logger('libp2p:prometheus-metrics')

// metrics are global
const metrics = new Map<string, any>()

type Libp2pCollectorType = 'gauge' | 'counter'

type CollectorForType<T extends Libp2pCollectorType> =
  T extends 'gauge' ? GaugeType :
    T extends 'counter' ? CounterType :
      never

interface RegistryItem<T extends Libp2pCollectorType> {
  [key: string]: RegistryMetricData<T>
}

type MetricsMap = {
  [K in Libp2pCollectorType]: RegistryItem<K>
}

export type { Libp2pCollectorType as CollectorType }

export interface RegistryMetricData<T extends Libp2pCollectorType> {
  type: T
  help: string
  instance: CollectorForType<T>
}

export interface PrometheusMetricsInit {
  /**
   * Use a custom registry to register metrics.
   * By default, the global registry is used to register metrics.
   */
  registry?: RegistryType

  /**
   * All metrics in prometheus are global so to prevent clashes in naming
   * we reset the global metrics registry on creation - to not do this,
   * pass true here
   */
  preserveExistingMetrics?: boolean

  /**
   * Method to calculate memory usage and update in metrics
   */
  calculateMemory?: () => Record<string, number>
}

export interface PrometheusCalculatedMetricOptions<T=number> extends CalculatedMetricOptions<T> {
  registry: RegistryType
}

export class PrometheusMetrics implements Metrics {
  private transferStats: Map<string, number>
  private readonly registry: RegistryType

  constructor (init: Partial<PrometheusMetricsInit> = {}) {
    // Workaround for using incorrect import according to promjs types
    const { default: prom } = (promImport as unknown) as { default: () => RegistryType }
    this.registry = init.registry ?? prom()

    if (init?.preserveExistingMetrics !== true) {
      log('Clearing existing metrics')
      metrics.clear()
      this.registry.clear()
    }

    // holds global and per-protocol sent/received stats
    this.transferStats = new Map()

    log('Collecting data transfer metrics')
    this.registerCounterGroup('libp2p_data_transfer_bytes_total', {
      label: 'protocol',
      calculate: () => {
        const output: Record<string, number> = {}

        for (const [key, value] of this.transferStats.entries()) {
          output[key] = value
        }

        // reset counts for next time
        this.transferStats = new Map()

        return output
      }
    })

    const calculateMemory = () => {
      const output: Record<string, number> = {}

      // TODO: Try using performance.measureUserAgentSpecificMemory()
      // https://web.dev/monitor-total-page-memory-usage/#compatibility
      const performance = window.performance as any

      // https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory
      if (performance.memory !== undefined) {
        output.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit
        output.totalJSHeapSize = performance.memory.totalJSHeapSize
        output.usedJSHeapSize = performance.memory.usedJSHeapSize
      }

      return output
    }

    log('Collecting memory metrics')
    this.registerMetricGroup('js_memory_usage_bytes', {
      label: 'memory',
      calculate: init.calculateMemory ?? calculateMemory
    })
  }

  /**
   * Increment the transfer stat for the passed key, making sure
   * it exists first
   */
  _incrementValue (key: string, value: number) {
    const existing = this.transferStats.get(key) ?? 0

    this.transferStats.set(key, existing + value)
  }

  /**
   * Override the sink/source of the stream to count the bytes
   * in and out
   */
  _track (stream: Duplex<any>, name: string) {
    const self = this

    const sink = stream.sink
    stream.sink = async function trackedSink (source) {
      await sink(each(source, buf => {
        self._incrementValue(`${name} sent`, buf.byteLength)
      }))
    }

    const source = stream.source
    stream.source = each(source, buf => {
      self._incrementValue(`${name} received`, buf.byteLength)
    })
  }

  /**
   * Run calculations in all registered metrics and updated registry data
   */
  async _updateMetrics () {
    const calculatePromises = Array.from(metrics.values(), async metric => metric.calculate())
    await Promise.all(calculatePromises)
  }

  trackMultiaddrConnection (maConn: MultiaddrConnection): void {
    this._track(maConn, 'global')
  }

  trackProtocolStream (stream: Stream, connection: Connection): void {
    if (stream.stat.protocol == null) {
      // protocol not negotiated yet, should not happen as the upgrader
      // calls this handler after protocol negotiation
      return
    }

    this._track(stream, stream.stat.protocol)
  }

  registerMetric (name: string, opts: PrometheusCalculatedMetricOptions): void
  registerMetric (name: string, opts: CalculatedMetricOptions): void
  registerMetric (name: string, opts?: MetricOptions): Metric
  registerMetric (name: string, opts: any = {}): any {
    if (name == null ?? name.trim() === '') {
      throw new Error('Metric name is required')
    }

    let metric = metrics.get(name)

    if (metrics.has(name)) {
      log('Reuse existing metric', name)

      if (opts.calculate != null) {
        metric.addCalculator(opts.calculate)
      }

      return metrics.get(name)
    }

    log('Register metric', name)
    metric = new PrometheusMetric(name, { registry: this.registry, ...opts })

    metrics.set(name, metric)

    if (opts.calculate == null) {
      return metric
    }
  }

  registerMetricGroup (name: string, opts: PrometheusCalculatedMetricOptions<Record<string, number>>): void
  registerMetricGroup (name: string, opts: CalculatedMetricOptions<Record<string, number>>): void
  registerMetricGroup (name: string, opts?: MetricOptions): MetricGroup
  registerMetricGroup (name: string, opts: any = {}): any {
    if (name == null ?? name.trim() === '') {
      throw new Error('Metric group name is required')
    }

    let metricGroup = metrics.get(name)

    if (metricGroup != null) {
      log('Reuse existing metric group', name)

      if (opts.calculate != null) {
        metricGroup.addCalculator(opts.calculate)
      }

      return metricGroup
    }

    log('Register metric group', name)
    metricGroup = new PrometheusMetricGroup(name, { registry: this.registry, ...opts })

    metrics.set(name, metricGroup)

    if (opts.calculate == null) {
      return metricGroup
    }
  }

  registerCounter (name: string, opts: PrometheusCalculatedMetricOptions): void
  registerCounter (name: string, opts: CalculatedMetricOptions): void
  registerCounter (name: string, opts?: MetricOptions): Counter
  registerCounter (name: string, opts: any = {}): any {
    if (name == null ?? name.trim() === '') {
      throw new Error('Counter name is required')
    }

    let counter = metrics.get(name)

    if (counter != null) {
      log('Reuse existing counter', name)

      if (opts.calculate != null) {
        counter.addCalculator(opts.calculate)
      }

      return metrics.get(name)
    }

    log('Register counter', name)
    counter = new PrometheusCounter(name, { registry: this.registry, ...opts })

    metrics.set(name, counter)

    if (opts.calculate == null) {
      return counter
    }
  }

  registerCounterGroup (name: string, opts: PrometheusCalculatedMetricOptions<Record<string, number>>): void
  registerCounterGroup (name: string, opts: CalculatedMetricOptions<Record<string, number>>): void
  registerCounterGroup (name: string, opts?: MetricOptions): CounterGroup
  registerCounterGroup (name: string, opts: any = {}): any {
    if (name == null ?? name.trim() === '') {
      throw new Error('Counter group name is required')
    }

    let counterGroup = metrics.get(name)

    if (counterGroup != null) {
      log('Reuse existing counter group', name)

      if (opts.calculate != null) {
        counterGroup.addCalculator(opts.calculate)
      }

      return counterGroup
    }

    log('Register counter group', name)
    counterGroup = new PrometheusCounterGroup(name, { registry: this.registry, ...opts })

    metrics.set(name, counterGroup)

    if (opts.calculate == null) {
      return counterGroup
    }
  }

  /**
   * Get metrics report in text similar to prom-client register.metrics()
   */
  async getMetrics () {
    await this._updateMetrics()
    return this.registry.metrics()
  }

  async getMetricsAsMap () {
    await this._updateMetrics()

    // Restructure registry data to Map<string, { type, instance }>
    const metricsMap = Object.values(
      // Workaround to access private data
      (this.registry as any).data as MetricsMap
    ).reduce(
      (acc: Map<string, RegistryMetricData<Libp2pCollectorType>>, typedMetrics) => {
        Object.entries(typedMetrics)
          .forEach(([name, data]) => {
            acc.set(name, data)
          })

        return acc
      },
      new Map()
    )

    return metricsMap
  }
}

export function prometheusMetrics (init?: Partial<PrometheusMetricsInit>): () => PrometheusMetrics {
  return () => {
    return new PrometheusMetrics(init)
  }
}
