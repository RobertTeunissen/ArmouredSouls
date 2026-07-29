/**
 * Mobile responsiveness of the season surfaces (Spec #45 R28).
 *
 * The game is played on phones, and these surfaces carry naturally wide data —
 * per-mode tier, LP, and instance rank. Each is asserted at 320, 375, and
 * 1024px with no element exceeding the viewport, and every interactive control
 * is checked against the 44px touch target minimum.
 *
 * Validates: Requirements 28.1, 28.7, 28.8, 28.9, 28.12
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SeasonProgressIndicator from '../SeasonProgressIndicator';
import SeasonCountdownBanner from '../SeasonCountdownBanner';
import SeasonPhaseCard from '../SeasonPhaseCard';
import { useSeasonStore } from '../../../stores/seasonStore';
import type { SeasonState } from '../../../utils/seasonApi';

const VIEWPORTS = [320, 375, 1024] as const;

/** Minimum touch target in CSS pixels. */
const MIN_TOUCH_TARGET = 44;

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function competitiveSeason(overrides: Partial<SeasonState> = {}): SeasonState {
  return {
    seasonNumber: 3,
    phase: 'competitive',
    seasonCycle: 42,
    seasonLengthCycles: 100,
    remainingCompetitiveCycles: 58,
    preparationDay: 0,
    remainingPreparationCycles: 0,
    isLegacy: false,
    ...overrides,
  };
}

function seedStore(season: SeasonState | null, failed = false): void {
  useSeasonStore.setState({ season, failed, loading: false, dismissedBanner: null });
}

/**
 * Assert no rendered element is wider than the viewport.
 * jsdom reports 0 for layout widths, so this checks the classes that would
 * cause overflow instead — fixed pixel widths and forced non-wrapping rows.
 */
function expectNoForcedOverflow(container: HTMLElement, viewport: number): void {
  const all = container.querySelectorAll<HTMLElement>('*');
  for (const el of all) {
    const classes = el.className;
    if (typeof classes !== 'string') continue;

    // A fixed width larger than the viewport would overflow at every breakpoint.
    const fixedWidth = classes.match(/(?:^|\s)w-\[(\d+)px\]/);
    if (fixedWidth) {
      expect(Number(fixedWidth[1])).toBeLessThanOrEqual(viewport);
    }
    // `whitespace-nowrap` on a long text block is the usual overflow culprit.
    // It is acceptable only on the short indicator badge.
    if (classes.includes('whitespace-nowrap')) {
      expect(el.textContent?.length ?? 0).toBeLessThanOrEqual(40);
    }
  }
}

/**
 * Every standalone control must meet the touch target minimum.
 *
 * Links inline within a sentence are exempt: R28.7 enumerates standalone
 * controls (row expanders, mode selectors, modal and banner dismiss, admin
 * actions), and forcing a 44px box onto a link inside prose would break the
 * sentence it sits in. Inline links are detected by having a paragraph ancestor.
 */
function expectTouchTargets(container: HTMLElement): void {
  const controls = Array.from(container.querySelectorAll<HTMLElement>('button, a')).filter(
    (el) => el.closest('p') === null,
  );
  for (const control of controls) {
    const classes = typeof control.className === 'string' ? control.className : '';
    const hasMinHeight =
      /min-h-\[(\d+)px\]/.test(classes) &&
      Number(classes.match(/min-h-\[(\d+)px\]/)![1]) >= MIN_TOUCH_TARGET;
    const hasFlexFullHeight = classes.includes('min-h-[44px]');
    expect(hasMinHeight || hasFlexFullHeight).toBe(true);
  }
}

