jest.mock('request-promise');

import faker from 'faker';
import requestPromise from 'request-promise';
import { handler as postRecords } from '../src';
import testEventAlarm from './testEvent-EventBridge-alarm.json';
import testEventAwsBatch from './testEvent-EventBridge-awsbatch.json';
import nock from 'nock';

describe('Slack alarm lambda', () => {
  beforeAll(() => {
    process.env.AWS_REGION = 'fake-region';
    process.env.SLACK_WEBHOOK_URL = faker.internet.url();
    process.env.ENVIRONMENT = faker.lorem.word();
    process.env.AWS_ACCESS_KEY_ID = 'fakeId';
    process.env.AWS_SECRET_ACCESS_KEY = 'fakeKeyToPreventRequestToEC2Metadata';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const ALARM_WARNING_SYMBOL = ':warning:';
  const ALARM_TRIGGERING_COLOR = '#de4c1f';
  describe('AWS Batch', () => {
    it('should post  message to slack', async () => {
      const event = testEventAwsBatch;
      const expectedText = `${ALARM_WARNING_SYMBOL} AWS Batch job \`event-test\` failed`;
      const expectedContext = 'Job ID 4c7599ae-0a82-49aa-ba5a-4727fcce14a8';

      // @ts-ignore
      await postRecords(event);

      expect(requestPromise).toHaveBeenCalledTimes(1);
      expect(requestPromise).toBeCalledWith({
        uri: process.env.SLACK_WEBHOOK_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: `CloudWatch (${process.env.ENVIRONMENT} ${process.env.AWS_REGION})`,
          attachments: [
            {
              color: ALARM_TRIGGERING_COLOR,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: expectedText,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'plain_text',
                      text: expectedContext,
                    },
                  ],
                },
              ],
            },
          ],
        },
        json: true,
        followRedirects: true,
        followAllRedirects: true,
      });
    });
  });
  describe('CW Alarm', () => {
    it('should post ALARM message to slack', async () => {
      const event = testEventAlarm;
      const expectedText = `${ALARM_WARNING_SYMBOL} Triggered: Triggered when webhook errors occurs more often than 1 time per 5 minutes`;
      const expectedContext = 'sso-web-hooks-lambda-stg-WebHooksMetricFilterAlarm-1XPC27WQKUXOI (2020-09-08T05:59:13.148+0000)';

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

      expect(requestPromise).toHaveBeenCalledTimes(1);
      expect(requestPromise).toBeCalledWith({
        uri: process.env.SLACK_WEBHOOK_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: `CloudWatch (${process.env.ENVIRONMENT} ${process.env.AWS_REGION})`,
          attachments: [
            {
              color: ALARM_TRIGGERING_COLOR,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: expectedText,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'plain_text',
                      text: expectedContext,
                    },
                  ],
                },
                {
                  type: 'divider',
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '```\nlog-line-1\n```',
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '```\nlog-line-2\n```',
                  },
                },
              ],
            },
          ],
        },
        json: true,
        followRedirects: true,
        followAllRedirects: true,
      });
    });

    it('should post ALARM message to slack with no logs', async () => {
      const event = testEventAlarm;
      const expectedText = `${ALARM_WARNING_SYMBOL} Triggered: Triggered when webhook errors occurs more often than 1 time per 5 minutes`;
      const expectedContext = 'sso-web-hooks-lambda-stg-WebHooksMetricFilterAlarm-1XPC27WQKUXOI (2020-09-08T05:59:13.148+0000)';

      nock(`https://logs.${process.env.AWS_REGION}.amazonaws.com/`, { encodedQueryParams: true })
        .post('/', { metricName: 'ExecutorLoggedErrors', metricNamespace: 'Webhooks' })
        .reply(200, { metricFilters: [] });

      // @ts-ignore
      await postRecords(event);

      expect(requestPromise).toHaveBeenCalledTimes(1);
      expect(requestPromise).toBeCalledWith({
        uri: process.env.SLACK_WEBHOOK_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: `CloudWatch (${process.env.ENVIRONMENT} ${process.env.AWS_REGION})`,
          attachments: [
            {
              color: ALARM_TRIGGERING_COLOR,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: expectedText,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'plain_text',
                      text: expectedContext,
                    },
                  ],
                },
              ],
            },
          ],
        },
        json: true,
        followRedirects: true,
        followAllRedirects: true,
      });
    });

    it('should not post message to slack if records array are empty ', async () => {
      const event = { Records: [] };

      // @ts-ignore
      await postRecords(event);

      expect(requestPromise).toHaveBeenCalledTimes(0);
    });
  });
});
