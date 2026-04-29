import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import guideService from '../services/common/guide-service';
import { AppError } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { safeSlug } from '../utils/securityValidation';

const router = express.Router();

// --- Zod schemas for guide routes ---

const articleParamsSchema = z.object({
  sectionSlug: safeSlug,
  articleSlug: safeSlug,
});

/**
 * GET /api/guide/sections
 * Returns all guide sections with article summaries
 */
router.get('/sections', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const sections = guideService.getSections();
  res.json(sections);
});

/**
 * GET /api/guide/articles/:sectionSlug/:articleSlug
 * Returns a single guide article with full content
 */
router.get('/articles/:sectionSlug/:articleSlug', authenticateToken, validateRequest({ params: articleParamsSchema }), async (req: AuthRequest, res: Response) => {
  const sectionSlug = String(req.params.sectionSlug);
  const articleSlug = String(req.params.articleSlug);

  // Prevent path traversal — slugs must be simple alphanumeric/hyphen/underscore tokens
  const safeSlugPattern = /^[a-zA-Z0-9_-]+$/;
  if (!safeSlugPattern.test(sectionSlug) || !safeSlugPattern.test(articleSlug)) {
    throw new AppError('INVALID_SLUG', 'Invalid section or article slug', 400);
  }

  const article = guideService.getArticle(sectionSlug, articleSlug);

  if (!article) {
    throw new AppError('ARTICLE_NOT_FOUND', 'Article not found', 404);
  }

  res.json(article);
});

/**
 * GET /api/guide/search-index
 * Returns flat list of all articles for client-side search
 */
router.get('/search-index', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const searchIndex = guideService.getSearchIndex();
  res.json(searchIndex);
});

export default router;
