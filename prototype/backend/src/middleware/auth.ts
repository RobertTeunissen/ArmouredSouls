import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    if (!user || user.tokenVersion !== tokenVersion) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = {
    userId,
    username: decoded.username,
    role: decoded.role,
  };
  next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    securityMonitor.logAuthorizationFailure(req.user.userId, 'admin_endpoint', 0);
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};
