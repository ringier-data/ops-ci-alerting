import { shortenTimestamp } from './utils';
import axios from 'axios';

export async function newPostSlackMessage(subject: string, timestamp: string, context: string, logs?: string[]) {
  const body = {
    text: subject, // this is workaround for a Slack limitation, see https://github.com/RasaHQ/rasa/issues/3561
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: subject,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: `TS: ${shortenTimestamp(timestamp)}.  ${context}`,
            emoji: false,
          },
        ],
      },
    ],
  };

  if (Array.isArray(logs)) {
    logs.forEach((msg) => {
      body.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '```\n' + msg + '\n```',
        },
      });
    });
  }
  await axios.post(process.env.SLACK_WEBHOOK_URL as string, body);
}
