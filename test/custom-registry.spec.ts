import { expect } from 'aegir/chai'
import { prometheusMetrics } from '../src/index.js'
import promImport, { RegistryType } from 'promjs'
import { randomMetricName } from './fixtures/random-metric-name.js'

describe('custom registry', () => {
  it('should set a metric in the custom registry', async () => {
    // Workaround for using incorrect import according to promjs types
    const { default: prom } = (promImport as unknown) as { default: () => RegistryType }
    const registry = prom()

    const metricName = randomMetricName()
    const metricValue = 5

    const metrics = prometheusMetrics({ registry })()
    const metric = metrics.registerMetric(metricName)
    metric.update(metricValue)

    const customRegistryMetric = registry.get('gauge', metricName)
    expect(customRegistryMetric?.get()?.value).to.be.equal(metricValue, 'did not update custom registry')

    const internalRegistryData = await metrics.getMetricsAsMap()
    const internalRegistryMetric = internalRegistryData.get(metricName)?.instance
    expect(internalRegistryMetric?.get()?.value).to.be.equal(metricValue, 'did not update internal registry')
  })
})
