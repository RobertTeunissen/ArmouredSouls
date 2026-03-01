import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

class CycleLogger {
  private currentCycle: number | null = null;
  private logs: LogEntry[] = [];
  private preCycleLogs: LogEntry[] = []; // Logs before cycle starts
  private logsDir: string;
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private isCapturing: boolean = false;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'cycle_logs');
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Store original console methods
    this.originalConsoleLog = console.log.bind(console);
    this.originalConsoleError = console.error.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);

    // Start capturing immediately when server starts
    this.startCapturing();
  }

  startCycle(cycleNumber: number) {
    // Save previous cycle if exists
    if (this.currentCycle !== null && this.logs.length > 0) {
      this.saveCycleLogs();
    }

    this.currentCycle = cycleNumber;
    
    // Move pre-cycle logs into cycle logs
    this.logs = [...this.preCycleLogs];
    this.preCycleLogs = [];
    
    this.log('INFO', `=== Cycle ${cycleNumber} Started ===`);
  }

  private startCapturing() {
    if (this.isCapturing) return;
    this.isCapturing = true;

    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message,
      };
      
      // If cycle is active, add to cycle logs, otherwise add to pre-cycle logs
      if (this.currentCycle !== null) {
        this.logs.push(entry);
      } else {
        this.preCycleLogs.push(entry);
      }
      
      this.originalConsoleLog(...args);
    };

    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message,
      };
      
      // If cycle is active, add to cycle logs, otherwise add to pre-cycle logs
      if (this.currentCycle !== null) {
        this.logs.push(entry);
      } else {
        this.preCycleLogs.push(entry);
      }
      
      this.originalConsoleError(...args);
    };

    console.warn = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message,
      };
      
      // If cycle is active, add to cycle logs, otherwise add to pre-cycle logs
      if (this.currentCycle !== null) {
        this.logs.push(entry);
      } else {
        this.preCycleLogs.push(entry);
      }
      
      this.originalConsoleWarn(...args);
    };
  }

  private stopCapturing() {
    if (!this.isCapturing) return;
    this.isCapturing = false;

    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }

  log(level: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? JSON.stringify(data) : undefined,
    };
    this.logs.push(entry);

    // Also log to console using original method
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    this.originalConsoleLog(`[${level}] ${message}${dataStr}`);
  }

  endCycle() {
    if (this.currentCycle !== null) {
      this.log('INFO', `=== Cycle ${this.currentCycle} Ended ===`);
      this.saveCycleLogs();
      this.currentCycle = null;
      this.logs = [];
      // Don't stop capturing - keep capturing for next cycle
    }
  }

  private saveCycleLogs() {
    if (this.currentCycle === null || this.logs.length === 0) return;

    const filename = path.join(this.logsDir, `cycle${this.currentCycle}.csv`);
    
    // Create CSV content with pipes between columns
    const header = 'Timestamp | Level | Message\n';
    const rows = this.logs.map(entry => {
      const timestamp = entry.timestamp;
      const level = entry.level;
      const message = this.escapeCsv(entry.message);
      return `${timestamp} | ${level} | ${message}`;
    }).join('\n');

    const csv = header + rows;

    try {
      fs.writeFileSync(filename, csv, 'utf-8');
      this.originalConsoleLog(`[CycleLogger] Saved ${this.logs.length} log entries to ${filename}`);
    } catch (error) {
      this.originalConsoleError(`[CycleLogger] Error saving logs:`, error);
    }
  }

  private escapeCsv(str: string): string {
    // Escape quotes and handle newlines
    return str.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
  }
}

export const cycleLogger = new CycleLogger();
