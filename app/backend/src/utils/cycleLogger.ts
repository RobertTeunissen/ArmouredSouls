import fs from 'fs';
import path from 'path';
import Transport from 'winston-transport';
import logger from '../config/logger';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

class CycleLogger {
  private currentCycle: number | null = null;
  private logs: LogEntry[] = [];
  private logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'cycle_logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /** Called by the Winston transport for every log message */
  capture(level: string, message: string): void {
    // Filter noise
    if (message.includes('[dotenv@') || message.includes('injecting env')) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
    };

    if (this.currentCycle !== null) {
      this.logs.push(entry);
    }
  }

  startCycle(cycleNumber: number): void {
    // Save previous cycle if exists
    if (this.currentCycle !== null && this.logs.length > 0) {
      this.saveCycleLogs();
    }

    this.currentCycle = cycleNumber;
    this.logs = [];
    this.logs.push({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `=== Cycle ${cycleNumber} Started ===`,
    });
  }

  endCycle(): void {
    if (this.currentCycle !== null) {
      this.logs.push({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `=== Cycle ${this.currentCycle} Ended ===`,
      });
      this.saveCycleLogs();
      this.currentCycle = null;
      this.logs = [];
    }
  }

  /** Direct log method for non-Winston callers */
  log(level: string, message: string, data?: Record<string, unknown>): void {
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    this.capture(level, `${message}${dataStr}`);
  }

  private saveCycleLogs(): void {
    if (this.currentCycle === null || this.logs.length === 0) return;

    const filename = path.join(this.logsDir, `cycle${this.currentCycle}.csv`);

    const header = 'Timestamp | Level | Message\n';
    const rows = this.logs.map(entry => {
      const message = this.escapeCsv(entry.message);
      return `${entry.timestamp} | ${entry.level} | ${message}`;
    }).join('\n');

    try {
      fs.writeFileSync(filename, header + rows, 'utf-8');
      logger.info(`[CycleLogger] Saved ${this.logs.length} log entries to ${filename}`);
    } catch (error) {
      logger.error(`[CycleLogger] Error saving logs:`, error);
    }
  }

  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  private escapeCsv(str: string): string {
    return this.stripAnsi(str).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
  }
}

export const cycleLogger = new CycleLogger();

/**
 * Winston transport that feeds log messages into the CycleLogger.
 * Add this to the Winston logger's transports array.
 */
export class CycleLoggerTransport extends Transport {
  log(info: Record<string, unknown>, callback: () => void): void {
    const level = (info.level as string) || 'info';
    const message = (info.message as string) || '';
    cycleLogger.capture(level, message);
    callback();
  }
}
