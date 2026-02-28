import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) =>
    req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) =>
    req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
});
