import winston from 'winston';

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
        winston.format.simple()
      ),
  transports: [
    new winston.transports.Console(),
  ],
  defaultMeta: { service: 'armouredsouls' },
});

export default logger;
