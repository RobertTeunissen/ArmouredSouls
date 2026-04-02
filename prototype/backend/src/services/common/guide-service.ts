import * as fs from 'fs';
import * as path from 'path';
import logger from '../../config/logger';
import {
  parseMarkdown,
  extractHeadings,
  stripMarkdown,
  ArticleHeading,
} from './markdown-parser';

/**
 * Summary of a guide article for section listings.
 */
export interface GuideArticleSummary {
  slug: string;
  title: string;
  description: string;
  sectionSlug: string;
  lastUpdated: string;
}

/**
 * A guide section containing ordered article summaries.
 */
export interface GuideSection {
  slug: string;
  title: string;
  description: string;
  order: number;
  articles: GuideArticleSummary[];
}

/**
 * Link to a guide article (used for previous/next navigation).
 */
export interface GuideArticleLink {
  slug: string;
  title: string;
  sectionSlug: string;
}

/**
 * Link to a related article with section title context.
 */
export interface RelatedArticleLink extends GuideArticleLink {
  sectionTitle: string;
}

/**
 * Full guide article with body, navigation, and metadata.
 */
export interface GuideArticle {
  slug: string;
  title: string;
  description: string;
  sectionSlug: string;
  sectionTitle: string;
  body: string;
  lastUpdated: string;
  relatedArticles: RelatedArticleLink[];
  previousArticle: GuideArticleLink | null;
  nextArticle: GuideArticleLink | null;
  headings: ArticleHeading[];
}

/**
 * Entry in the search index for client-side full-text search.
 */
export interface SearchIndexEntry {
  slug: string;
  title: string;
  sectionSlug: string;
  sectionTitle: string;
  description: string;
  bodyText: string;
}

/**
 * In-memory cache structure for guide content.
 */
interface GuideCache {
  sections: GuideSection[] | null;
  articles: Map<string, GuideArticle>;
  searchIndex: SearchIndexEntry[] | null;
}

/**
 * Raw section entry from sections.json.
 */
interface SectionEntry {
  slug: string;
  title: string;
  description: string;
  order: number;
}


const CONTENT_DIR = path.join(__dirname, '..', 'content', 'guide');

/**
 * Service for reading, parsing, and caching guide content from the filesystem.
 * All content is read from Markdown files with YAML frontmatter stored in the
 * content/guide/ directory. Results are cached in memory and invalidated on demand.
 */
class GuideService {
  private contentDir: string;
  private cache: GuideCache;

  constructor(contentDir: string = CONTENT_DIR) {
    this.contentDir = contentDir;
    this.cache = {
      sections: null,
      articles: new Map(),
      searchIndex: null,
    };
  }

  /**
   * Loads all sections and their article summaries, sorted by section order
   * and article order. Results are cached after first call.
   *
   * @returns Array of GuideSections with nested article summaries
   */
  getSections(): GuideSection[] {
    if (this.cache.sections !== null) {
      return this.cache.sections;
    }

    const sectionEntries = this.readSectionsJson();
    const sections: GuideSection[] = [];

    for (const entry of sectionEntries) {
      const articles = this.scanSectionArticles(entry.slug);
      sections.push({
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
        order: entry.order,
        articles,
      });
    }

    sections.sort((a, b) => a.order - b.order);
    this.cache.sections = sections;
    return sections;
  }

