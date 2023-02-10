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

    const promOptions = {
      registry,
      // Passing empty method as custom registry doesn't calculate metrics on scraping
      // TODO: Add method in metrics to get values for specified metric
      calculateMemory: () => ({})
    }

    const metrics = prometheusMetrics(promOptions)()
    const metric = metrics.registerMetric(metricName)
    metric.update(metricValue)

    const customRegistryReport = registry.metrics()
    expect(customRegistryReport).to.include(`# TYPE ${metricName} gauge`, 'did not include metric type')
    expect(customRegistryReport).to.include(`${metricName} ${metricValue}`, 'did not include updated metric')

    const internalRegistryReport = await metrics.getMetrics()
    expect(internalRegistryReport).to.be.equal(customRegistryReport)
  })
})
