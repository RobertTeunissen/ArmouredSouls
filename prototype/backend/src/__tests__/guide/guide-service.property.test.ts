/**
 * Property-based tests for GuideService.
 * Uses fast-check to verify universal properties across generated inputs.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GuideService } from '../../services/guide-service';

// Mock the logger to suppress warnings during tests
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// --- Helpers ---

/**
 * Creates a temporary directory for test content.
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guide-test-'));
}

/**
 * Recursively removes a directory.
 */
function removeTempDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * Generates a valid slug (lowercase letters followed by optional alphanumeric).
 */
function slugArb(): fc.Arbitrary<string> {
  return fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);
}

/**
 * Generates a non-empty title string (letters, digits, spaces).
 */
function titleArb(): fc.Arbitrary<string> {
  return fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,25}$/).filter((s: string) => s.trim().length > 0);
}

/**
 * Generates a non-empty description string.
 */
function descriptionArb(): fc.Arbitrary<string> {
  return fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ,.]{0,40}$/).filter((s: string) => s.trim().length > 0);
}

/**
 * Generates a valid ISO 8601 date string (YYYY-MM-DD).
 */
function dateArb(): fc.Arbitrary<string> {
  return fc.tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  ).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}

interface SectionDef {
  slug: string;
  title: string;
  order: number;
}

interface ArticleDef {
  slug: string;
  title: string;
  description: string;
  order: number;
  lastUpdated: string;
  body: string;
  relatedArticles?: string[];
}

/**
 * Generates a section definition with a unique prefixed slug.
 */
function sectionDefArb(order: number): fc.Arbitrary<SectionDef> {
  return fc.tuple(slugArb(), titleArb()).map(([slug, title]) => ({
    slug: `s${order}${slug}`,
    title,
    order,
  }));
}

/**
 * Generates an article definition with a unique prefixed slug.
 */
function articleDefArb(order: number, relatedArticles?: string[]): fc.Arbitrary<ArticleDef> {
  return fc.tuple(slugArb(), titleArb(), descriptionArb(), dateArb()).map(
    ([slug, title, description, lastUpdated]) => ({
      slug: `a${order}${slug}`,
      title,
      description,
      order,
      lastUpdated,
      body: `## Heading One\n\nSome content for the article.\n\n### Sub Heading\n\nMore details here.`,
      relatedArticles,
    })
  );
}

/**
 * Writes sections.json and article .md files to a content directory.
 */
function writeContentFiles(
  contentDir: string,
  sections: SectionDef[],
  articlesBySection: Map<string, ArticleDef[]>
): void {
  const sectionsJson = sections.map((s) => ({
    slug: s.slug,
    title: s.title,
    description: `Description for ${s.title}`,
    order: s.order,
  }));
  fs.writeFileSync(path.join(contentDir, 'sections.json'), JSON.stringify(sectionsJson, null, 2));

  for (const section of sections) {
    const sectionDir = path.join(contentDir, section.slug);
    fs.mkdirSync(sectionDir, { recursive: true });

    const articles = articlesBySection.get(section.slug) ?? [];
    for (const article of articles) {
      const relatedBlock =
        article.relatedArticles && article.relatedArticles.length > 0
          ? `relatedArticles:\n${article.relatedArticles.map((r) => `  - ${r}`).join('\n')}\n`
          : '';

      const content = `---
title: "${article.title}"
description: "${article.description}"
order: ${article.order}
lastUpdated: "${article.lastUpdated}"
${relatedBlock}---

${article.body}
`;
      fs.writeFileSync(path.join(sectionDir, `${article.slug}.md`), content);
    }
  }
}

/**
 * Deduplicates items by a key function, keeping the first occurrence.
 */
function deduplicateBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Feature: in-game-guide, Property 2: Section and article listing completeness
// **Validates: Requirements 1.4, 2.2**
describe('GuideService Property Tests', () => {
  describe('Property 2: Section and article listing completeness', () => {
    it('should return all sections and all articles with non-empty title and description for any valid content', () => {
      fc.assert(
        fc.property(
          // Generate 1-5 sections, each with 1-3 articles
          fc.integer({ min: 1, max: 5 }).chain((numSections) =>
            fc.tuple(
              fc.tuple(
                ...Array.from({ length: numSections }, (_, i) => sectionDefArb(i + 1))
              ),
              fc.tuple(
                ...Array.from({ length: numSections }, () =>
                  fc.integer({ min: 1, max: 3 }).chain((numArticles) =>
                    fc.tuple(
                      ...Array.from({ length: numArticles }, (_, j) => articleDefArb(j + 1))
                    )
                  )
                )
              )
            )
          ),
          ([sections, articleGroups]) => {
            const uniqueSections = deduplicateBy(sections, (s) => s.slug);
            if (uniqueSections.length === 0) return;

            const articlesBySection = new Map<string, ArticleDef[]>();
            uniqueSections.forEach((section, i) => {
              const articles = i < articleGroups.length
                ? deduplicateBy(articleGroups[i], (a) => a.slug)
                : [];
              articlesBySection.set(section.slug, articles);
            });

            // Fresh temp dir per iteration to avoid leftover files
            const iterDir = createTempDir();
            try {
              writeContentFiles(iterDir, uniqueSections, articlesBySection);

              const service = new GuideService(iterDir);
              const result = service.getSections();

              // Every section in sections.json must appear in the result
              expect(result.length).toBe(uniqueSections.length);

              for (const sectionDef of uniqueSections) {
                const found = result.find((s) => s.slug === sectionDef.slug);
                expect(found).toBeDefined();
                expect(found!.title).toBe(sectionDef.title);

                // Every .md file in the section directory must appear as an article
                const expectedArticles = articlesBySection.get(sectionDef.slug) ?? [];
                expect(found!.articles.length).toBe(expectedArticles.length);

                for (const articleDef of expectedArticles) {
                  const foundArticle = found!.articles.find((a) => a.slug === articleDef.slug);
                  expect(foundArticle).toBeDefined();
                  // Non-empty title and description
                  expect(foundArticle!.title.trim().length).toBeGreaterThan(0);
                  expect(foundArticle!.description.trim().length).toBeGreaterThan(0);
                }
              }
            } finally {
              removeTempDir(iterDir);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: in-game-guide, Property 7: Article API response completeness
  // **Validates: Requirements 15.2**
  describe('Property 7: Article API response completeness', () => {
    it('should return all required fields with correct types for any valid article', () => {
      fc.assert(
        fc.property(
          // Generate a single section with 1-3 articles
          fc.tuple(sectionDefArb(1), fc.integer({ min: 1, max: 3 })).chain(([section, numArticles]) =>
            fc.tuple(
              fc.constant(section),
              fc.tuple(
                ...Array.from({ length: numArticles }, (_, j) => articleDefArb(j + 1))
              )
            )
          ),
          ([section, articles]) => {
            const uniqueArticles = deduplicateBy(articles, (a) => a.slug);
            if (uniqueArticles.length === 0) return;

            const articlesBySection = new Map<string, ArticleDef[]>();
            articlesBySection.set(section.slug, uniqueArticles);

            const iterDir = createTempDir();
            try {
              writeContentFiles(iterDir, [section], articlesBySection);

              const service = new GuideService(iterDir);

              // Sort articles by order to match how the service orders them
              const sortedArticles = [...uniqueArticles].sort((a, b) => a.order - b.order);

              for (let i = 0; i < sortedArticles.length; i++) {
                const articleDef = sortedArticles[i];
                const result = service.getArticle(section.slug, articleDef.slug);

                // Must not be null for a valid article
                expect(result).not.toBeNull();

                // Required string fields must be non-empty
                expect(typeof result!.title).toBe('string');
                expect(result!.title.trim().length).toBeGreaterThan(0);

                expect(typeof result!.body).toBe('string');
                expect(result!.body.trim().length).toBeGreaterThan(0);

                expect(typeof result!.sectionSlug).toBe('string');
                expect(result!.sectionSlug).toBe(section.slug);

                expect(typeof result!.sectionTitle).toBe('string');
                expect(result!.sectionTitle.trim().length).toBeGreaterThan(0);

                // lastUpdated must be a valid date string
                expect(typeof result!.lastUpdated).toBe('string');
                const parsedDate = new Date(result!.lastUpdated);
                expect(parsedDate.toString()).not.toBe('Invalid Date');

                // headings must be an array
                expect(Array.isArray(result!.headings)).toBe(true);

                // relatedArticles must be an array
                expect(Array.isArray(result!.relatedArticles)).toBe(true);

                // previousArticle/nextArticle correctness based on sorted order
                if (i === 0) {
                  expect(result!.previousArticle).toBeNull();
                } else {
                  expect(result!.previousArticle).not.toBeNull();
                  expect(result!.previousArticle!.slug).toBe(sortedArticles[i - 1].slug);
                }

                if (i === sortedArticles.length - 1) {
                  expect(result!.nextArticle).toBeNull();
                } else {
                  expect(result!.nextArticle).not.toBeNull();
                  expect(result!.nextArticle!.slug).toBe(sortedArticles[i + 1].slug);
                }
              }
            } finally {
              removeTempDir(iterDir);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: in-game-guide, Property 8: Related articles display bounds
  // **Validates: Requirements 17.3**
  describe('Property 8: Related articles display bounds', () => {
    it('should filter related articles to 0-5 entries and all must reference existing articles', () => {
      fc.assert(
        fc.property(
          // Generate 2 sections with 2 articles each, plus random related article refs
          fc.tuple(
            sectionDefArb(1),
            sectionDefArb(2),
            articleDefArb(1),
            articleDefArb(2),
            articleDefArb(1),
            articleDefArb(2),
            // Generate 0-8 related article references (mix of valid and invalid)
            fc.array(
              fc.oneof(
                fc.constant('VALID_REF'),
                fc.tuple(slugArb(), slugArb()).map(([s, a]) => `nonexistent${s}/missing${a}`)
              ),
              { minLength: 0, maxLength: 8 }
            )
          ),
          ([sec1, sec2, art1a, art1b, art2a, art2b, relatedRefs]) => {
            // Ensure unique slugs across sections and articles
            if (sec1.slug === sec2.slug) return;
            if (art1a.slug === art1b.slug) return;
            if (art2a.slug === art2b.slug) return;

            // Build valid reference targets
            const validTargets = [
              `${sec1.slug}/${art1b.slug}`,
              `${sec2.slug}/${art2a.slug}`,
              `${sec2.slug}/${art2b.slug}`,
            ];

            // Replace VALID_REF placeholders with actual valid references
            let validIdx = 0;
            const resolvedRefs = relatedRefs.map((ref) => {
              if (ref === 'VALID_REF') {
                const target = validTargets[validIdx % validTargets.length];
                validIdx++;
                return target;
              }
              return ref;
            });

            // Deduplicate refs
            const uniqueRefs = [...new Set(resolvedRefs)];

            // Create article with related articles
            const mainArticle: ArticleDef = {
              ...art1a,
              relatedArticles: uniqueRefs,
            };

            const articlesBySection = new Map<string, ArticleDef[]>();
            articlesBySection.set(sec1.slug, [mainArticle, art1b]);
            articlesBySection.set(sec2.slug, [art2a, art2b]);

            const iterDir = createTempDir();
            try {
              writeContentFiles(iterDir, [sec1, sec2], articlesBySection);

              const service = new GuideService(iterDir);
              const result = service.getArticle(sec1.slug, mainArticle.slug);

              expect(result).not.toBeNull();

              // Related articles must be between 0 and 5 entries
              expect(result!.relatedArticles.length).toBeGreaterThanOrEqual(0);
              expect(result!.relatedArticles.length).toBeLessThanOrEqual(5);

              // Every resolved related article must reference an existing article
              for (const related of result!.relatedArticles) {
                const filePath = path.join(
                  iterDir,
                  related.sectionSlug,
                  `${related.slug}.md`
                );
                expect(fs.existsSync(filePath)).toBe(true);
              }
            } finally {
              removeTempDir(iterDir);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
