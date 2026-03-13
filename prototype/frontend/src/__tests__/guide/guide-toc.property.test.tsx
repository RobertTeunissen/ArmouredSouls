// Feature: in-game-guide, Property 4: Table of Contents conditional rendering
// **Validates: Requirements 2.5**

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import GuideTableOfContents from '../../components/guide/GuideTableOfContents';
import { ArticleHeading } from '../../utils/guideApi';

/**
 * Arbitrary that generates an ArticleHeading with valid level (2 or 3).
 */
const headingArb: fc.Arbitrary<ArticleHeading> = fc.record({
  level: fc.constantFrom(2, 3),
  text: fc.stringMatching(/^[A-Z][a-z]{2,20}$/),
  id: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
});

describe('GuideTableOfContents — Property 4: Conditional rendering', () => {
  it('should render ToC when headings > 3, not render when headings <= 3', () => {
    fc.assert(
      fc.property(
        fc.array(headingArb, { minLength: 0, maxLength: 15 }),
        (headings) => {
          const { container } = render(
            <GuideTableOfContents headings={headings} />
          );

          const tocNav = container.querySelector('nav[aria-label="Table of contents"]');

          if (headings.length > 3) {
            // ToC should be rendered
            expect(tocNav).not.toBeNull();

            // Should have the correct number of links
            const links = tocNav!.querySelectorAll('a');
            expect(links.length).toBe(headings.length);

            // Each link should point to the correct anchor
            headings.forEach((heading, i) => {
              expect(links[i].getAttribute('href')).toBe(`#${heading.id}`);
              expect(links[i].textContent).toBe(heading.text);
            });
          } else {
            // ToC should NOT be rendered
            expect(tocNav).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
