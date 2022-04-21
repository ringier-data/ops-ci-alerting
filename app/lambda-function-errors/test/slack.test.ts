import { Slack } from '../src/slack';
import nock from 'nock';
import { getSlackBody } from '../src/main';
import Chance from 'chance';

nock.disableNetConnect();

describe('Slack', () => {
  const chance = new Chance();
  const env = chance.word();

  beforeAll(() => {
    process.env.AWS_REGION = 'fake-region';
    process.env.ENVIRONMENT = env;
  });

  it('should make proper call to Slack endpoint', async () => {
    // Arrange
    const host = 'https://abc.com';
    const path = '/some-path';
    const slack = new Slack(`${host}${path}`);

    nock(host, { encodedQueryParams: true })
      .post(path, (body) => {
        expect(body).toMatchObject({ bla: 'bla' });
        return true;
      })
      .reply(200, 'ok');

    // Act
    await slack.postMessage({ bla: 'bla' });

    // Assert
    expect(nock.isDone()).toBe(true);
  });

  it('should throw with error if non 2xx response', async () => {
    // Arrange
    const host = 'https://abc.com';
    const path = '/some-path';
    const slack = new Slack(`${host}${path}`);

    nock(host, { encodedQueryParams: true })
      .post(path, (body) => {
        expect(body).toMatchObject({ bla: 'bla' });
        return true;
      })
      .reply(400, 'wrong stuff');

    // Act & Assert
    await expect(() => slack.postMessage({ bla: 'bla' })).rejects.toThrowError('wrong stuff');
  });

  it('should render Slack message properly depending on the internal', () => {
    const baseline = 1650536416000;
    let dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseline + 40000);

    expect(getSlackBody('test-function1', 15, new Date(baseline), 12)).toEqual({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Lambda Function (${env} fake-region) :warning: Function \`test-function1\` failed 15 times in the last 12 minutes`,
          },
        },
      ],
      text: `Lambda Function (${env} fake-region) :warning: Function \`test-function1\` failed 15 times in the last 12 minutes`,
    });

    dateNowSpy.mockRestore();
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseline + 65000);

    expect(getSlackBody('test-function1', 21, new Date(baseline), 65)).toEqual({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Lambda Function (${env} fake-region) :warning: Function \`test-function1\` failed 21 times between 2022-04-21T09:15:16.000Z and 2022-04-21T10:20:16.000Z`,
          },
        },
      ],
      text: `Lambda Function (${env} fake-region) :warning: Function \`test-function1\` failed 21 times between 2022-04-21T09:15:16.000Z and 2022-04-21T10:20:16.000Z`,
    });

    dateNowSpy.mockRestore();
  });
});