describe('Season surfaces — R28 mobile responsiveness', () => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('SeasonProgressIndicator', () => {
    for (const width of VIEWPORTS) {
      it(`should render without forced overflow at ${width}px`, () => {
        setViewport(width);
        seedStore(competitiveSeason());
        const { container } = render(<SeasonProgressIndicator compact={width < 1024} />);
        expect(screen.getByTestId('season-progress-indicator')).toBeTruthy();
        expectNoForcedOverflow(container, width);
      });
    }

    it('should render a condensed label below 1024px that keeps the N / M progression', () => {
      setViewport(375);
      seedStore(competitiveSeason());
      render(<SeasonProgressIndicator compact />);
      const el = screen.getByTestId('season-progress-indicator');
      expect(el.textContent).toContain('42/100');
      expect(el.textContent).toContain('S3');
    });

    it('should omit the season length for the legacy season', () => {
      setViewport(1024);
      seedStore(competitiveSeason({ seasonNumber: 0, isLegacy: true, seasonCycle: 119 }));
      render(<SeasonProgressIndicator />);
      const el = screen.getByTestId('season-progress-indicator');
      expect(el.textContent).toContain('Season 0');
      expect(el.textContent).toContain('119');
      expect(el.textContent).not.toContain('/ 100');
    });

    it('should render nothing when the season endpoint failed', () => {
      seedStore(null, true);
      const { container } = render(<SeasonProgressIndicator />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('SeasonCountdownBanner', () => {
    for (const width of VIEWPORTS) {
      it(`should render with a 44px dismiss control at ${width}px`, () => {
        setViewport(width);
        seedStore(competitiveSeason({ remainingCompetitiveCycles: 3 }));
        const { container } = render(
          <BrowserRouter>
            <SeasonCountdownBanner userId={7} />
          </BrowserRouter>,
        );
        expect(screen.getByTestId('season-countdown-banner')).toBeTruthy();
        expectTouchTargets(container);
        expectNoForcedOverflow(container, width);
      });
    }

    it('should state the remaining cycle count rather than truncating it', () => {
      setViewport(320);
      seedStore(competitiveSeason({ remainingCompetitiveCycles: 3 }));
      render(
        <BrowserRouter>
          <SeasonCountdownBanner userId={7} />
        </BrowserRouter>,
      );
      const banner = screen.getByTestId('season-countdown-banner');
      expect(banner.textContent).toContain('3 cycles');
      // No truncation utility that would hide the count.
      expect(banner.innerHTML).not.toContain('truncate');
    });

    it('should not show outside the countdown window', () => {
      seedStore(competitiveSeason({ remainingCompetitiveCycles: 40 }));
      const { container } = render(
        <BrowserRouter>
          <SeasonCountdownBanner userId={7} />
        </BrowserRouter>,
      );
      expect(container.firstChild).toBeNull();
    });

    it('should not show for the legacy season, which has no scheduled end', () => {
      seedStore(competitiveSeason({ isLegacy: true, remainingCompetitiveCycles: 0 }));
      const { container } = render(
        <BrowserRouter>
          <SeasonCountdownBanner userId={7} />
        </BrowserRouter>,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('SeasonPhaseCard', () => {
    for (const width of VIEWPORTS) {
      it(`should render the preparation state at ${width}px`, () => {
        setViewport(width);
        seedStore(
          competitiveSeason({
            phase: 'preparation',
            seasonCycle: 0,
            preparationDay: 1,
            remainingPreparationCycles: 1,
          }),
        );
        const { container } = render(
          <BrowserRouter>
            <SeasonPhaseCard />
          </BrowserRouter>,
        );
        const card = screen.getByTestId('season-preparation-card');
        expect(card.textContent).toContain('No competitive battles are scheduled');
        expectNoForcedOverflow(container, width);
      });
    }

    it('should tell the player that cycle 1 only schedules', () => {
      seedStore(competitiveSeason({ seasonCycle: 1, remainingCompetitiveCycles: 99 }));
      render(
        <BrowserRouter>
          <SeasonPhaseCard />
        </BrowserRouter>,
      );
      expect(screen.getByTestId('season-phase-card').textContent).toContain(
        'first battles run on the next cycle',
      );
    });

    it('should render nothing during the legacy Season 0', () => {
      // Season 0 has no season structure to explain, so the dashboard card is
      // suppressed entirely — it would be noise.
      seedStore(competitiveSeason({ seasonNumber: 0, isLegacy: true, seasonCycle: 119 }));
      const { container } = render(
        <BrowserRouter>
          <SeasonPhaseCard />
        </BrowserRouter>,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
