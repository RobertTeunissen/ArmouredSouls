import winston from 'winston';
import { CycleLoggerTransport } from '../utils/cycleLogger';

const isStructuredEnv = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'acceptance';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isStructuredEnv
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => `${level}: ${message}`)
      ),
  transports: [
    new winston.transports.Console(),
    new CycleLoggerTransport({
      // Give the cycle transport a plain format so it never receives ANSI codes
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.simple()
      ),
    }),
  ],
  ...(isStructuredEnv && { defaultMeta: { service: 'armouredsouls' } }),
});

export default logger;
