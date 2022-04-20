/**
 * Simplify the timestamp string to keep it short
 */
export function shortenTimestamp(input: string): string {
  const time = new Date(input).toLocaleString('de-CH', {
    timeZone: 'Europe/Zurich',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${time.substring(6, 10)}${time.substring(3, 5)}${time.substring(0, 2)} ${time.substring(12, 20)}`;
}
