// tslint:disable: no-any
// noinspection DuplicatedCode

import { main } from '../src/main';
import { It, Mock, MockBehavior, Times } from 'typemoq';
import { AWSError, CloudWatch, Response, Request } from 'aws-sdk';
import { Slack } from '../src/slack';
import {
  GetMetricDataInput,
  GetMetricDataOutput,
  ListMetricsInput,
  ListMetricsOutput,
  Metric,
  MetricDataResult,
} from 'aws-sdk/clients/cloudwatch';

describe('main', () => {
  const intervalInMinutes = 10;
  const event = {
    version: '0',
    id: '53dc4d37-cffa-4f76-80c9-8b7d4a4d2eaa',
    'detail-type': 'Scheduled Event' as const,
    source: 'aws.events',
    account: '123456789012',
    time: '2015-10-08T16:53:06Z',
    region: 'us-east-1',
    resources: ['arn:aws:events:us-east-1:123456789012:rule/my-scheduled-rule'],
    detail: {},
  };
  const cwMock = Mock.ofType<CloudWatch>(undefined, MockBehavior.Strict);
  const slackMock = Mock.ofType<Slack>(undefined, MockBehavior.Strict);

  beforeEach(() => {
    cwMock.reset();
    slackMock.reset();
  });
  afterEach(() => {
    cwMock.verifyAll();
    slackMock.verifyAll();
  });

  it('should throw if event.source !== "aws.events"', async () => {
    // Arrange
    const event2 = { ...event };
    event2.source = 'some-other';

    // Act
    await expect(() => main(cwMock.object, slackMock.object, event2, intervalInMinutes, [])).rejects.toThrowError();
  });

  it('should throw if event["detail-type"] !== "Scheduled Event"', async () => {
    // Arrange
    const event2 = { ...event };
    event2['detail-type'] = 'some-other' as unknown as any;

    // Act
    await expect(() => main(cwMock.object, slackMock.object, event2, intervalInMinutes, [])).rejects.toThrowError();
  });

  it('should not send anything listMetrics returns empty Metrics-array', async () => {
    // Arrange
    mockListMetrics([]);
    slackMock.setup((x) => x.postMessage(It.isAny())).verifiable(Times.never());

    // Act
    await main(cwMock.object, slackMock.object, event, intervalInMinutes, []);

    // Assert is done in afterEach
  });

  it('should not send anything if getMetricData returns Metrics-property metric for metric as empty array', async () => {
    // Arrange
    const metric: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-1' }],
    };
    mockListMetrics([[metric]]);
    mockGetMetricData(['metric-1'], [[{ functionName: 'metric-1', result: [] }]]);
    slackMock.setup((x) => x.postMessage(It.isAny())).verifiable(Times.never());

    // Act
    await main(cwMock.object, slackMock.object, event, intervalInMinutes, []);

    // Assert is done in afterEach
  });

  it('should not send anything if getMetricData returns Metrics-property metric with zeros', async () => {
    // Arrange
    const metric: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-1' }],
    };
    mockListMetrics([[metric]]);
    mockGetMetricData(['metric-1'], [[{ functionName: 'metric-1', result: [0, 0, 0] }]]);
    slackMock.setup((x) => x.postMessage(It.isAny())).verifiable(Times.never());

    // Act
    await main(cwMock.object, slackMock.object, event, intervalInMinutes, []);

    // Assert is done in afterEach
  });

  it('should not send anything if listMetrics and getMetricData returns Metrics-property as paginated sets with all zeros ', async () => {
    // Arrange
    const metric1: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-1' }],
    };
    const metric2: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-2' }],
    };
    mockListMetrics([[metric1, metric2]]);
    mockGetMetricData(
      ['metric-1', 'metric-2'],
      [[{ functionName: 'metric-1', result: [0, 0, 0] }], [{ functionName: 'metric-2', result: [0, 0, 0] }]]
    );
    slackMock.setup((x) => x.postMessage(It.isAny())).verifiable(Times.never());

    // Act
    await main(cwMock.object, slackMock.object, event, intervalInMinutes, []);

    // Assert is done in afterEach
  });

  it('should send if listMetrics and getMetricData returns Metrics-property with > 0 errors on the 2nd page of results', async () => {
    // Arrange
    const metric1: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-1' }],
    };
    const metric2: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-2' }],
    };
    mockListMetrics([[metric1, metric2]]);
    mockGetMetricData(
      ['metric-1', 'metric-2'],
      [[{ functionName: 'metric-1', result: [0, 0, 0] }], [{ functionName: 'metric-2', result: [0, 0, 1] }]]
    ); // Note: 1 here
    slackMock.setup((x) => x.postMessage(It.isAny())).verifiable(Times.once()); // Note: Times.once()

    // Act
    await main(cwMock.object, slackMock.object, event, intervalInMinutes, []);

    // Assert is done in afterEach
  });

  it('should send if listMetrics and getMetricData returns Metrics-property with > 0 errors on the 2nd page of results only for non-ignored functions', async () => {
    // Arrange
    const metric1: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-1' }],
    };
    const metric2: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-2' }],
    };
    const metric3: Metric = {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Dimensions: [{ Name: 'FunctionName', Value: 'metric-3' }],
    };
    mockListMetrics([[metric1, metric2, metric3]]);
    mockGetMetricData(
      ['metric-1', 'metric-2', 'metric-3'],
      [
        [
          { functionName: 'metric-1', result: [0, 0, 0] },
          { functionName: 'metric-2', result: [0, 4, 0] }, // Note: 4 here
        ],
        [
          { functionName: 'metric-3', result: [0, 0, 1] }, // Note: 1 here
        ],
      ]
    );
    slackMock.setup((x) => x.postMessage(It.is((x) => JSON.stringify(x).indexOf('`metric-3`') > 0))).verifiable(Times.once()); // Note: Times.once()

    // Act
    await main(cwMock.object, slackMock.object, event, intervalInMinutes, ['metric-2']);

    // Assert is done in afterEach
  });

  /** Configures AWS SDK CloudWatch listMetrics mock.
   *
   * @param metricPages An array describing the result which should be mocked for `CloudWatch.listMetrics`.
   * Each element in this array represents a page/batch of results from the AWS API. This function
   * will configure the mocked CloudWatch to return corresponding `NextToken` in the results so that pagination
   * works. Each element in `resultConfig` repesents one set of lambda-error-metrics to return.
   **/
  const mockListMetrics = (metricPages: Metric[][]) => {
    function buildListMetricsReturn(params: ListMetricsInput) {
      const requestedPage = Number(params.NextToken || 0);
      const listMetricsReturn = Mock.ofType<Request<ListMetricsOutput, AWSError>>();
      listMetricsReturn
        .setup((x) => x.promise())
        .returns(() =>
          Promise.resolve({
            Metrics: metricPages[requestedPage],
            $response: Mock.ofType<Response<ListMetricsOutput, AWSError>>().object,
            ...(requestedPage + 1 < metricPages.length && { NextToken: (requestedPage + 1).toString() }),
          })
        );
      return listMetricsReturn.object;
    }
    cwMock
      .setup((x) =>
        x.listMetrics(
          It.is((y) => {
            expect(y).toMatchObject({
              Namespace: 'AWS/Lambda',
              MetricName: 'Errors',
              Dimensions: [{ Name: 'FunctionName' }],
            });
            return true;
          })
        )
      )
      .returns((params: ListMetricsInput) => buildListMetricsReturn(params))
      .verifiable(Times.exactly(metricPages.length || 1));
  };

  /** Configures AWS SDK CloudWatch getMetricData mock.
   *
   * @param requestFunctionNames The function names you expect to be requested. These are the results from the
   * `CloudWatch.listMetrics` API. These can be mocked using `mockListMetrics`.
   *
   * @param resultConfig An array describing the result which should be mocked for `CloudWatch.getMetricData`.
   * Each element in this array represents a page/batch of results from the AWS API. This function
   * will configure the mocked CloudWatch to return corresponding `NextToken` in the results so that pagination
   * works. Each element in `resultConfig` repesents one lambda-function's metrics. `functionName` is the
   * name of the function and `result` contains the data points during the time-span. In nominal API function the
   * function-names described in `resultConfig.functionName` should equal the function-names in
   * `requestFunctionNames`.
   **/
  const mockGetMetricData = (requestFunctionNames: string[], resultConfig: { functionName: string; result: number[] }[][]) => {
    function buildGetMetricDataReturn(params: GetMetricDataInput) {
      const requestedPage = Number(params.NextToken || 0);
      const getMetricDataReturn = Mock.ofType<Request<ListMetricsOutput, AWSError>>();
      getMetricDataReturn
        .setup((x) => x.promise())
        .returns(() =>
          Promise.resolve({
            MetricDataResults: resultConfig[requestedPage].map((metric) => ({
              Label: metric.functionName,
              Values: metric.result,
            })) as MetricDataResult[],
            $response: Mock.ofType<Response<GetMetricDataOutput, AWSError>>().object,
            ...(requestedPage + 1 < resultConfig.length && { NextToken: (requestedPage + 1).toString() }),
          })
        );
      return getMetricDataReturn.object;
    }

    cwMock
      .setup((x) =>
        x.getMetricData(
          It.is((y) => {
            expect(y).toMatchObject({
              EndTime: new Date(Date.parse(event.time)),
              StartTime: new Date(Date.parse(event.time).valueOf() - intervalInMinutes * 60 * 1000),
            });
            requestFunctionNames.forEach((fnName) => {
              expect(y.MetricDataQueries).toContainEqual(
                expect.objectContaining({
                  MetricStat: {
                    Metric: {
                      Namespace: 'AWS/Lambda',
                      MetricName: 'Errors',
                      Dimensions: [{ Name: 'FunctionName', Value: fnName }],
                    },
                    Stat: 'Sum',
                    Period: intervalInMinutes * 60,
                  },
                })
              );
            });
            return true;
          })
        )
      )
      .returns((params: GetMetricDataInput) => buildGetMetricDataReturn(params))
      .verifiable(Times.exactly(resultConfig.length));
  };
});
