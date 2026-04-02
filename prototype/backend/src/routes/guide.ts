import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import guideService from '../services/common/guide-service';
import logger from '../config/logger';
import { AppError } from '../errors';

const router = express.Router();

/**
 * GET /api/guide/sections
 * Returns all guide sections with article summaries
 */
router.get('/sections', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sections = guideService.getSections();
    res.json(sections);
  } catch (error) {
    logger.error('[Guide] Failed to fetch sections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/guide/articles/:sectionSlug/:articleSlug
 * Returns a single guide article with full content
 */
router.get('/articles/:sectionSlug/:articleSlug', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sectionSlug = String(req.params.sectionSlug);
    const articleSlug = String(req.params.articleSlug);
    const article = guideService.getArticle(sectionSlug, articleSlug);

    if (!article) {
      throw new AppError('ARTICLE_NOT_FOUND', 'Article not found', 404);
    }

    res.json(article);
  } catch (error) {
    logger.error('[Guide] Failed to fetch article:', error);
    throw error;
  }
});

/**
 * GET /api/guide/search-index
 * Returns flat list of all articles for client-side search
 */
router.get('/search-index', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const searchIndex = guideService.getSearchIndex();
    res.json(searchIndex);
  } catch (error) {
    logger.error('[Guide] Failed to fetch search index:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
