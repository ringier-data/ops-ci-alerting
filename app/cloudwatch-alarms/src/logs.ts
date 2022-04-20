class LogMessageNotKibanaReadyError extends Error {
  constructor() {
    super('The log message is not ready for Kibana search');
    this.name = 'LogMessageNotKibanaReadyError';
  }
}

function truncateMessage(msg: string): string {
  return `${msg.substring(0, 100)}${msg.length > 100 ? '(...)' : ''}`;
}

export function parseLogs(logs?: any[] | null): string[] {
  const parsed: string[] = [];
  const result: string[] = [];
  for (let i = 0; Array.isArray(logs) && i < logs.length && i < 5; i++) {
    // process only the first five messages
    try {
      const msgObj = JSON.parse(logs[i]['message'] as string);
      const { traceId, msg, component, time } = msgObj;
      if (!traceId) {
        // The message can be deserialized into a JSON object, but it does not have property `traceId`, we jump directly to the raw output
        // noinspection ExceptionCaughtLocallyJS
        throw new LogMessageNotKibanaReadyError();
      }
      let log = '';
      if (component) {
        log += `component: '${component}'\n`;
      }
      if (time) {
        log += `time: '${time}'\n`;
      }
      if (msg) {
        log += `msg: '${truncateMessage(msg)}'\n`;
      }
      if (traceId) {
        log += `traceId: '${traceId}'\n`;
      }
      parsed.push(log);
    } catch (err: unknown) {
      let msg = logs[i]['message'] as string;
      if (!(err instanceof LogMessageNotKibanaReadyError)) {
        // JSON.parse failed
        msg = truncateMessage(msg);
      }
      parsed.push(msg);
    }
  }

  if (parsed.length > 0) {
    parsed.forEach((log) => {
      let msg = '';
      log.split('\n').forEach((line: string) => {
        if (line.trim().length > 0) {
          msg = `${msg}${msg === '' ? '' : '\n'}${line}`;
        }
      });
      if (msg !== '') {
        result.push(msg);
      }
    });
  }

  return result;
}
