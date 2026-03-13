/**
 * Unit tests for MarkdownParser service.
 * Validates: Requirements 15.1
 */

import {
  parseMarkdown,
  validateFrontmatter,
  extractHeadings,
  stripMarkdown,
  slugify,
} from '../../services/markdown-parser';
import logger from '../../config/logger';

// Mock the logger to verify warning calls
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedLogger = logger as jest.Mocked<typeof logger>;

const validFrontmatter = `---
title: "Battle Flow"
description: "How a single attack resolves"
order: 1
lastUpdated: "2026-02-01"
---

## Overview

Some body content here.
`;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MarkdownParser', () => {
  describe('parseMarkdown', () => {
    it('should return ParsedArticle with correct values when all required fields are present', () => {
      const result = parseMarkdown(validFrontmatter);

      expect(result).not.toBeNull();
      expect(result!.frontmatter.title).toBe('Battle Flow');
      expect(result!.frontmatter.description).toBe('How a single attack resolves');
      expect(result!.frontmatter.order).toBe(1);
      expect(result!.frontmatter.lastUpdated).toBe('2026-02-01');
      expect(result!.body).toContain('## Overview');
      expect(result!.body).toContain('Some body content here.');
    });

    it('should return ParsedArticle with relatedArticles when optional field is present', () => {
      const content = `---
title: "Stances"
description: "Offensive, defensive, and balanced stances"
order: 2
lastUpdated: "2026-03-15"
relatedArticles:
  - combat/battle-flow
  - weapons/loadout-types
---

## Stances Overview
`;
      const result = parseMarkdown(content);

      expect(result).not.toBeNull();
      expect(result!.frontmatter.relatedArticles).toEqual([
        'combat/battle-flow',
        'weapons/loadout-types',
      ]);
    });

    it('should return null and log warning when YAML is malformed', () => {
      const malformed = `---
title: "Bad YAML
description: missing closing quote
order: not closed
---

Body text.
`;
      const result = parseMarkdown(malformed);

      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalled();
    });

    it('should return null when content has no frontmatter delimiters', () => {
      const noFrontmatter = `# Just a heading

Some content without frontmatter.
`;
      const result = parseMarkdown(noFrontmatter);

      // gray-matter returns empty data object when no frontmatter, so validation fails
      expect(result).toBeNull();
    });
  });

  describe('validateFrontmatter', () => {
    const validData: Record<string, unknown> = {
      title: 'Battle Flow',
      description: 'How a single attack resolves',
      order: 1,
      lastUpdated: '2026-02-01',
    };

    it('should return ArticleFrontmatter when all required fields are valid', () => {
      const result = validateFrontmatter(validData);

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Battle Flow');
      expect(result!.description).toBe('How a single attack resolves');
      expect(result!.order).toBe(1);
      expect(result!.lastUpdated).toBe('2026-02-01');
      expect(result!.relatedArticles).toBeUndefined();
    });

    it('should return null and log warning when title is missing', () => {
      const data = { ...validData };
      delete data.title;

      const result = validateFrontmatter(data);

      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('title')
      );
    });

    it('should return null and log warning when description is missing', () => {
      const data = { ...validData };
      delete data.description;

      const result = validateFrontmatter(data);

      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('description')
      );
    });

    it('should return null and log warning when order is missing', () => {
      const data = { ...validData };
      delete data.order;

      const result = validateFrontmatter(data);

      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('order')
      );
    });

    it('should return null and log warning when lastUpdated is missing', () => {
      const data = { ...validData };
      delete data.lastUpdated;

      const result = validateFrontmatter(data);

      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('lastUpdated')
      );
    });

    it('should return null when title is an empty string', () => {
      const data = { ...validData, title: '' };

      const result = validateFrontmatter(data);

      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('title')
      );
    });

    it('should return null when order is not a number', () => {
      const data = { ...validData, order: 'first' };

      const result = validateFrontmatter(data);

      expect(result).toBeNull();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('order')
      );
    });

    it('should log warning and omit relatedArticles when it is not an array', () => {
      const data = { ...validData, relatedArticles: 'combat/battle-flow' };

      const result = validateFrontmatter(data);

      expect(result).not.toBeNull();
      expect(result!.relatedArticles).toBeUndefined();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('relatedArticles')
      );
    });

    it('should log warning and omit relatedArticles when it contains non-strings', () => {
      const data = { ...validData, relatedArticles: [123, true] };

      const result = validateFrontmatter(data);

      expect(result).not.toBeNull();
      expect(result!.relatedArticles).toBeUndefined();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('relatedArticles')
      );
    });

    it('should ignore extra fields not in the schema', () => {
      const data = { ...validData, extraField: 'should be ignored', tags: ['a', 'b'] };

      const result = validateFrontmatter(data);

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Battle Flow');
      // Extra fields should not appear on the result
      expect((result as unknown as Record<string, unknown>)['extraField']).toBeUndefined();
    });
  });

  describe('extractHeadings', () => {
    it('should extract h2 and h3 headings with correct levels', () => {
      const markdown = `## Getting Started

Some intro text.

### First Steps

Details here.

## Advanced Topics

### Deep Dive

More details.
`;
      const headings = extractHeadings(markdown);

      expect(headings).toHaveLength(4);
      expect(headings[0]).toEqual({ level: 2, text: 'Getting Started', id: 'getting-started' });
      expect(headings[1]).toEqual({ level: 3, text: 'First Steps', id: 'first-steps' });
      expect(headings[2]).toEqual({ level: 2, text: 'Advanced Topics', id: 'advanced-topics' });
      expect(headings[3]).toEqual({ level: 3, text: 'Deep Dive', id: 'deep-dive' });
    });

    it('should ignore h1 and h4+ headings', () => {
      const markdown = `# Title (h1)

## Section (h2)

### Subsection (h3)

#### Detail (h4)

##### Minor (h5)
`;
      const headings = extractHeadings(markdown);

      expect(headings).toHaveLength(2);
      expect(headings[0].level).toBe(2);
      expect(headings[1].level).toBe(3);
    });

    it('should return empty array when no headings exist', () => {
      const markdown = 'Just some plain text without any headings.';
      const headings = extractHeadings(markdown);

      expect(headings).toEqual([]);
    });
  });

  describe('slugify', () => {
    it('should convert spaces to hyphens and lowercase', () => {
      expect(slugify('Getting Started')).toBe('getting-started');
    });

    it('should remove special characters and collapse resulting gaps', () => {
      expect(slugify('Weapons & Loadouts')).toBe('weapons-loadouts');
    });

    it('should collapse multiple hyphens into one', () => {
      expect(slugify('a---b')).toBe('a-b');
    });

    it('should handle already-lowercase text', () => {
      expect(slugify('simple')).toBe('simple');
    });

    it('should trim whitespace', () => {
      expect(slugify('  padded text  ')).toBe('padded-text');
    });
  });

  describe('stripMarkdown', () => {
    it('should remove bold and italic markers', () => {
      const md = 'This is **bold** and *italic* and ***both***.';
      const result = stripMarkdown(md);

      expect(result).toContain('bold');
      expect(result).toContain('italic');
      expect(result).toContain('both');
      expect(result).not.toContain('**');
      expect(result).not.toContain('*italic*');
    });

    it('should remove links but keep link text', () => {
      const md = 'Check the [Battle Flow](/guide/combat/battle-flow) article.';
      const result = stripMarkdown(md);

      expect(result).toContain('Battle Flow');
      expect(result).not.toContain('[');
      expect(result).not.toContain('](/guide');
    });

    it('should remove images but keep alt text', () => {
      const md = '![Attack diagram](/images/guide/combat/attack-order.png)';
      const result = stripMarkdown(md);

      expect(result).toContain('Attack diagram');
      expect(result).not.toContain('![');
      expect(result).not.toContain('.png');
    });

    it('should remove heading markers', () => {
      const md = '## Overview\n\n### Details';
      const result = stripMarkdown(md);

      expect(result).toContain('Overview');
      expect(result).toContain('Details');
      expect(result).not.toMatch(/^##/m);
    });

    it('should remove fenced code blocks including mermaid', () => {
      const md = `Some text before.

\`\`\`mermaid
graph TD
    A --> B
    B --> C
\`\`\`

Some text after.`;
      const result = stripMarkdown(md);

      expect(result).toContain('Some text before.');
      expect(result).toContain('Some text after.');
      expect(result).not.toContain('graph TD');
      expect(result).not.toContain('mermaid');
    });

    it('should remove regular fenced code blocks', () => {
      const md = `Text before.

\`\`\`typescript
const x = 42;
\`\`\`

Text after.`;
      const result = stripMarkdown(md);

      expect(result).not.toContain('const x');
      expect(result).toContain('Text before.');
      expect(result).toContain('Text after.');
    });

    it('should remove inline code backticks but keep content', () => {
      const md = 'Use the `slugify` function.';
      const result = stripMarkdown(md);

      expect(result).toContain('slugify');
      expect(result).not.toContain('`');
    });

    it('should handle table formatting', () => {
      const md = `| Tier | Reward |
|------|--------|
| Bronze | ₡5-10K |
| Silver | ₡15-30K |`;
      const result = stripMarkdown(md);

      // Alignment row should be removed, data rows should have pipes stripped
      expect(result).not.toContain('|---');
      expect(result).toContain('Bronze');
      expect(result).toContain('Silver');
    });

    it('should return empty string for empty input', () => {
      expect(stripMarkdown('')).toBe('');
    });
  });
});
