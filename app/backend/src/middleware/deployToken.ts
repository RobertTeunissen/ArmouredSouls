/**
 * Deploy token authentication middleware.
 *
 * Validates a static bearer token used by CI/CD pipelines (e.g., GitHub Actions)
 * to call internal service endpoints without a user JWT.
 *
 * The token is read from the CHANGELOG_DEPLOY_TOKEN environment variable on the
 * running backend instance. The CI runner sends the same secret as a Bearer token.
 *
 * Timing-safe comparison prevents timing attacks on the token value.
 */

import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

export interface DeployRequest extends Request {
  deployAuth?: true;
}

/**
 * Middleware that authenticates requests using a static deploy token.
 * Expects: `Authorization: Bearer <CHANGELOG_DEPLOY_TOKEN>`
 */
export function authenticateDeployToken(
  req: DeployRequest,
  res: Response,
  next: NextFunction,
): void {
  const expectedToken = process.env.CHANGELOG_DEPLOY_TOKEN;

  if (!expectedToken) {
    res.status(503).json({ error: 'Deploy token not configured' });
    return;
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ error: 'Deploy token required' });
    return;
  }

  // Timing-safe comparison to prevent timing attacks
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedToken);

  if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
    res.status(401).json({ error: 'Invalid deploy token' });
    return;
  }

  req.deployAuth = true;
  next();
}
