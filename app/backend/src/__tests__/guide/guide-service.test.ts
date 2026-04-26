/**
 * Unit tests for GuideService.
 * Tests section/article existence (content-dependent), 404 behavior, and cache invalidation.
 *
 * Content existence tests are conditionally skipped when content hasn't been authored yet.
 * 404 and cache tests use temporary directories so they pass immediately.
 *
 * Validates: Requirements 2.1, 4.1-4.4, 5.1-5.5, 6.1-6.6, 7.1-7.5, 8.1-8.6,
 *            9.1-9.4, 10.1-10.6, 11.1-11.5, 12.1-12.5, 13.1-13.3, 20.1-20.6
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GuideService } from '../../services/common/guide-service';

// Mock the logger to suppress output during tests
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// --- Temp directory helpers ---

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guide-unit-'));
}

function removeTempDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function writeArticle(
  contentDir: string,
  sectionSlug: string,
  articleSlug: string,
  overrides: Partial<{ title: string; description: string; order: number; lastUpdated: string; body: string; relatedArticles: string[] }> = {}
): void {
  const sectionDir = path.join(contentDir, sectionSlug);
  fs.mkdirSync(sectionDir, { recursive: true });

  const title = overrides.title ?? articleSlug;
  const description = overrides.description ?? `Description for ${articleSlug}`;
  const order = overrides.order ?? 1;
  const lastUpdated = overrides.lastUpdated ?? '2026-01-01';
  const body = overrides.body ?? `## Overview\n\nContent for ${articleSlug}.`;
  const relatedBlock =
    overrides.relatedArticles && overrides.relatedArticles.length > 0
      ? `relatedArticles:\n${overrides.relatedArticles.map((r) => `  - ${r}`).join('\n')}\n`
      : '';

  const content = `---
title: "${title}"
description: "${description}"
order: ${order}
lastUpdated: "${lastUpdated}"
${relatedBlock}---

${body}
`;
  fs.writeFileSync(path.join(sectionDir, `${articleSlug}.md`), content);
}

function writeSectionsJson(contentDir: string, sections: Array<{ slug: string; title: string; order: number; description?: string }>): void {
  const data = sections.map((s) => ({
    slug: s.slug,
    title: s.title,
    description: s.description ?? `Description for ${s.title}`,
    order: s.order,
  }));
  fs.writeFileSync(path.join(contentDir, 'sections.json'), JSON.stringify(data, null, 2));
}

// --- Content existence tests (skip when content not yet authored) ---

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content', 'guide');

/**
 * Check if the content directory has actual articles (not just .gitkeep).
 */
