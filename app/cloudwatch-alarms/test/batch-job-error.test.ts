// noinspection DuplicatedCode

jest.mock('axios');

import Chance from 'chance';
import axios from 'axios';
import { handler as postRecords } from '../src';
import testEventAwsBatch from './data/testEvent-EventBridge-awsbatch.json';

describe('AWS Batch job failed', () => {
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

  it('should post message to slack', async () => {
    const event = testEventAwsBatch;

    // @ts-ignore
    await postRecords(event);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toBeCalledWith(url, {
      blocks: [
        { text: { text: `AWS Batch (${project}-${env} fake-region) :warning: Job \`event-test\` failed`, type: 'mrkdwn' }, type: 'section' },
        {
          elements: [{ emoji: false, text: 'TS: 20171023 19:56:03.  JobId: 4c7599ae-0a82-49aa-ba5a-4727fcce14a8', type: 'plain_text' }],
          type: 'context',
        },
      ],
      text: `AWS Batch (${project}-${env} fake-region) :warning: Job \`event-test\` failed`,
    });
  });
});
