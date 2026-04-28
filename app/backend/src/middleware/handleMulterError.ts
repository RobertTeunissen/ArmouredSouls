import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

/** Translate MulterError into structured JSON responses. */
export function handleMulterError(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Maximum size is 2 MB.', code: 'FILE_TOO_LARGE' });
      return;
    }
    res.status(400).json({ error: err.message, code: 'INVALID_IMAGE' });
    return;
  }
  next(err);
}
