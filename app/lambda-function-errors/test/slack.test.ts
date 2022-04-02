import { Slack } from '../src/slack'
import nock from 'nock'

nock.disableNetConnect()

describe('Slack', () => {
  it('Should make proper call to Slack endpoint', async () => {
    // Arrange
    const host = 'https://abc.com'
    const path = '/some-path'
    const slack = new Slack(`${host}${path}`)

    nock(host, {'encodedQueryParams': true})
      .post(path, (body) => {
        expect(body).toMatchObject({bla: 'bla'})
        return true
      })
      .reply(200, 'ok');

    // Act
    await slack.postMessage({bla: 'bla'})

    // Assert
    expect(nock.isDone()).toBe(true)
  })
  it('Should throw with error if non 2xx response', async () => {
    // Arrange
    const host = 'https://abc.com'
    const path = '/some-path'
    const slack = new Slack(`${host}${path}`)

    nock(host, {'encodedQueryParams': true})
      .post(path, (body) => {
        expect(body).toMatchObject({bla: 'bla'})
        return true
      })
      .reply(400, 'wrong stuff');

    // Act & Assert
    await expect(() => slack.postMessage({bla: 'bla'})).rejects.toThrowError('wrong stuff')
  })
})
