// noinspection DuplicatedCode

jest.mock('axios');

import Chance from 'chance';
import axios from 'axios';
import { handler as postRecords } from '../src';
import testEventAlarmInAlarm from './data/testEvent-EventBridge-alarm.json';
import testEventAlarmOK from './data/testEvent-EventBridge-alarm-OK.json';
import testEventAlarmEdgeCases from './data/testEvent-EventBridge-alarm-Edges.json';
import nock from 'nock';

describe('CloudWatch Alarm state changed', () => {
  const chance = new Chance();
  const url = chance.url();
  const env = chance.word();
  const project = chance.word();

  beforeAll(() => {
    process.env.AWS_REGION = 'fake-region';
    process.env.SLACK_WEBHOOK_URL = url;
    process.env.ENVIRONMENT = env;
    process.env.AWS_ACCESS_KEY_ID = 'fakeId';
    process.env.AWS_SECRET_ACCESS_KEY = 'fakeKeyToPreventRequestToEC2Metadata';
    process.env.PROJECT = project;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should post ALARM message to Slack when the state changed to OK', async () => {
    const event = testEventAlarmOK;

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', { metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks' })
      .reply(200, {
        metricFilters: [
          {
            creationTime: 1599125220237,
            filterName: 'sso-web-hooks-lambda-stg-WebHooksTaskExecuterMetricFilter-119CXVFX0EDOU',
            filterPattern: '{$.level >= 50}',
            logGroupName: '/aws/lambda/stg-sso-web-hooks-task-executor',
            metricTransformations: [{ metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks', metricValue: '1' }],
          },
        ],
      });

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', {
        logGroupName: '/aws/lambda/stg-sso-web-hooks-task-executor',
        filterPattern: '{$.level >= 50}',
        startTime: 1599544153148,
        endTime: 1599544753148,
      })
      .reply(200, { events: [{ message: 'log-line-1' }, { message: 'log-line-2' }] });

    // @ts-ignore
    await postRecords(event);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toBeCalledWith(url, {
      blocks: [
        {
          text: {
            text: `CloudWatch Alarm (${project}-${env} fake-region) :white_check_mark: Resolved when webhook errors occurs more often than 1 time per 5 minutes`,
            type: 'mrkdwn',
          },
          type: 'section',
        },
        {
          elements: [
            {
              emoji: false,
              text: 'TS: 20200908 07:59:13.  AlarmName: sso-web-hooks-lambda-stg-WebHooksMetricFilterAlarm-1XPC27WQKUXOI',
              type: 'plain_text',
            },
          ],
          type: 'context',
        },
        { text: { text: '```\nlog-line-1\n```', type: 'mrkdwn' }, type: 'section' },
        { text: { text: '```\nlog-line-2\n```', type: 'mrkdwn' }, type: 'section' },
      ],
      text: `CloudWatch Alarm (${project}-${env} fake-region) :white_check_mark: Resolved when webhook errors occurs more often than 1 time per 5 minutes`,
    });
  });

  it('should post ALARM message to slack when the state changed to ALARM', async () => {
    const event = testEventAlarmInAlarm;

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', { metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks' })
      .reply(200, {
        metricFilters: [
          {
            creationTime: 1599125220237,
            filterName: 'sso-web-hooks-lambda-stg-WebHooksTaskExecuterMetricFilter-119CXVFX0EDOU',
            filterPattern: '{$.level >= 50}',
            logGroupName: '/aws/lambda/stg-sso-web-hooks-task-executor',
            metricTransformations: [{ metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks', metricValue: '1' }],
          },
        ],
      });

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', {
        logGroupName: '/aws/lambda/stg-sso-web-hooks-task-executor',
        filterPattern: '{$.level >= 50}',
        startTime: 1599544153148,
        endTime: 1599544753148,
      })
      .reply(200, { events: [{ message: 'log-line-1' }, { message: 'log-line-2' }] });

    // @ts-ignore
    await postRecords(event);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toBeCalledWith(url, {
      blocks: [
        {
          text: {
            text: `CloudWatch Alarm (${project}-${env} fake-region) :warning: Triggered when webhook errors occurs more often than 1 time per 5 minutes`,
            type: 'mrkdwn',
          },
          type: 'section',
        },
        {
          elements: [
            {
              emoji: false,
              text: 'TS: 20200908 07:59:13.  AlarmName: sso-web-hooks-lambda-stg-WebHooksMetricFilterAlarm-1XPC27WQKUXOI',
              type: 'plain_text',
            },
          ],
          type: 'context',
        },
        { text: { text: '```\nlog-line-1\n```', type: 'mrkdwn' }, type: 'section' },
        { text: { text: '```\nlog-line-2\n```', type: 'mrkdwn' }, type: 'section' },
      ],
      text: `CloudWatch Alarm (${project}-${env} fake-region) :warning: Triggered when webhook errors occurs more often than 1 time per 5 minutes`,
    });
  });

  it('should handle edge cases when posting ALARM message to slack', async () => {
    const event = testEventAlarmEdgeCases;

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', { metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks' })
      .reply(200, {
        metricFilters: [
          {
            creationTime: 1599125220237,
            filterName: 'sso-web-hooks-lambda-stg-WebHooksTaskExecuterMetricFilter-119CXVFX0EDOU',
            filterPattern: '{$.level >= 50}',
            logGroupName: '/aws/lambda/stg-sso-web-hooks-task-executor',
            metricTransformations: [{ metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks', metricValue: '1' }],
          },
        ],
      });

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', {
        logGroupName: '/aws/lambda/stg-sso-web-hooks-task-executor',
        filterPattern: '{$.level >= 50}',
        startTime: 1599544153148,
        endTime: 1599544753148,
      })
      .reply(200, { events: [{ message: 'log-line-1' }, { message: 'log-line-2' }] });

    // @ts-ignore
    await postRecords(event);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toBeCalledWith(url, {
      blocks: [
        {
          text: {
            text: `CloudWatch Alarm (${project}-${env} fake-region) :warning: (alarm-description not found)`,
            type: 'mrkdwn',
          },
          type: 'section',
        },
        {
          elements: [
            {
              emoji: false,
              text: 'TS: 20200908 07:59:13.  AlarmName: (alarm-name not found)',
              type: 'plain_text',
            },
          ],
          type: 'context',
        },
        { text: { text: '```\nlog-line-1\n```', type: 'mrkdwn' }, type: 'section' },
        { text: { text: '```\nlog-line-2\n```', type: 'mrkdwn' }, type: 'section' },
      ],
      text: `CloudWatch Alarm (${project}-${env} fake-region) :warning: (alarm-description not found)`,
    });
  });

  it('should post ALARM message to Slack with no logs', async () => {
    const event = testEventAlarmInAlarm;

    nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
      .post('/', { metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks' })
      .reply(200, { metricFilters: [] });

    // @ts-ignore
    await postRecords(event);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toBeCalledWith(url, {
      blocks: [
        {
          text: {
            text: `CloudWatch Alarm (${project}-${env} fake-region) :warning: Triggered when webhook errors occurs more often than 1 time per 5 minutes`,
            type: 'mrkdwn',
          },
          type: 'section',
        },
        {
          elements: [
            {
              emoji: false,
              text: 'TS: 20200908 07:59:13.  AlarmName: sso-web-hooks-lambda-stg-WebHooksMetricFilterAlarm-1XPC27WQKUXOI',
              type: 'plain_text',
            },
          ],
          type: 'context',
        },
      ],
      text: `CloudWatch Alarm (${project}-${env} fake-region) :warning: Triggered when webhook errors occurs more often than 1 time per 5 minutes`,
    });
  });

  it('should not post message to slack if records array are empty ', async () => {
    const event = { Records: [] };
    // @ts-ignore
    await postRecords(event);

    expect(axios.post).toHaveBeenCalledTimes(0);
  });
});
