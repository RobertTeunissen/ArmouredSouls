/**
 * Dedicated Security Logger
 *
 * A separate Winston logger instance that writes structured JSON security events
 * to `logs/security.log`. This keeps security events on a dedicated channel,
 * independent of the main application log.
 *
 * @module services/security/securityLogger
 * @see Requirements 7.6
 */

import winston from 'winston';

export enum SecuritySeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface SecurityEvent {
  severity: SecuritySeverity;
  eventType: string;
  userId?: number;
  stableName?: string;
  sourceIp?: string;
  endpoint?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

const securityTransport = new winston.transports.File({
  filename: 'logs/security.log',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

export const securityLogger = winston.createLogger({
  levels: {
    critical: 0,
    warning: 1,
    info: 2,
  },
  level: 'info',
  defaultMeta: { channel: 'security' },
  transports: [securityTransport],
});
