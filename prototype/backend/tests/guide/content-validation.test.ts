/**
 * Content validation tests for the in-game guide.
 * Validates that all required sections, articles, frontmatter, related article
 * references, and mermaid diagrams exist and are well-formed.
 *
 * Validates: Requirements 2.1, 4.1-4.4, 5.2, 6.2, 8.6, 10.6, 15.1, 20.5
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(__dirname, '..', '..', 'src', 'content', 'guide');
const SECTIONS_JSON_PATH = path.join(CONTENT_DIR, 'sections.json');

interface SectionEntry {
  slug: string;
  title: string;
  description: string;
  order: number;
}

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
  'strategy',
  'integrations',
] as const;

/** Read and parse sections.json */
function loadSections(): SectionEntry[] {
  const raw = fs.readFileSync(SECTIONS_JSON_PATH, 'utf-8');
  return JSON.parse(raw) as SectionEntry[];
}

/** List all .md files in a section directory */
function listArticleFiles(sectionSlug: string): string[] {
  const dir = path.join(CONTENT_DIR, sectionSlug);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
}

/** Read raw content of an article file */
function readArticleContent(sectionSlug: string, articleSlug: string): string {
  const filePath = path.join(CONTENT_DIR, sectionSlug, `${articleSlug}.md`);
  return fs.readFileSync(filePath, 'utf-8');
}

/** Parse frontmatter from an article file */
function parseFrontmatter(sectionSlug: string, fileName: string): matter.GrayMatterFile<string> {
  const filePath = path.join(CONTENT_DIR, sectionSlug, fileName);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return matter(raw);
}

/** Collect all article files across all sections */
function collectAllArticles(): Array<{ sectionSlug: string; fileName: string }> {
  const sections = loadSections();
  const articles: Array<{ sectionSlug: string; fileName: string }> = [];
  for (const section of sections) {
    const files = listArticleFiles(section.slug);
    for (const f of files) {
      articles.push({ sectionSlug: section.slug, fileName: f });
    }
  }
  return articles;
}

// ─── 1. Sections existence (Req 2.1) ────────────────────────────────────────

describe('Content Validation — sections.json (Req 2.1, 15.1)', () => {
  let sections: SectionEntry[];

  beforeAll(() => {
    sections = loadSections();
  });

  it('should contain all 11 required sections', () => {
    const slugs = sections.map((s) => s.slug);
    for (const required of REQUIRED_SECTIONS) {
      expect(slugs).toContain(required);
    }
  });

  it('should have exactly 11 sections', () => {
    expect(sections).toHaveLength(11);
  });

  it.each(
    REQUIRED_SECTIONS.map((slug) => [slug])
  )('section "%s" should have slug, title, description, and order', (slug) => {
    const section = sections.find((s) => s.slug === slug);
    expect(section).toBeDefined();
    expect(section!.title).toBeTruthy();
    expect(section!.description).toBeTruthy();
    expect(typeof section!.order).toBe('number');
  });
});

// ─── 2. Each section directory has at least one .md file ─────────────────────

