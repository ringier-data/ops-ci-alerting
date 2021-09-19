'use strict'

const get = require('lodash.get')
const requestPromise = require('request-promise')
const aws = require('aws-sdk');
let cwl

// This lambda can be hooked up to CW alarms which alarm based on a MetricFilter
// and it will extract the log-lines causing the alarm to trigger
module.exports.handler = async function(event) {
  if (!cwl) cwl = new aws.CloudWatchLogs({region: process.env.AWS_REGION});
  if (event
     && event.source === 'aws.cloudwatch'
     && event['detail-type'] === 'CloudWatch Alarm State Change') {
    console.log(`Received AWS CloudWatch Alarm State Change event.`, {event})

    try {
      await processCwAlarmRecord(event)
      console.log('Posted all SNS records to slack')
    } catch (err) {
      console.error('Error during posting messages to slack')
      throw err
    }
  } else if (typeof event === 'object'
      && typeof event.detail === 'object'
      && event.source === 'aws.batch'
      && event['detail-type'] === 'Batch Job State Change'
      && event.detail && event.detail.status === 'FAILED') {
    // This happens when AWS Batch job fails
    try {
      await processAwsBatchFailedMessage(event)
      console.log('Posted all SNS records to slack')
    } catch (err) {
      console.error('Error during posting messages to slack')
      throw err
    }
  } else {
    console.log('Found no records')
  }
};

async function processAwsBatchFailedMessage(record) {
  return postSlackMessage(`:warning: AWS Batch job \`${record.detail.jobName}\` failed`, '#de4c1f', `Job ID ${record.detail.jobId}`, [])
}

async function processCwAlarmRecord(record) {
  const requestParams = {
      metricName: record.detail.configuration.metrics[0].metricStat.metric.name,
      metricNamespace: record.detail.configuration.metrics[0].metricStat.metric.namespace
  };
  const metricFilters = await cwl.describeMetricFilters(requestParams).promise()
  const { text, color, context, logs: attachments } = await getSlackMessage(record, metricFilters)
  return postSlackMessage(text, color, context, attachments)
}

async function postSlackMessage(text, color, context, attachments) {
  const body = {
    username: `CloudWatch (${process.env.ENVIRONMENT} ${process.env.AWS_REGION})`,
    attachments: [
      {
        color,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "plain_text",
                text: context,
              }
            ]
          }
        ]
      }
    ]
  }
  if (attachments && attachments.length > 0) {
    body.attachments[0].blocks.push({ type: "divider" })
    attachments.forEach(attachment => {
      body.attachments[0].blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: "```\n" + attachment + "\n```"
            }
          })
    })
  }
  await requestPromise({
    uri: process.env.SLACK_HOOK_URL,
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
    json: true,
    followRedirects: true,
    followAllRedirects: true,
  })
}

async function getSlackMessage(record, metricFilters) {
  const ALARM_WARNING_SYMBOL = ':warning:'
  const ALARM_RESOLVED_SYMBOL = ':white_check_mark:'
  const ALARM_RESOLVED_COLOR = '#00aa00'
  const ALARM_TRIGGERING_COLOR = '#de4c1f'
  
  const alarmDescription = record.detail.configuration.description || '(no alarm-description found!)'
  const alarmName = record.detail.alarmName || '(no alarm-name found!)'
  const logs = await getLogs(record, metricFilters)
  const isOK = record.detail.state.value === 'OK'
  const symbol = isOK ? ALARM_RESOLVED_SYMBOL : ALARM_WARNING_SYMBOL
  const summary = isOK ? 'Resolved' : 'Triggered'
  return {
    text: `${symbol} ${summary}: ${alarmDescription}`,
    context: `${alarmName} (${record.detail.state.timestamp})`,
    color: isOK ? ALARM_RESOLVED_COLOR : ALARM_TRIGGERING_COLOR,
    logs
  }
}


async function getLogs(record, metricFilterData) {
  var timestamp = Date.parse(record.detail.state.timestamp);
  var offset = record.detail.configuration.metrics[0].metricStat.period * 1000 * 2; // multiplying with 2 here to compensate for delays in StateChangeTime
  var metricFilter = metricFilterData.metricFilters[0];
  if (!metricFilter) return []
  var parameters = {
      'logGroupName' : metricFilter.logGroupName,
      'filterPattern' : metricFilter.filterPattern ? metricFilter.filterPattern : "",
        'startTime' : timestamp - offset,
        'endTime' : timestamp
  };
  const data = await cwl.filterLogEvents(parameters).promise()
  let logs = []
  for (let i = 0; i < data.events.length && i < 5; i++) { // limit
    try { 
      const msgObj = JSON.parse(data.events[i]['message'])
      const { traceId, msg, component, time } = msgObj
      let log = ""
      if (traceId) log += `traceId: "${traceId}"\n`
      if (component) log += `component: "${component}"\n`
      if (time) log += `time: "${time}"\n`
      if (msg) log += `msg: "${msg.substr(0,100)}${msg.length > 100 ? "(...)" : ""}"`
      logs.push(log)
    } catch {
      logs.push(data.events[i]['message'])
    }
  }
  return logs
}
