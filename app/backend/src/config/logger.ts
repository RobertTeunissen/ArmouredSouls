import winston from 'winston';
import { CycleLoggerTransport } from '../utils/cycleLogger';
import { getConfig } from './env';

const { nodeEnv, logLevel } = getConfig();
const isStructuredEnv = nodeEnv === 'production' || nodeEnv === 'acceptance';

const logger = winston.createLogger({
  level: logLevel,
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
