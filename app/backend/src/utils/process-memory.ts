import os from 'node:os';

const BYTES_PER_MEBIBYTE = 1024 * 1024;

function toMebibytes(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MEBIBYTE);
}

/** Format process and host memory without retaining payload or user data. */
export function formatProcessMemoryUsage(): string {
  const usage = process.memoryUsage();
  return [
    `rss=${toMebibytes(usage.rss)}MiB`,
    `heapUsed=${toMebibytes(usage.heapUsed)}MiB`,
    `heapTotal=${toMebibytes(usage.heapTotal)}MiB`,
    `external=${toMebibytes(usage.external)}MiB`,
    `systemFree=${toMebibytes(os.freemem())}MiB`,
  ].join(' ');
}
