import aws from 'aws-sdk';

export const getLambdaErrors = async (cw: aws.CloudWatch, endTime: Date, scheduleRateIntervalInMinutes: number) => {
  const functionNames = await getFunctionNames(cw);

  if (functionNames.length === 0) {
    return [];
  }

  const metrics: Array<{ name: string; errors: number }> = [];

  let nextToken: string | undefined;

  do {
    const resp = await cw
      .getMetricData({
        NextToken: nextToken,
        StartTime: new Date(endTime.valueOf() - scheduleRateIntervalInMinutes * 60 * 1000),
        EndTime: endTime,
        MetricDataQueries: functionNames.map((fnName, i) => ({
          Id: 'errors' + i,
          MetricStat: {
            Metric: {
              Namespace: 'AWS/Lambda',
              MetricName: 'Errors',
              Dimensions: [{ Name: 'FunctionName', Value: fnName }],
            },
            Stat: 'Sum',
            Period: scheduleRateIntervalInMinutes * 60,
          },
        })),
      })
      .promise();
    if (resp.MetricDataResults) {
      resp.MetricDataResults.forEach((result) => {
        /* istanbul ignore next */
        metrics.push({
          name: result.Label || 'unknown (this means: bug in metrics.ts)',
          errors: result.Values?.reduce((prev, curr) => prev + curr, 0) || 0,
        });
      });
    }
    nextToken = resp.NextToken;
  } while (nextToken);

  return metrics;
};

const getFunctionNames = async (cw: aws.CloudWatch) => {
  const functionNames: string[] = [];
  let nextToken: string | undefined;
  do {
    const result = await cw
      .listMetrics({
        MetricName: 'Errors',
        Dimensions: [{ Name: 'FunctionName' }],
        Namespace: 'AWS/Lambda',
      })
      .promise();
    result.Metrics?.map((x) => x.Dimensions?.find((y) => y.Name === 'FunctionName')?.Value).forEach(
      (x) => x && !functionNames.includes(x) && functionNames.push(x)
    );
    nextToken = result.NextToken;
  } while (nextToken);
  return functionNames;
};
