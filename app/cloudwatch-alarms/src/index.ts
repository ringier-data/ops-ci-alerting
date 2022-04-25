import { EventBridgeEvent } from 'aws-lambda';
import aws, { CloudWatchLogs } from 'aws-sdk';
import { parseLogs } from './logs';
import { newPostSlackMessage } from './slack';
import { FilterLogEventsRequest } from 'aws-sdk/clients/cloudwatchlogs';

let cwl: CloudWatchLogs;

type AlarmStateEvent = EventBridgeEvent<'CloudWatch Alarm State Change', any>;
type BatchJobStateChangeEvent = EventBridgeEvent<'Batch Job State Change', any>;
type MetricFiltersResponse = CloudWatchLogs.Types.DescribeMetricFiltersResponse;

// This lambda can be hooked up to CW alarms which alarm based on a MetricFilter,
// and it will extract the log-lines causing the alarm to trigger
export async function handler(event: AlarmStateEvent | BatchJobStateChangeEvent): Promise<void> {
  if (!cwl) {
    cwl = new aws.CloudWatchLogs({ region: process.env.AWS_REGION });
  }
  if (event?.detail?.status === 'FAILED' && event.source === 'aws.batch' && event['detail-type'] === 'Batch Job State Change') {
    // This happens when AWS Batch job fails
    await postSlackMessageForBatchJobFailure(event as BatchJobStateChangeEvent);
    console.log('Posted AWS Batch job failure notification to Slack');
  } else if (event?.source === 'aws.cloudwatch' && event['detail-type'] === 'CloudWatch Alarm State Change') {
    if (event.detail?.configuration?.description?.toLowerCase().endsWith('error logged')) {
      // NOTE-zw, there is no easy way to know if a CloudWatch alarm is triggered by filtering the CloudWatch logs.
      // We play a trick to distinguish this kind of alarms by describing the alarm as "blah...blah... Error Logged". e.g.
      //    ```yaml
      //      SAPProxyErrorLogAlarm:
      //        Type: AWS::CloudWatch::Alarm
      //        Properties:
      //          AlarmDescription: 'SAP API Proxy - Error Logged' <-- HERE IS THE TRICK
      //          ComparisonOperator: 'GreaterThanOrEqualToThreshold'
      //      ...
      //    ```
      if (event.detail.state.value === 'OK') {
        // Error logged alarm always recover immediately, we do not report it.
        console.log('Ignored a CloudWatch Alarm state change as it was a log message filter metric changed back to OK');
        return;
      }
      await postSlackMessageForErrorLogs(event as AlarmStateEvent);
      console.log('Posted CloudWatch Logs errors to Slack');
    } else {
      console.log(`Received AWS CloudWatch Alarm State Change event: ${JSON.stringify(event)}`);
      await postSlackMessageForAlarmStateChange(event as AlarmStateEvent);
    }
  } else {
    console.log('Found no relevant records');
  }
}

async function postSlackMessageForBatchJobFailure(record: BatchJobStateChangeEvent): Promise<void> {
  const subject = `AWS Batch (${process.env.PROJECT}-${process.env.ENVIRONMENT} ${process.env.AWS_REGION}) :warning: Job \`${record.detail.jobName}\` failed`;

  await newPostSlackMessage(subject, record.time, `JobId: ${record.detail.jobId}`);
}

/**
 * Special handling of alarms generated by filtering the CloudWatch Logs. This type of alarm will be switched to the InAlarm state then
 * changed back immediately. There is no need to report the state change.
 */
async function postSlackMessageForErrorLogs(record: AlarmStateEvent): Promise<void> {
  const alarmDescription = record.detail.configuration.description;
  const { logs, logGroupName } = await getLogsFromCloudWatch(record);
  const subject = `CloudWatch Logs (${process.env.PROJECT}-${process.env.ENVIRONMENT} ${process.env.AWS_REGION}) :warning: ${alarmDescription}`;

  await newPostSlackMessage(subject, record.detail.state.timestamp, `LG: ${logGroupName}`, logs);
}

async function postSlackMessageForAlarmStateChange(record: AlarmStateEvent) {
  const ALARM_WARNING_SYMBOL = ':warning:';
  const ALARM_RESOLVED_SYMBOL = ':white_check_mark:';
  const alarmDescription = record.detail.configuration.description || '(alarm-description not found)';
  const isOK = record.detail.state.value === 'OK';
  const symbol = isOK ? ALARM_RESOLVED_SYMBOL : ALARM_WARNING_SYMBOL;
  const { logs } = await getLogsFromCloudWatch(record);

  const subject = `CloudWatch Alarm (${process.env.PROJECT}-${process.env.ENVIRONMENT} ${process.env.AWS_REGION}) ${symbol} ${alarmDescription}`;
  const alarmName = record.detail.alarmName || '(alarm-name not found)';

  await newPostSlackMessage(subject, record.detail.state.timestamp, `AlarmName: ${alarmName}`, logs);
}

async function getLogsFromCloudWatch(record: any) {
  const timestamp = Date.parse(record.detail.state.timestamp);
  const offset = record.detail.configuration.metrics[0].metricStat.period * 1000 * 2; // multiplying with 2 here to compensate for delays in StateChangeTime
  const paramDescribeFilters = {
    metricName: record.detail.configuration.metrics[0].metricStat.metric.name,
    metricNamespace: record.detail.configuration.metrics[0].metricStat.metric.namespace,
  };
  const metricFilterData: MetricFiltersResponse = await cwl.describeMetricFilters(paramDescribeFilters).promise();
  const metricFilter = metricFilterData?.metricFilters?.shift();
  if (!metricFilter) {
    return {
      logs: [],
      logGroupName: '',
    };
  }
  const paramFilterLogEvents: FilterLogEventsRequest = {
    logGroupName: metricFilter.logGroupName as string,
    filterPattern: metricFilter.filterPattern || '',
    startTime: timestamp - offset,
    endTime: timestamp,
  };
  const data = await cwl.filterLogEvents(paramFilterLogEvents).promise();
  return {
    logs: parseLogs(data?.events),
    logGroupName: metricFilter.logGroupName,
  };
}
