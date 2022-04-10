jest.mock('axios');

import faker from 'faker';
import axios from 'axios';
import { handler as postRecords, shortenTimestamp } from '../src';
import testEventAlarm from './testEvent-EventBridge-alarm.json';
import testEventAwsBatch from './testEvent-EventBridge-awsbatch.json';
import nock from 'nock';

describe('Utilities', () => {
  it('should shorten the timestamp', () => {
    // Summer
    expect(shortenTimestamp('2022-04-01T07:18:59.951+0000')).toBe('20220401 09:18:59');
    expect(shortenTimestamp('2022-04-01T07:18:59.951Z')).toBe('20220401 09:18:59');
    expect(shortenTimestamp('2022-10-11T07:18:59.951+0000')).toBe('20221011 09:18:59');
    // Winter
    expect(shortenTimestamp('2022-02-01T07:18:59.951+0000')).toBe('20220201 08:18:59');
    expect(shortenTimestamp('2022-02-01T07:18:59.951Z')).toBe('20220201 08:18:59');
    expect(shortenTimestamp('2022-12-25T07:18:59.951+0000')).toBe('20221225 08:18:59');
    expect(shortenTimestamp('2022-12-25T07:18:59.951Z')).toBe('20221225 08:18:59');
  });
});

describe('Slack alarm lambda', () => {
  const url = faker.internet.url();
  const env = faker.lorem.word();

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

  const ALARM_WARNING_SYMBOL = ':warning:';
  const ALARM_TRIGGERING_COLOR = '#de4c1f';
  describe('AWS Batch', () => {
    it('should post  message to slack', async () => {
      const event = testEventAwsBatch;
      const expectedText = `${ALARM_WARNING_SYMBOL} AWS Batch job \`event-test\` failed`;
      const expectedContext = 'Job ID 4c7599ae-0a82-49aa-ba5a-4727fcce14a8';

      // @ts-ignore
      await postRecords(event);

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toBeCalledWith(url, {
        attachments: [
          {
            blocks: [
              { text: { text: ':warning: AWS Batch job `event-test` failed', type: 'mrkdwn' }, type: 'section' },
              { elements: [{ text: 'Job ID 4c7599ae-0a82-49aa-ba5a-4727fcce14a8', type: 'plain_text' }], type: 'context' },
            ],
            color: '#de4c1f',
          },
        ],
        username: `CloudWatch (${env} fake-region)`,
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

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toBeCalledWith(url, {
        attachments: [
          {
            blocks: [
              {
                text: {
                  text: ':warning: Triggered: Triggered when webhook errors occurs more often than 1 time per 5 minutes',
                  type: 'mrkdwn',
                },
                type: 'section',
              },
              {
                elements: [
                  {
                    text: 'sso-web-hooks-lambda-stg-WebHooksMetricFilterAlarm-1XPC27WQKUXOI (2020-09-08T05:59:13.148+0000)',
                    type: 'plain_text',
                  },
                ],
                type: 'context',
              },
              { type: 'divider' },
              { text: { text: '```\nlog-line-1\n```', type: 'mrkdwn' }, type: 'section' },
              { text: { text: '```\nlog-line-2\n```', type: 'mrkdwn' }, type: 'section' },
            ],
            color: '#de4c1f',
          },
        ],
        username: 'CloudWatch (' + env + ' fake-region)',
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

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toBeCalledWith(url, {
        attachments: [
          {
            blocks: [
              {
                text: {
                  text: ':warning: Triggered: Triggered when webhook errors occurs more often than 1 time per 5 minutes',
                  type: 'mrkdwn',
                },
                type: 'section',
              },
              {
                elements: [
                  {
                    text: 'sso-web-hooks-lambda-stg-WebHooksMetricFilterAlarm-1XPC27WQKUXOI (2020-09-08T05:59:13.148+0000)',
                    type: 'plain_text',
                  },
                ],
                type: 'context',
              },
            ],
            color: '#de4c1f',
          },
        ],
        username: 'CloudWatch (' + env + ' fake-region)',
      });
    });

    it('should not post message to slack if records array are empty ', async () => {
      const event = { Records: [] };

      // @ts-ignore
      await postRecords(event);

      expect(axios.post).toHaveBeenCalledTimes(0);
    });
  });
});
