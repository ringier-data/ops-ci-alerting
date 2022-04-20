// noinspection DuplicatedCode

jest.mock('axios');

import Chance from 'chance';
import axios from 'axios';
import { handler as postRecords } from '../src';
import testEventAlarmOK from './data/testEvent-EventBridge-alarm-logs-OK.json';
import testEventAlarmEdgeCases from './data/testEvent-EventBridge-alarm-logs-Alarm-Edges.json';
import nock from 'nock';

describe('CloudWatch Logs error captured', () => {
  const chance = new Chance();
  const url = chance.url();
  const env = chance.word();

  beforeAll(() => {
    process.env.AWS_REGION = 'fake-region';
    process.env.SLACK_WEBHOOK_URL = url;
    process.env.ENVIRONMENT = env;
    process.env.AWS_ACCESS_KEY_ID = 'fakeId';
    process.env.AWS_SECRET_ACCESS_KEY = 'fakeKeyToPreventRequestToEC2Metadata';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should not post ALARM message to slack when the state changed to OK', async () => {
    const event = testEventAlarmOK;

    // @ts-ignore
    await postRecords(event);

    expect(axios.post).toHaveBeenCalledTimes(0);
  });

  it('should handle edge cases when posting ALARM message to Slack', async () => {
    const event = testEventAlarmEdgeCases;

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', { metricName: 'dev-iris-backend-error-log-metric-filter', metricNamespace: 'dev-iris-backend' })
      .reply(200, {
        metricFilters: [
          {
            creationTime: 1599125220237,
            filterName: 'dev-iris-backend-ecs-task-BackendErrorLogAlarm-13T309AJLZ0NE',
            filterPattern: '',
            logGroupName: '/dev/iris/backend',
            metricTransformations: [{ metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks', metricValue: '1' }],
          },
        ],
      });

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', {
        logGroupName: '/dev/iris/backend',
        filterPattern: '',
        startTime: 1649688479950,
        endTime: 1649688599950,
      })
      .reply(200, { events: [{ message: 'log-line-1' }, { message: 'log-line-2' }] });

    // @ts-ignore
    await postRecords(event);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toBeCalledWith(url, {
      blocks: [
        {
          text: {
            text: `CloudWatch Logs (${env} fake-region) :warning: Backend - Error Logged`,
            type: 'mrkdwn',
          },
          type: 'section',
        },
        {
          elements: [
            {
              emoji: false,
              text: 'TS: 20220411 16:49:59.  LG: /dev/iris/backend',
              type: 'plain_text',
            },
          ],
          type: 'context',
        },
        { text: { text: '```\nlog-line-1\n```', type: 'mrkdwn' }, type: 'section' },
        { text: { text: '```\nlog-line-2\n```', type: 'mrkdwn' }, type: 'section' },
      ],
      text: `CloudWatch Logs (${env} fake-region) :warning: Backend - Error Logged`,
    });
  });
});
