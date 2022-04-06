import { ScheduledEvent } from 'aws-lambda';
import aws from 'aws-sdk';
import { getLambdaErrors } from './metrics';
import { Slack } from './slack'

export const main = async (cw: aws.CloudWatch, slack: Slack, event: ScheduledEvent, scheduleRateIntervalInMinutes: number, ignoreFunctions: string[]) => {
  if (event.source !== 'aws.events') throw new Error('Got event.source "' + event.source + '". Only aws.events is supported.')
  if (event['detail-type'] !== 'Scheduled Event') throw new Error('Got event[detail-type] "' + event['detail-type'] + '". Only Scheduled Event is supported.')
  // LOOK INTO / TODO: Use the rule ARN from event.resources[0] to look up the periodicity instead of hard-coding it in RULE_INTERVAL_IN_MINUTES.
  // Then we could have one for example every 5 minutes and one every morning/week.
  // if (event.resources.length !== 1) throw new Error('Got event.resources='+JSON.stringify(event.resources) + '. Only exactly 1 element is supported.')

  const endTime = new Date(Date.parse(event.time))

  // Get all lambda fn:s error count
  const functionErrorCount = await getLambdaErrors(cw, endTime, scheduleRateIntervalInMinutes)
  console.log(`Found ${functionErrorCount.length} metrics.`, {functionErrorCount})

  // Filter out > 0 errors
  const functionsWhichDidError = functionErrorCount.filter(x => x.errors > 0 )
  console.log(`Found ${functionsWhichDidError.length} metrics which have errors > 0.`, {functionsWhichDidError})

  // Filter out based on `ignoreFunctions` argument
  const filteredFunctionsWhichDidErrors = functionsWhichDidError.filter(x => ignoreFunctions.includes(x.name) === false)
  console.log(`Found ${filteredFunctionsWhichDidErrors.length} metrics after filtering which have errors > 0.`, {filteredFunctionsWhichDidErrors})

  if (filteredFunctionsWhichDidErrors.length > 0) {
    await Promise.all(filteredFunctionsWhichDidErrors.map(x => slack.postMessage(getSlackBody(x.name, x.errors, endTime, scheduleRateIntervalInMinutes))))
    console.log(`Posted all to Slack.`)
  } else {
    console.log(`Nothing to do. Exiting.`)
  }
}

const getSlackBody = (functionName: string, errorCount: number, endTime: Date, scheduleRateIntervalInMinutes: number) => {
  const textRealtime = `in the last ${scheduleRateIntervalInMinutes} minutes`
  const textOlder = `between ${new Date(endTime.valueOf() - scheduleRateIntervalInMinutes)} and ${endTime}`
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:warning: *Lambda Error* Function \`${functionName}\` failed ${errorCount} times ${(new Date().valueOf() - endTime.valueOf()) > 60000 ? textOlder : textRealtime}`,
        },
      },
    ]
  }
}
