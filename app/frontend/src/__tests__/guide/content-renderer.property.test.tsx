// Feature: in-game-guide, Property 5: Content rendering fidelity
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import ContentRenderer from '../../components/guide/ContentRenderer';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock mermaid — render returns synchronously for test purposes
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>diagram</svg>' }),
  },
}));

interface MarkdownCounts {
  headings: number;
  tables: number;
  images: number;
  mermaids: number;
  callouts: number;
}

/**
 * Build a Markdown string with known counts of each element type.
 * Returns the markdown and the expected counts.
 */
function buildMarkdown(counts: MarkdownCounts): string {
  const parts: string[] = [];

  for (let i = 0; i < counts.headings; i++) {
    parts.push(`## Heading ${i + 1}\n`);
  }

  for (let i = 0; i < counts.tables; i++) {
    parts.push(`| Col A | Col B |\n|---|---|\n| val ${i} | data ${i} |\n`);
  }

  for (let i = 0; i < counts.images; i++) {
    parts.push(`![image alt ${i}](/images/test-${i}.png)\n`);
  }

  for (let i = 0; i < counts.mermaids; i++) {
    parts.push('```mermaid\ngraph TD; A-->B\n```\n');
  }

  const calloutVariants = ['tip', 'warning', 'info'] as const;
  for (let i = 0; i < counts.callouts; i++) {
    const variant = calloutVariants[i % calloutVariants.length];
    parts.push(`\`\`\`callout-${variant}\nCallout content ${i}\n\`\`\`\n`);
  }

  return parts.join('\n');
}

/**
 * Arbitrary that generates MarkdownCounts with small non-negative integers.
 * We keep counts small (0-4) to keep rendering fast and deterministic.
 */
const markdownCountsArb: fc.Arbitrary<MarkdownCounts> = fc.record({
  headings: fc.integer({ min: 0, max: 4 }),
  tables: fc.integer({ min: 0, max: 3 }),
  images: fc.integer({ min: 0, max: 3 }),
  mermaids: fc.integer({ min: 0, max: 3 }),
  callouts: fc.integer({ min: 0, max: 3 }),
});

describe('ContentRenderer — Property 5: Content rendering fidelity', () => {
  it('should render the correct number of headings for any generated Markdown', () => {
    fc.assert(
      fc.property(markdownCountsArb, (counts) => {
        const markdown = buildMarkdown(counts);
        const { container } = render(<ContentRenderer content={markdown} />);

        const h2Elements = container.querySelectorAll('h2');
        expect(h2Elements.length).toBe(counts.headings);
      }),
      { numRuns: 100 }
    );
  });

  it('should render the correct number of tables for any generated Markdown', () => {
    fc.assert(
      fc.property(markdownCountsArb, (counts) => {
        const markdown = buildMarkdown(counts);
        const { container } = render(<ContentRenderer content={markdown} />);

        const tableElements = container.querySelectorAll('table');
        expect(tableElements.length).toBe(counts.tables);
      }),
      { numRuns: 100 }
    );
  });

  it('should render the correct number of images for any generated Markdown', () => {
    fc.assert(
      fc.property(markdownCountsArb, (counts) => {
        const markdown = buildMarkdown(counts);
        const { container } = render(<ContentRenderer content={markdown} />);

        const imgElements = container.querySelectorAll('img');
        expect(imgElements.length).toBe(counts.images);
      }),
      { numRuns: 100 }
    );
  });

  it('should render the correct number of mermaid containers for any generated Markdown', () => {
    fc.assert(
      fc.property(markdownCountsArb, (counts) => {
        const markdown = buildMarkdown(counts);
        const { container } = render(<ContentRenderer content={markdown} />);

        // MermaidDiagram renders a div with "Loading diagram…" initially
        // since mermaid.render is async. Count the loading placeholders.
        const mermaidContainers = container.querySelectorAll(
          'div.items-center.justify-center'
        );
        expect(mermaidContainers.length).toBe(counts.mermaids);
      }),
      { numRuns: 100 }
    );
  });

  it('should render the correct number of callout blocks for any generated Markdown', () => {
    fc.assert(
      fc.property(markdownCountsArb, (counts) => {
        const markdown = buildMarkdown(counts);
        const { container } = render(<ContentRenderer content={markdown} />);

        // CalloutBlock renders a div with border-l-4 class
        const calloutBlocks = container.querySelectorAll('div.border-l-4');
        expect(calloutBlocks.length).toBe(counts.callouts);
      }),
      { numRuns: 100 }
    );
  });

  it('should render matching element counts for all types simultaneously', () => {
    fc.assert(
      fc.property(markdownCountsArb, (counts) => {
        const markdown = buildMarkdown(counts);
        const { container } = render(<ContentRenderer content={markdown} />);

        const h2Count = container.querySelectorAll('h2').length;
        const tableCount = container.querySelectorAll('table').length;
        const imgCount = container.querySelectorAll('img').length;
        const mermaidCount = container.querySelectorAll(
          'div.items-center.justify-center'
        ).length;
        const calloutCount = container.querySelectorAll('div.border-l-4').length;

        expect(h2Count).toBe(counts.headings);
        expect(tableCount).toBe(counts.tables);
        expect(imgCount).toBe(counts.images);
        expect(mermaidCount).toBe(counts.mermaids);
        expect(calloutCount).toBe(counts.callouts);
      }),
      { numRuns: 100 }
    );
  });
});
