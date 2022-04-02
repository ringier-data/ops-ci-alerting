import { request } from 'https'
export class Slack {
  constructor(private readonly url: string) {}

  async postMessage(body: object): Promise<void> {
    const bodyJson = JSON.stringify(body)
    return new Promise((res, rej) => {
      const req = request(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': bodyJson.length
        }}, (msg) => {
        const err = msg.statusCode && (msg.statusCode < 200 || msg.statusCode >= 300)
        let resp = ''
        msg.on('error', rej)
        msg.on('data', (chunk) => resp += chunk)
        msg.on('end', () => {
          if (err)
          {
            console.error('Failed to send to Slack. Got non 2xx response.', {responseStatusCode: msg.statusCode, responseStatusMessage: msg.statusMessage, requestBody: bodyJson, responseBody: resp})
            rej(new Error('Non 2xx response: ' + resp))
          }
          res()
        })
      })
      req.on('error', rej)
      req.write(bodyJson)
      req.end();
    })
  }
}