describe('Content Validation — section directories contain articles', () => {
  it.each(
    REQUIRED_SECTIONS.map((slug) => [slug])
  )('section "%s" should contain at least one .md file', (slug) => {
    const files = listArticleFiles(slug);
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 3. Frontmatter validation (Req 15.1) ───────────────────────────────────

describe('Content Validation — frontmatter', () => {
  const allArticles = collectAllArticles();

  it.each(
    allArticles.map((a) => [`${a.sectionSlug}/${a.fileName}`, a.sectionSlug, a.fileName])
  )('"%s" should have valid frontmatter with title, description, order, lastUpdated', (_label, sectionSlug, fileName) => {
    const parsed = parseFrontmatter(sectionSlug as string, fileName as string);
    const { data } = parsed;

    expect(data.title).toBeTruthy();
    expect(typeof data.title).toBe('string');

    expect(data.description).toBeTruthy();
    expect(typeof data.description).toBe('string');

    expect(typeof data.order).toBe('number');

    expect(data.lastUpdated).toBeTruthy();
    // lastUpdated should be a valid date string
    expect(isNaN(Date.parse(String(data.lastUpdated)))).toBe(false);
  });
});

// ─── 4. Related articles references (Req 15.1) ──────────────────────────────

describe('Content Validation — relatedArticles references', () => {
  const allArticles = collectAllArticles();

  const articlesWithRelated = allArticles.filter((a) => {
    const parsed = parseFrontmatter(a.sectionSlug, a.fileName);
    return Array.isArray(parsed.data.relatedArticles) && parsed.data.relatedArticles.length > 0;
  });

  if (articlesWithRelated.length === 0) {
    it('should have at least some articles with relatedArticles', () => {
      expect(articlesWithRelated.length).toBeGreaterThan(0);
    });
    return;
  }

  it.each(
    articlesWithRelated.map((a) => [`${a.sectionSlug}/${a.fileName}`, a.sectionSlug, a.fileName])
  )('"%s" relatedArticles should all point to existing files', (_label, sectionSlug, fileName) => {
    const parsed = parseFrontmatter(sectionSlug as string, fileName as string);
    const related: string[] = parsed.data.relatedArticles;

    for (const ref of related) {
      // ref format: "sectionSlug/articleSlug"
      const [refSection, refArticle] = ref.split('/');
      const refPath = path.join(CONTENT_DIR, refSection, `${refArticle}.md`);
      expect(fs.existsSync(refPath)).toBe(true);
    }
  });
});

// ─── 5. Specific articles per section (Req 4-13, 20) ────────────────────────

describe('Content Validation — required articles per section', () => {
  // Req 4.1-4.4: Getting Started
  describe('getting-started (Req 4)', () => {
    const required = ['core-game-loop', 'daily-cycle', 'starting-budget', 'roster-strategy'];
    it.each(required.map((a) => [a]))('should contain "%s" article', (slug) => {
      const filePath = path.join(CONTENT_DIR, 'getting-started', `${slug}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // Req 5: Robots — at least 2 articles covering attributes and training
  describe('robots (Req 5)', () => {
    it('should contain at least 2 articles', () => {
      const files = listArticleFiles('robots');
      expect(files.length).toBeGreaterThanOrEqual(2);
    });
  });

  // Req 6: Combat
  describe('combat (Req 6)', () => {
    const required = ['battle-flow', 'malfunctions', 'stances', 'yield-threshold', 'counter-attacks'];
    it.each(required.map((a) => [a]))('should contain "%s" article', (slug) => {
      const filePath = path.join(CONTENT_DIR, 'combat', `${slug}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // Req 7: Weapons — at least 2 articles covering categories and loadouts
  describe('weapons (Req 7)', () => {
    it('should contain at least 2 articles', () => {
      const files = listArticleFiles('weapons');
      expect(files.length).toBeGreaterThanOrEqual(2);
    });
  });

  // Req 8: Leagues — at least 3 articles covering tiers, matchmaking, promotion
  describe('leagues (Req 8)', () => {
    it('should contain at least 3 articles', () => {
      const files = listArticleFiles('leagues');
      expect(files.length).toBeGreaterThanOrEqual(3);
    });
  });

  // Req 9: Tournaments
  describe('tournaments (Req 9)', () => {
    const required = ['tournament-format', 'eligibility', 'rewards', 'bye-matches'];
    it.each(required.map((a) => [a]))('should contain "%s" article', (slug) => {
      const filePath = path.join(CONTENT_DIR, 'tournaments', `${slug}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // Req 10: Economy
  describe('economy (Req 10)', () => {
    const required = [
      'credits-and-income',
      'battle-rewards',
      'repair-costs',
      'merchandising',
      'streaming-revenue',
      'daily-financial-cycle',
    ];
    it.each(required.map((a) => [a]))('should contain "%s" article', (slug) => {
      const filePath = path.join(CONTENT_DIR, 'economy', `${slug}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // Req 11: Facilities
  describe('facilities (Req 11)', () => {
    const required = [
      'facility-overview',
      'facility-progression',
      'training-academies',
      'coaching-staff',
      'investment-strategy',
    ];
    it.each(required.map((a) => [a]))('should contain "%s" article', (slug) => {
      const filePath = path.join(CONTENT_DIR, 'facilities', `${slug}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // Req 12: Prestige & Fame — at least 3 articles
  describe('prestige-fame (Req 12)', () => {
    it('should contain at least 3 articles', () => {
      const files = listArticleFiles('prestige-fame');
      expect(files.length).toBeGreaterThanOrEqual(3);
    });
  });

  // Req 13: Strategy
  describe('strategy (Req 13)', () => {
    const required = ['build-archetypes', 'yield-strategy', 'budget-allocation'];
    it.each(required.map((a) => [a]))('should contain "%s" article', (slug) => {
      const filePath = path.join(CONTENT_DIR, 'strategy', `${slug}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // Req 20: Integrations
  describe('integrations (Req 20)', () => {
    const required = ['notification-service', 'integration-interface', 'webhook-setup', 'notification-flow'];
    it.each(required.map((a) => [a]))('should contain "%s" article', (slug) => {
      const filePath = path.join(CONTENT_DIR, 'integrations', `${slug}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

// ─── 6. Mermaid diagram validation (Req 5.2, 6.2, 8.6, 10.6, 20.5) ─────────

describe('Content Validation — mermaid diagrams', () => {
  const articlesRequiringMermaid: Array<{ sectionSlug: string; articleSlug: string; req: string }> = [
    { sectionSlug: 'robots', articleSlug: 'attribute-combat-influence', req: 'Req 5.2' },
    { sectionSlug: 'combat', articleSlug: 'battle-flow', req: 'Req 6.2' },
    { sectionSlug: 'leagues', articleSlug: 'tier-progression', req: 'Req 8.6' },
    { sectionSlug: 'economy', articleSlug: 'daily-financial-cycle', req: 'Req 10.6' },
    { sectionSlug: 'integrations', articleSlug: 'notification-flow', req: 'Req 20.5' },
  ];

  it.each(
    articlesRequiringMermaid.map((a) => [`${a.sectionSlug}/${a.articleSlug} (${a.req})`, a.sectionSlug, a.articleSlug])
  )('"%s" should contain at least one mermaid code block', (_label, sectionSlug, articleSlug) => {
    const content = readArticleContent(sectionSlug as string, articleSlug as string);
    expect(content).toMatch(/```mermaid/);
  });
});
