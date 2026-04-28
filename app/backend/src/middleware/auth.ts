import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getConfig } from '../config/env';
import prisma from '../lib/prisma';
import { securityMonitor } from '../services/security/securityMonitor';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    role: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwtSecret = getConfig().jwtSecret;

  let decoded: { userId: string | number; username: string; role: string; tokenVersion?: number };
  try {
    decoded = jwt.verify(token, jwtSecret) as typeof decoded;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const userId = typeof decoded.userId === 'string' ? parseInt(decoded.userId, 10) : decoded.userId;

  // Verify tokenVersion against the database to support server-side invalidation
  const tokenVersion = decoded.tokenVersion ?? 0;
  let dbRole: string;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true, stableName: true, role: true },
    });

    if (!user || user.tokenVersion !== tokenVersion) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    dbRole = user.role;

    // Cache stable name for security event enrichment (no extra DB call)
    if (user.stableName) {
      securityMonitor.setStableName(userId, user.stableName);
    }
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = {
    userId,
    username: decoded.username,
    role: dbRole,
  };
  next();
};

const adminRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `admin:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many admin requests. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  },
});

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    securityMonitor.logAuthorizationFailure(req.user.userId, 'admin_endpoint', 0, {
      sourceIp: req.ip || undefined,
      endpoint: req.originalUrl,
    });
    return res.status(403).json({ error: 'Admin access required' });
  }

  const sourceIp = req.ip || undefined;
  const endpoint = req.originalUrl;
  const method = req.method;

  securityMonitor.logAdminAccess(req.user.userId, { sourceIp, endpoint, method });

  adminRateLimiter(req, res, () => {
    next();
  });
};
