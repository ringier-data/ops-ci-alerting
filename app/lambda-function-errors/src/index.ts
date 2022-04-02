import { ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import { main } from './main';
import aws from 'aws-sdk';
import { Slack } from './slack'

let cw: AWS.CloudWatch
let slack: Slack

export const handler : ScheduledHandler = async (event: ScheduledEvent) => {

  if (!cw) cw = new aws.CloudWatch({region: process.env.AWS_REGION});
  if (!slack) {
    /* istanbul ignore if */
    if (!process.env.SLACK_WEBHOOK_URL) throw new Error('SLACK_WEBHOOK_URL must be defined')
    slack = new Slack(process.env.SLACK_WEBHOOK_URL)
  }

  const ignoreFunctions = (process.env.IGNORE_FUNCTIONS || '').split(',')

  const scheduleInterval = Number(process.env.RULE_INTERVAL_IN_MINUTES)

  if (scheduleInterval < 0 || Number.isNaN(scheduleInterval)) throw new Error('Invalid RULE_INTERVAL_IN_MINUTES: ' + process.env.RULE_INTERVAL_IN_MINUTES)

  return main(cw, slack, event, scheduleInterval, ignoreFunctions)
}
