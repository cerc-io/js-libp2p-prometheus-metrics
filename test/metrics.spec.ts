import { expect } from 'aegir/chai'
import { prometheusMetrics } from '../src/index.js'
import { randomMetricName } from './fixtures/random-metric-name.js'

describe('metrics', () => {
  it('should set a metric', async () => {
    const metricName = randomMetricName()
    const metricValue = 5
    const metrics = prometheusMetrics()()
    const metric = metrics.registerMetric(metricName)
    metric.update(metricValue)

    const report = await metrics.getMetrics()
    expect(report).to.include(`# TYPE ${metricName} gauge`, 'did not include metric type')
    expect(report).to.include(`${metricName} ${metricValue}`, 'did not include updated metric')
  })

  it('should increment a metric without a value', async () => {
    const metricName = randomMetricName()
    const metrics = prometheusMetrics()()
    const metric = metrics.registerMetric(metricName)
    metric.increment()

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} 1`, 'did not include updated metric')
  })

  it('should increment a metric with a value', async () => {
    const metricName = randomMetricName()
    const metricValue = 5
    const metrics = prometheusMetrics()()
    const metric = metrics.registerMetric(metricName)
    metric.increment(metricValue)

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} ${metricValue}`, 'did not include updated metric')
  })

  it('should decrement a metric without a value', async () => {
    const metricName = randomMetricName()
    const metrics = prometheusMetrics()()
    const metric = metrics.registerMetric(metricName)
    metric.decrement()

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} -1`, 'did not include updated metric')
  })

  it('should decrement a metric with a value', async () => {
    const metricName = randomMetricName()
    const metricValue = 5
    const metrics = prometheusMetrics()()
    const metric = metrics.registerMetric(metricName)
    metric.decrement(metricValue)

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} -${metricValue}`, 'did not include updated metric')
  })

  it('should calculate a metric', async () => {
    const metricName = randomMetricName()
    const metricValue = 5
    const metrics = prometheusMetrics()()
    metrics.registerMetric(metricName, {
      calculate: () => {
        return metricValue
      }
    })

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} ${metricValue}`, 'did not include updated metric')
  })

  it('should promise to calculate a metric', async () => {
    const metricName = randomMetricName()
    const metricValue = 5
    const metrics = prometheusMetrics()()
    metrics.registerMetric(metricName, {
      calculate: async () => {
        return metricValue
      }
    })

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} ${metricValue}`, 'did not include updated metric')
  })

  it('should reset a metric', async () => {
    const metricName = randomMetricName()
    const metricValue = 5
    const metrics = prometheusMetrics()()
    const metric = metrics.registerMetric(metricName)
    metric.update(metricValue)

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} ${metricValue}`)

    metric.reset()

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} 0`, 'did not include updated metric')
  })

  it('should allow use of the same metric from multiple reporters', async () => {
    const metricName = randomMetricName()
    const metricLabel = randomMetricName('label_')
    const metricValue1 = 5
    const metricValue2 = 7
    const metrics = prometheusMetrics()()
    const metric1 = metrics.registerMetric(metricName, {
      label: metricLabel
    })
    metric1.update(metricValue1)
    const metric2 = metrics.registerMetric(metricName, {
      label: metricLabel
    })
    metric2.update(metricValue2)

    await expect(metrics.getMetrics()).to.eventually.include(`${metricName} ${metricValue2}`)
  })
})
