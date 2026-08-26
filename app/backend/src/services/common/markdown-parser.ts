import yaml from 'js-yaml';
import logger from '../../config/logger';

/**
 * Matches a leading YAML frontmatter block: `---` on its own first line, the
 * YAML body, then `---` on its own line. Lazy so the *first* closing delimiter
 * wins, and multiline so that closing `^---` anchors to a line start rather
 * than matching a `---` horizontal rule mid-line.
 */
const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m;

/**
 * Splits a raw Markdown string into its YAML frontmatter and body.
 *
 * This replaces `gray-matter`, which was removed as a dependency. gray-matter@4
 * binds `js-yaml`'s `safeLoad` at module-load time, and `safeLoad` was deleted
 * in js-yaml v4 — so with the `js-yaml: ">=4.2.0"` override in `package.json`
 * the import itself threw `TypeError: Cannot read properties of undefined
 * (reading 'bind')`, taking down the guide service and, because `index.ts`
 * imports the guide routes at top level, the whole application at boot. A
 * custom-engine option could not help: the crash happened on import, before any
 * option was read. Splitting frontmatter ourselves removes the dependency
 * instead of pinning around it.
 *
 * Behaviour preserved from gray-matter for the guide's needs: no frontmatter
 * yields an empty `data` object and the input unchanged as `content`; an empty
 * frontmatter block yields an empty `data`; a leading UTF-8 BOM is tolerated;
 * both LF and CRLF line endings are accepted.
 *
 * @param raw - Full Markdown file content, possibly with a frontmatter block
 * @returns The parsed frontmatter as `data` and the remaining Markdown as `content`
 */
export function splitFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  // Strip a UTF-8 BOM so the opening delimiter is still first on line 1.
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  const match = FRONTMATTER_PATTERN.exec(text);
  if (match === null || match.index !== 0) {
    return { data: {}, content: text };
  }

  const parsed = yaml.load(match[1]);
  const data =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  return { data, content: text.slice(match[0].length) };
}

/**
 * Represents a heading extracted from Markdown content.
 */
export interface ArticleHeading {
  level: number; // 2 or 3
  text: string;
  id: string; // slugified anchor
}

/**
 * Validated frontmatter fields for a guide article.
 */
export interface ArticleFrontmatter {
  title: string;
  description: string;
  order: number;
  lastUpdated: string;
  relatedArticles?: string[];
}

/**
 * Result of parsing a Markdown file with frontmatter.
 */
export interface ParsedArticle {
  frontmatter: ArticleFrontmatter;
  body: string;
}

/**
 * Slugifies a heading string into a URL-friendly anchor ID.
 * Converts to lowercase, replaces spaces with hyphens, removes special characters.
 *
 * @param text - The heading text to slugify
 * @returns A slugified string suitable for use as an anchor ID
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Extracts h2 and h3 headings from Markdown content with slugified anchor IDs.
 *
 * @param markdown - Raw Markdown body content (without frontmatter)
 * @returns Array of ArticleHeading objects for table of contents generation
 */
export function extractHeadings(markdown: string): ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;

  let match = headingRegex.exec(markdown);
  while (match !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    headings.push({
      level,
      text,
      id: slugify(text),
    });
    match = headingRegex.exec(markdown);
  }

  return headings;
}

/**
 * Strips Markdown syntax from content to produce plain text for search indexing.
 * Removes headings markers, bold/italic markers, links, images, code blocks,
 * HTML tags, and other Markdown formatting.
 *
 * @param markdown - Raw Markdown body content (without frontmatter)
 * @returns Plain text string with Markdown syntax removed
 */
export function stripMarkdown(markdown: string): string {
  let text = markdown;

  // Remove fenced code blocks (including mermaid, callout-*, etc.)
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Remove images: ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove links: [text](url) → text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove heading markers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic markers
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');

  // Remove strikethrough
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // Remove blockquotes
  text = text.replace(/^>\s?/gm, '');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove HTML tags (loop to handle nested/broken tags like <scr<script>ipt>)
  while (/<[^>]+>/.test(text)) {
    text = text.replace(/<[^>]+>/g, '');
  }

  // Remove unordered list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');

  // Remove ordered list markers
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove table formatting (pipes and alignment rows)
  text = text.replace(/^\|.*\|$/gm, (line) => {
    // Skip alignment rows like |---|---|
    if (/^[\s|:-]+$/.test(line)) {
      return '';
    }
    // Strip pipes from data rows
    return line.replace(/\|/g, ' ').trim();
  });

  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Collapse multiple spaces
  text = text.replace(/ {2,}/g, ' ');

  return text.trim();
}

const REQUIRED_FRONTMATTER_FIELDS: (keyof ArticleFrontmatter)[] = [
  'title',
  'description',
  'order',
  'lastUpdated',
];

/**
 * Validates that all required frontmatter fields are present and correctly typed.
 *
 * @param data - The parsed frontmatter data object from `splitFrontmatter`
 * @returns The validated ArticleFrontmatter, or null if validation fails
 */
export function validateFrontmatter(data: Record<string, unknown>): ArticleFrontmatter | null {
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      logger.warn(`Missing required frontmatter field: "${field}"`);
      return null;
    }
  }

  if (typeof data.title !== 'string' || data.title.trim() === '') {
    logger.warn('Frontmatter field "title" must be a non-empty string');
    return null;
  }

  if (typeof data.description !== 'string' || data.description.trim() === '') {
    logger.warn('Frontmatter field "description" must be a non-empty string');
    return null;
  }

  if (typeof data.order !== 'number' || !Number.isFinite(data.order)) {
    logger.warn('Frontmatter field "order" must be a finite number');
    return null;
  }

  if (typeof data.lastUpdated !== 'string' || data.lastUpdated.trim() === '') {
    logger.warn('Frontmatter field "lastUpdated" must be a non-empty string');
    return null;
  }

  const frontmatter: ArticleFrontmatter = {
    title: data.title,
    description: data.description,
    order: data.order,
    lastUpdated: data.lastUpdated,
  };

  if (data.relatedArticles !== undefined) {
    if (Array.isArray(data.relatedArticles) && data.relatedArticles.every((item: unknown) => typeof item === 'string')) {
      frontmatter.relatedArticles = data.relatedArticles as string[];
    } else {
      logger.warn('Frontmatter field "relatedArticles" must be an array of strings');
    }
  }

  return frontmatter;
}

/**
 * Parses a raw Markdown string with YAML frontmatter.
 * Extracts and validates frontmatter, returns the body content separately.
 *
 * @param rawContent - The full Markdown file content including YAML frontmatter
 * @returns A ParsedArticle with validated frontmatter and body, or null if parsing/validation fails
 */
export function parseMarkdown(rawContent: string): ParsedArticle | null {
  try {
    const { data, content } = splitFrontmatter(rawContent);
    const frontmatter = validateFrontmatter(data);

    if (frontmatter === null) {
      return null;
    }

    return {
      frontmatter,
      body: content,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to parse Markdown frontmatter: ${message}`);
    return null;
  }
}