  /**
   * Loads a single article by section and article slug. Parses frontmatter,
   * body, headings, related articles, and computes previous/next navigation.
   * Results are cached after first call.
   *
   * @param sectionSlug - The section directory name
   * @param articleSlug - The article filename without .md extension
   * @returns Full GuideArticle or null if not found
   */
  getArticle(sectionSlug: string, articleSlug: string): GuideArticle | null {
    const cacheKey = `${sectionSlug}/${articleSlug}`;

    if (this.cache.articles.has(cacheKey)) {
      return this.cache.articles.get(cacheKey) ?? null;
    }

    const filePath = path.join(this.contentDir, sectionSlug, `${articleSlug}.md`);

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to read article file "${filePath}": ${message}`);
      return null;
    }

    const parsed = parseMarkdown(rawContent);
    if (parsed === null) {
      logger.warn(`Failed to parse article "${cacheKey}": invalid frontmatter`);
      return null;
    }

    const sectionTitle = this.getSectionTitle(sectionSlug);
    if (sectionTitle === null) {
      logger.warn(`Section "${sectionSlug}" not found in sections.json`);
      return null;
    }

    const headings = extractHeadings(parsed.body);
    const relatedArticles = this.resolveRelatedArticles(parsed.frontmatter.relatedArticles);
    const { previousArticle, nextArticle } = this.computeAdjacentArticles(sectionSlug, articleSlug);

    const article: GuideArticle = {
      slug: articleSlug,
      title: parsed.frontmatter.title,
      description: parsed.frontmatter.description,
      sectionSlug,
      sectionTitle,
      body: parsed.body,
      lastUpdated: parsed.frontmatter.lastUpdated,
      relatedArticles,
      previousArticle,
      nextArticle,
      headings,
    };

    this.cache.articles.set(cacheKey, article);
    return article;
  }

  /**
   * Returns the search index containing all articles with plain-text body
   * for client-side full-text search. Results are cached after first call.
   *
   * @returns Array of SearchIndexEntry for all articles
   */
  getSearchIndex(): SearchIndexEntry[] {
    if (this.cache.searchIndex !== null) {
      return this.cache.searchIndex;
    }

    const sections = this.getSections();
    const entries: SearchIndexEntry[] = [];

    for (const section of sections) {
      for (const articleSummary of section.articles) {
        const filePath = path.join(
          this.contentDir,
          section.slug,
          `${articleSummary.slug}.md`
        );

        let rawContent: string;
        try {
          rawContent = fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to read article for search index "${filePath}": ${message}`);
          continue;
        }

        const parsed = parseMarkdown(rawContent);
        if (parsed === null) {
          continue;
        }

        entries.push({
          slug: articleSummary.slug,
          title: parsed.frontmatter.title,
          sectionSlug: section.slug,
          sectionTitle: section.title,
          description: parsed.frontmatter.description,
          bodyText: stripMarkdown(parsed.body),
        });
      }
    }

    this.cache.searchIndex = entries;
    return entries;
  }

  /**
   * Invalidates all cached data. Next call to any getter will re-read from disk.
   */
  invalidateCache(): void {
    this.cache = {
      sections: null,
      articles: new Map(),
      searchIndex: null,
    };
  }

  /**
   * Reads and parses sections.json from the content directory.
   * Returns an empty array if the file is missing or malformed.
   */
  private readSectionsJson(): SectionEntry[] {
    const sectionsPath = path.join(this.contentDir, 'sections.json');

    try {
      const raw = fs.readFileSync(sectionsPath, 'utf-8');
      const data: unknown = JSON.parse(raw);

      if (!Array.isArray(data)) {
        logger.warn('sections.json is not an array');
        return [];
      }

      return data.filter((entry): entry is SectionEntry => {
        return (
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as SectionEntry).slug === 'string' &&
          typeof (entry as SectionEntry).title === 'string' &&
          typeof (entry as SectionEntry).order === 'number'
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to read sections.json: ${message}`);
      return [];
    }
  }

  /**
   * Scans a section directory for .md files, parses their frontmatter,
   * and returns sorted article summaries.
   */
  /**
     * Scans a section directory for .md files, parses their frontmatter,
     * and returns sorted article summaries.
     */
    private scanSectionArticles(sectionSlug: string): GuideArticleSummary[] {
      const sectionDir = path.join(this.contentDir, sectionSlug);

      let files: string[];
      try {
        files = fs.readdirSync(sectionDir);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to read section directory "${sectionSlug}": ${message}`);
        return [];
      }

      const mdFiles = files.filter((f) => f.endsWith('.md'));
      const articlesWithOrder: Array<{ summary: GuideArticleSummary; order: number }> = [];

      for (const file of mdFiles) {
        const filePath = path.join(sectionDir, file);

        let rawContent: string;
        try {
          rawContent = fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to read article file "${filePath}": ${message}`);
          continue;
        }

        const parsed = parseMarkdown(rawContent);
        if (parsed === null) {
          logger.warn(`Skipping article with invalid frontmatter: "${filePath}"`);
          continue;
        }

        const slug = file.replace(/\.md$/, '');
        articlesWithOrder.push({
          summary: {
            slug,
            title: parsed.frontmatter.title,
            description: parsed.frontmatter.description,
            sectionSlug,
            lastUpdated: parsed.frontmatter.lastUpdated,
          },
          order: parsed.frontmatter.order,
        });
      }

      articlesWithOrder.sort((a, b) => a.order - b.order);
      return articlesWithOrder.map((a) => a.summary);
    }

  /**
   * Looks up the section title from sections.json by slug.
   */
  private getSectionTitle(sectionSlug: string): string | null {
    const sections = this.readSectionsJson();
    const section = sections.find((s) => s.slug === sectionSlug);
    return section?.title ?? null;
  }

  /**
   * Resolves related article references by filtering out non-existent articles.
   * Each reference is a "sectionSlug/articleSlug" string.
   */
  private resolveRelatedArticles(
    relatedPaths: string[] | undefined
  ): RelatedArticleLink[] {
    if (!relatedPaths || relatedPaths.length === 0) {
      return [];
    }

    const resolved: RelatedArticleLink[] = [];

    for (const ref of relatedPaths) {
      const parts = ref.split('/');
      if (parts.length !== 2) {
        logger.warn(`Invalid relatedArticle reference format: "${ref}"`);
        continue;
      }

      const [refSectionSlug, refArticleSlug] = parts;
      const filePath = path.join(
        this.contentDir,
        refSectionSlug,
        `${refArticleSlug}.md`
      );

      if (!this.fileExists(filePath)) {
        logger.warn(`Related article not found, filtering out: "${ref}"`);
        continue;
      }

      // Read the referenced article to get its title
      let rawContent: string;
      try {
        rawContent = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const parsed = parseMarkdown(rawContent);
      if (parsed === null) {
        continue;
      }

      const sectionTitle = this.getSectionTitle(refSectionSlug);
      if (sectionTitle === null) {
        continue;
      }

      resolved.push({
        slug: refArticleSlug,
        title: parsed.frontmatter.title,
        sectionSlug: refSectionSlug,
        sectionTitle,
      });
    }

    return resolved;
  }

  /**
   * Computes previous and next article links within the same section.
   * Articles are ordered by their frontmatter order field.
   */
  private computeAdjacentArticles(
    sectionSlug: string,
    articleSlug: string
  ): { previousArticle: GuideArticleLink | null; nextArticle: GuideArticleLink | null } {
    const articles = this.scanSectionArticles(sectionSlug);
    const currentIndex = articles.findIndex((a) => a.slug === articleSlug);

    if (currentIndex === -1) {
      return { previousArticle: null, nextArticle: null };
    }

    const previousArticle: GuideArticleLink | null =
      currentIndex > 0
        ? {
            slug: articles[currentIndex - 1].slug,
            title: articles[currentIndex - 1].title,
            sectionSlug,
          }
        : null;

    const nextArticle: GuideArticleLink | null =
      currentIndex < articles.length - 1
        ? {
            slug: articles[currentIndex + 1].slug,
            title: articles[currentIndex + 1].title,
            sectionSlug,
          }
        : null;

    return { previousArticle, nextArticle };
  }

  /**
   * Checks if a file exists at the given path.
   */
  private fileExists(filePath: string): boolean {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/** Singleton instance of GuideService using the default content directory. */
const guideService = new GuideService();

export { GuideService };
export default guideService;
