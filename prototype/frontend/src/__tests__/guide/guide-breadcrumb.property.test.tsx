// Feature: in-game-guide, Property 3: Breadcrumb path correctness
// **Validates: Requirements 2.4**

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import GuideBreadcrumb from '../../components/guide/GuideBreadcrumb';

// Mock react-router-dom Link as <a>
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

/**
 * Arbitrary for section/article names — simple alpha strings to avoid rendering issues.
 */
const nameArb: fc.Arbitrary<string> = fc.stringMatching(/^[A-Z][a-z]{2,15}$/);
const slugArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-z]{3,12}$/);

describe('GuideBreadcrumb — Property 3: Breadcrumb path correctness', () => {
  it('should produce exactly 3 segments with correct routes for any section/article', () => {
    fc.assert(
      fc.property(
        slugArb,
        nameArb,
        nameArb,
        (sectionSlug, sectionTitle, articleTitle) => {
          const { container } = render(
            <GuideBreadcrumb
              sectionSlug={sectionSlug}
              sectionTitle={sectionTitle}
              articleTitle={articleTitle}
            />
          );

          const nav = container.querySelector('nav[aria-label="Breadcrumb"]');
          expect(nav).not.toBeNull();

          // Should have exactly 3 text segments
          const links = nav!.querySelectorAll('a');
          const spans = nav!.querySelectorAll('span');

          // First segment: "Guide" link to /guide
          expect(links[0].textContent).toBe('Guide');
          expect(links[0].getAttribute('href')).toBe('/guide');

          // Second segment: section link to /guide/:sectionSlug
          expect(links[1].textContent).toBe(sectionTitle);
          expect(links[1].getAttribute('href')).toBe(`/guide/${sectionSlug}`);

          // Third segment: article title (no link, it's a span)
          // Find the last span that contains the article title
          const textSpans = Array.from(spans).filter(
            (s) => s.textContent === articleTitle
          );
          expect(textSpans.length).toBe(1);

          // Separators: should have exactly 2 "›" separators
          const separators = Array.from(spans).filter(
            (s) => s.textContent === '›'
          );
          expect(separators.length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