function contentHasArticles(): boolean {
  try {
    const sectionsPath = path.join(CONTENT_DIR, 'sections.json');
    if (!fs.existsSync(sectionsPath)) return false;

    const sections: Array<{ slug: string }> = JSON.parse(fs.readFileSync(sectionsPath, 'utf-8'));
    for (const section of sections) {
      const sectionDir = path.join(CONTENT_DIR, section.slug);
      if (!fs.existsSync(sectionDir)) continue;
      const files = fs.readdirSync(sectionDir).filter((f) => f.endsWith('.md'));
      if (files.length > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const hasContent = contentHasArticles();
const describeContent = hasContent ? describe : describe.skip;

describeContent('GuideService — content existence (Req 2.1)', () => {
  let service: GuideService;

  beforeAll(() => {
    service = new GuideService(CONTENT_DIR);
  });

  const REQUIRED_SECTIONS = [
    'getting-started',
    'robots',
    'combat',
    'weapons',
    'leagues',
    'tournaments',
    'economy',
    'facilities',
    'prestige-fame',
    'achievements',
    'strategy',
    'integrations',
  ] as const;

  it('should return all 12 required sections', () => {
    const sections = service.getSections();
    const slugs = sections.map((s) => s.slug);

    for (const required of REQUIRED_SECTIONS) {
      expect(slugs).toContain(required);
    }
    expect(sections.length).toBeGreaterThanOrEqual(12);
  });

  // Req 4.1-4.4: Getting Started articles
  describe('Getting Started section (Req 4)', () => {
    it('should contain core-game-loop article', () => {
      const article = service.getArticle('getting-started', 'core-game-loop');
      expect(article).not.toBeNull();
    });

    it('should contain daily-cycle article', () => {
      const article = service.getArticle('getting-started', 'daily-cycle');
      expect(article).not.toBeNull();
    });

    it('should contain starting-budget article', () => {
      const article = service.getArticle('getting-started', 'starting-budget');
      expect(article).not.toBeNull();
    });

    it('should contain roster-strategy article', () => {
      const article = service.getArticle('getting-started', 'roster-strategy');
      expect(article).not.toBeNull();
    });
  });

  // Req 5.1-5.5: Robots articles
  describe('Robots section (Req 5)', () => {
    it('should contain at least one article covering attributes', () => {
      const sections = service.getSections();
      const robotsSection = sections.find((s) => s.slug === 'robots');
      expect(robotsSection).toBeDefined();
      expect(robotsSection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Req 6.1-6.6: Combat articles
  describe('Combat section (Req 6)', () => {
    it('should contain battle-flow article', () => {
      expect(service.getArticle('combat', 'battle-flow')).not.toBeNull();
    });

    it('should contain malfunctions article', () => {
      expect(service.getArticle('combat', 'malfunctions')).not.toBeNull();
    });

    it('should contain stances article', () => {
      expect(service.getArticle('combat', 'stances')).not.toBeNull();
    });

    it('should contain yield-threshold article', () => {
      expect(service.getArticle('combat', 'yield-threshold')).not.toBeNull();
    });

    it('should contain counter-attacks article', () => {
      expect(service.getArticle('combat', 'counter-attacks')).not.toBeNull();
    });
  });

  // Req 7.1-7.5: Weapons articles
  describe('Weapons section (Req 7)', () => {
    it('should contain at least one article on categories or loadout types', () => {
      const sections = service.getSections();
      const weaponsSection = sections.find((s) => s.slug === 'weapons');
      expect(weaponsSection).toBeDefined();
      expect(weaponsSection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Req 8.1-8.6: Leagues articles
  describe('Leagues section (Req 8)', () => {
    it('should contain at least one article on tiers, matchmaking, LP, or promotion', () => {
      const sections = service.getSections();
      const leaguesSection = sections.find((s) => s.slug === 'leagues');
      expect(leaguesSection).toBeDefined();
      expect(leaguesSection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Req 9.1-9.4: Tournaments articles
  describe('Tournaments section (Req 9)', () => {
    it('should contain at least one article on format, eligibility, rewards, or byes', () => {
      const sections = service.getSections();
      const tournamentsSection = sections.find((s) => s.slug === 'tournaments');
      expect(tournamentsSection).toBeDefined();
      expect(tournamentsSection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Req 10.1-10.6: Economy articles
  describe('Economy section (Req 10)', () => {
    it('should contain at least one article on credits, rewards, costs, merchandising, or streaming', () => {
      const sections = service.getSections();
      const economySection = sections.find((s) => s.slug === 'economy');
      expect(economySection).toBeDefined();
      expect(economySection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Req 11.1-11.5: Facilities articles
  describe('Facilities section (Req 11)', () => {
    it('should contain at least one article on facility types, academies, or coaching', () => {
      const sections = service.getSections();
      const facilitiesSection = sections.find((s) => s.slug === 'facilities');
      expect(facilitiesSection).toBeDefined();
      expect(facilitiesSection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Req 12.1-12.5: Prestige & Fame articles
  describe('Prestige & Fame section (Req 12)', () => {
    it('should contain at least one article on prestige or fame', () => {
      const sections = service.getSections();
      const prestigeSection = sections.find((s) => s.slug === 'prestige-fame');
      expect(prestigeSection).toBeDefined();
      expect(prestigeSection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Req 13.1-13.3: Strategy articles
  describe('Strategy section (Req 13)', () => {
    it('should contain at least one article on archetypes, yield strategy, or budget', () => {
      const sections = service.getSections();
      const strategySection = sections.find((s) => s.slug === 'strategy');
      expect(strategySection).toBeDefined();
      expect(strategySection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Req 20.1-20.6: Integrations articles
  describe('Integrations section (Req 20)', () => {
    it('should contain at least one article on notifications or webhooks', () => {
      const sections = service.getSections();
      const integrationsSection = sections.find((s) => s.slug === 'integrations');
      expect(integrationsSection).toBeDefined();
      expect(integrationsSection!.articles.length).toBeGreaterThanOrEqual(1);
    });
  });
});


// --- 404 behavior tests (use temp directory, pass immediately) ---

describe('GuideService — 404 behavior', () => {
  let tempDir: string;
  let service: GuideService;

  beforeEach(() => {
    tempDir = createTempDir();
    writeSectionsJson(tempDir, [
      { slug: 'combat', title: 'Combat', order: 1 },
    ]);
    writeArticle(tempDir, 'combat', 'battle-flow', {
      title: 'Battle Flow',
      description: 'How attacks resolve',
      order: 1,
    });
    service = new GuideService(tempDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it('should return null for a non-existent section slug', () => {
    const result = service.getArticle('nonexistent-section', 'battle-flow');
    expect(result).toBeNull();
  });

  it('should return null for a non-existent article slug in a valid section', () => {
    const result = service.getArticle('combat', 'nonexistent-article');
    expect(result).toBeNull();
  });

  it('should return null when both section and article slugs are invalid', () => {
    const result = service.getArticle('fake-section', 'fake-article');
    expect(result).toBeNull();
  });

  it('should return empty sections list when content directory is missing', () => {
    const missingDir = path.join(tempDir, 'does-not-exist');
    const emptyService = new GuideService(missingDir);
    const sections = emptyService.getSections();
    expect(sections).toEqual([]);
  });
});

// --- Cache invalidation tests (use temp directory, pass immediately) ---

describe('GuideService — cache invalidation', () => {
  let tempDir: string;

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it('should re-read sections from disk after invalidateCache()', () => {
    tempDir = createTempDir();
    writeSectionsJson(tempDir, [
      { slug: 'combat', title: 'Combat', order: 1 },
    ]);
    writeArticle(tempDir, 'combat', 'battle-flow', {
      title: 'Battle Flow',
      description: 'How attacks resolve',
      order: 1,
    });

    const service = new GuideService(tempDir);

    // First call populates cache
    const sections1 = service.getSections();
    expect(sections1).toHaveLength(1);
    expect(sections1[0].slug).toBe('combat');

    // Add a new section on disk
    writeSectionsJson(tempDir, [
      { slug: 'combat', title: 'Combat', order: 1 },
      { slug: 'economy', title: 'Economy', order: 2 },
    ]);
    writeArticle(tempDir, 'economy', 'credits', {
      title: 'Credits',
      description: 'Currency system',
      order: 1,
    });

    // Without invalidation, cache returns stale data
    const sections2 = service.getSections();
    expect(sections2).toHaveLength(1);

    // After invalidation, fresh data is returned
    service.invalidateCache();
    const sections3 = service.getSections();
    expect(sections3).toHaveLength(2);
    expect(sections3.map((s) => s.slug)).toContain('economy');
  });

  it('should clear cached articles after invalidateCache()', () => {
    tempDir = createTempDir();
    writeSectionsJson(tempDir, [
      { slug: 'combat', title: 'Combat', order: 1 },
    ]);
    writeArticle(tempDir, 'combat', 'stances', {
      title: 'Stances',
      description: 'Offensive, defensive, balanced',
      order: 1,
      body: '## Original Content\n\nOriginal body.',
    });

    const service = new GuideService(tempDir);

    // First call caches the article
    const article1 = service.getArticle('combat', 'stances');
    expect(article1).not.toBeNull();
    expect(article1!.body).toContain('Original body.');

    // Update the article on disk
    writeArticle(tempDir, 'combat', 'stances', {
      title: 'Stances',
      description: 'Offensive, defensive, balanced',
      order: 1,
      body: '## Updated Content\n\nUpdated body.',
    });

    // Without invalidation, cache returns stale article
    const article2 = service.getArticle('combat', 'stances');
    expect(article2!.body).toContain('Original body.');

    // After invalidation, fresh article is returned
    service.invalidateCache();
    const article3 = service.getArticle('combat', 'stances');
    expect(article3).not.toBeNull();
    expect(article3!.body).toContain('Updated body.');
  });

  it('should clear cached search index after invalidateCache()', () => {
    tempDir = createTempDir();
    writeSectionsJson(tempDir, [
      { slug: 'combat', title: 'Combat', order: 1 },
    ]);
    writeArticle(tempDir, 'combat', 'battle-flow', {
      title: 'Battle Flow',
      description: 'Attack resolution',
      order: 1,
    });

    const service = new GuideService(tempDir);

    // First call populates search index cache
    const index1 = service.getSearchIndex();
    expect(index1).toHaveLength(1);

    // Add another article on disk
    writeArticle(tempDir, 'combat', 'stances', {
      title: 'Stances',
      description: 'Combat stances',
      order: 2,
    });

    // Without invalidation, stale index
    const index2 = service.getSearchIndex();
    expect(index2).toHaveLength(1);

    // After invalidation, fresh index
    service.invalidateCache();
    const index3 = service.getSearchIndex();
    expect(index3).toHaveLength(2);
  });
});
