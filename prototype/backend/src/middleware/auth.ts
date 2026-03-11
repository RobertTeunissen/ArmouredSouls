import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // Use 401 for expired/invalid tokens so the frontend interceptor can
      // detect auth failures consistently and redirect to login.
      // 403 is reserved for authorization failures (e.g. "not admin").
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const payload = decoded as { userId: string | number; username: string; role: string };
    req.user = {
      userId: typeof payload.userId === 'string' ? parseInt(payload.userId, 10) : payload.userId,
      username: payload.username,
      role: payload.role,
    };
    next();
  });
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
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};
