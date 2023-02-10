import type { CalculateMetric } from '@libp2p/interface-metrics'
import type { GaugeType, Labels } from 'promjs'

export interface CalculatedMetric <T = number> {
  addCalculator: (calculator: CalculateMetric<T>) => void
}

export const ONE_SECOND = 1000
export const ONE_MINUTE = 60 * ONE_SECOND

/**
 * See https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels
 * for rules on valid naming
 */
export function normaliseString (str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
}

/**
 * Method to decrement gauge like prom-client when metric value is not set
 * Default value is set to zero
 *
 * @param gauge
 * @param dec
 * @param labels
 */
export function decrementGauge (gauge: GaugeType, dec: number, labels?: Labels) {
  const oldMetric = gauge.get(labels)

  if (oldMetric == null) {
    return gauge.set(-dec, labels)
  }

  return gauge.sub(dec, labels)
}
