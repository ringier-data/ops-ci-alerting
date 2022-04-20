import { parseLogs } from '../src/logs';

describe('Logs processor', () => {
  it('should return empty array if nothing to process', () => {
    expect(parseLogs()).toEqual([]);
    expect(parseLogs(null)).toEqual([]);
    expect(parseLogs([])).toEqual([]);
  });

  it('should return raw message if the message is not in JSON', () => {
    const msg1 = 'INFO: plain message 1';
    const msg2 = 'INFO: plain message 2';
    expect(parseLogs([{ message: msg1 }, { message: msg2 }])).toEqual(['INFO: plain message 1', 'INFO: plain message 2']);
  });

  it('should handle newlines properly if the message is not in JSON', () => {
    expect(parseLogs([{ message: '\nINFO: plain message\n\n' }])).toEqual(['INFO: plain message']);
  });

  it('should handle JSON message if it is Kibana-ready', () => {
    const obj1 = {
      traceId: '365c2460-b62b-11ec-8da8-77219ae214fc',
    };
    expect(parseLogs([{ message: JSON.stringify(obj1) }])).toEqual(["traceId: '365c2460-b62b-11ec-8da8-77219ae214fc'"]);

    const obj2 = {
      traceId: '365c2460-b62b-11ec-8da8-77219ae214fc',
      msg: 'Caught Error-error at POST "/analytics/telemetry/ph/api/hyper/send?_c&_i=test": invalid JSON, only s(...)',
      time: '1649305725353',
      component: 'ski-backend',
      foo: 'bar',
    };
    expect(parseLogs([{ message: JSON.stringify(obj2) }])).toEqual([
      "component: 'ski-backend'\ntime: '1649305725353'\nmsg: 'Caught Error-error at POST \"/analytics/telemetry/ph/api/hyper/send?_c&_i=test\": invalid JSON, only s(...)'\ntraceId: '365c2460-b62b-11ec-8da8-77219ae214fc'",
    ]);
  });

  it('should handle JSON message if it is not Kibana-ready', () => {
    const obj = {
      time: '1649305725353',
      level: 'ERROR',
      foo: 'bar',
      jane: 'doe',
    };
    expect(parseLogs([{ message: JSON.stringify(obj) }])).toEqual(['{"time":"1649305725353","level":"ERROR","foo":"bar","jane":"doe"}']);
  });

  it('should truncate plain message when it too long', () => {
    const short = '0123456789';
    const long = '01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
    const result = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789(...)';
    expect(parseLogs([{ message: short }])).toEqual(['0123456789']);
    expect(parseLogs([{ message: long }])).toEqual([result]);
  });

  it('should truncate Kibana JSON message when it too long', () => {
    const short = {
      traceId: '365c2460-b62b-11ec-8da8-77219ae214fc',
      msg: '0123456789',
    };
    const long = {
      traceId: '365c2460-b62b-11ec-8da8-77219ae214fc',
      msg: '01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789',
    };
    expect(parseLogs([{ message: JSON.stringify(short) }])).toEqual([
      "msg: '0123456789'\ntraceId: '365c2460-b62b-11ec-8da8-77219ae214fc'",
    ]);
    expect(parseLogs([{ message: JSON.stringify(long) }])).toEqual([
      "msg: '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789(...)'\ntraceId: '365c2460-b62b-11ec-8da8-77219ae214fc'",
    ]);
  });

  it('should not truncate non Kibana JSON message when it too long', () => {
    const short = {
      id: '365c2460-b62b-11ec-8da8-77219ae214fc',
      msg: '0123456789',
    };
    const long = {
      id: '365c2460-b62b-11ec-8da8-77219ae214fc',
      msg: '01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789',
    };
    expect(parseLogs([{ message: JSON.stringify(short) }])).toEqual([JSON.stringify(short)]);
    expect(parseLogs([{ message: JSON.stringify(long) }])).toEqual([JSON.stringify(long)]);
  });
});
