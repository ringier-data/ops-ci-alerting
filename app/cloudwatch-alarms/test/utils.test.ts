import { shortenTimestamp } from '../src/utils';

describe('Utilities', () => {
  it('should shorten the timestamp', () => {
    // Summer
    expect(shortenTimestamp('2022-04-01T07:18:59.951+0000')).toBe('20220401 09:18:59');
    expect(shortenTimestamp('2022-04-01T07:18:59.951Z')).toBe('20220401 09:18:59');
    expect(shortenTimestamp('2022-10-11T07:18:59.951+0000')).toBe('20221011 09:18:59');
    // Winter
    expect(shortenTimestamp('2022-02-01T07:18:59.951+0000')).toBe('20220201 08:18:59');
    expect(shortenTimestamp('2022-02-01T07:18:59.951Z')).toBe('20220201 08:18:59');
    expect(shortenTimestamp('2022-12-25T07:18:59.951+0000')).toBe('20221225 08:18:59');
    expect(shortenTimestamp('2022-12-25T07:18:59.951Z')).toBe('20221225 08:18:59');
  });
});
