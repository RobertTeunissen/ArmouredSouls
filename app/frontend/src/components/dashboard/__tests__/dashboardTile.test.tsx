/**
 * Dashboard_Tile — Spec #48 Requirements 11, 12, 13 and 14.
 *
 * The source-content assertions here are unusual but deliberate: criteria 12.1–12.3
 * are about where a class is DECLARED, not about what renders, so reading the source
 * is the only way to check them. Requirement 11's invariants are checked by rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as fs from 'fs';
import * as path from 'path';
import {
  DashboardTile,
  DashboardTileStat,
} from '../DashboardTile';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderTile(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const DASHBOARD_DIR = path.join(__dirname, '..');

function readTile(file: string): string {
  return fs.readFileSync(path.join(DASHBOARD_DIR, file), 'utf-8');
}

/**
 * Source with comments stripped.
 *
 * The tiles are allowed — encouraged — to EXPLAIN in a comment why they do not use a
 * given class. Asserting against raw source made a comment reading "not
 * `text-success`, because green means healthy" fail the very rule it documented.
 */
function readTileCode(file: string): string {
  return readTile(file)
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');
}

describe('Requirement 11: one geometry across every state', () => {
  const container = 'bg-surface-elevated';

  it.each([
    ['loading', { isLoading: true, error: null }],
    ['error', { isLoading: false, error: 'nope' }],
    ['loaded', { isLoading: false, error: null }],
  ])('uses the documented card container and H3 heading step in the %s state', (_name, state) => {
    const { container: dom } = renderTile(
      <DashboardTile title="Prestige" content={<span>x</span>} {...state} />,
    );

    const section = dom.querySelector('section');
    expect(section?.className).toContain(container);
    expect(section?.className).toContain('border-gray-700');
    // Requirement 11 criterion 2: never `bg-surface` with `border-white/10`.
    expect(section?.className).not.toContain('border-white/10');
    // Requirement 11 criterion 1: `p-4` in every state, not `p-6` while loading.
    expect(section?.className).toContain('p-4');
    expect(section?.className).not.toContain('p-6');

    const heading = screen.getByRole('heading', { level: 3 });
    // Requirement 11 criterion 3: the H3 step, not text-2xl or text-lg.
    expect(heading.className).toContain('text-xl');
    expect(heading.className).toContain('font-medium');
    expect(heading.className).not.toContain('text-2xl');
    expect(heading.className).not.toContain('text-lg');
  });

  it('reserves the same content height in every state, so nothing reflows', () => {
    const reserved = (['loading', 'error', 'loaded'] as const).map((state) => {
      const { container: dom, unmount } = renderTile(
        <DashboardTile
          title="Prestige"
          content={<span>x</span>}
          isLoading={state === 'loading'}
          error={state === 'error' ? 'nope' : null}
        />,
      );
      const inner = dom.querySelector<HTMLElement>('section > div');
      const value = inner?.style.minHeight ?? '';
      unmount();
      return value;
    });

    // Requirement 11 criterion 9: an identical reserved height in all three states.
    for (const value of reserved) {
      expect(value).toMatch(/^[\d.]+rem$/);
    }
    expect(new Set(reserved).size).toBe(1);
  });

  it('scales the reserved height with the row count rather than using a flat block', () => {
    // The flat `min-h-[11rem]` it replaces over-reserved for every tile, leaving dead
    // space under the content — most visible on mobile, where the grid does not stretch
    // tiles to a common height and nothing absorbs it.
    function reservedFor(loadingRows: number): number {
      const { container: dom, unmount } = renderTile(
        <DashboardTile
          title="Prestige"
          content={<span>x</span>}
          isLoading={false}
          error={null}
          loadingRows={loadingRows}
        />,
      );
      const value = dom.querySelector<HTMLElement>('section > div')?.style.minHeight ?? '0rem';
      unmount();
      return parseFloat(value);
    }

    expect(reservedFor(4)).toBeGreaterThan(reservedFor(2));
    // And it stays well under the 11rem the flat value reserved for a three-row tile.
    expect(reservedFor(3)).toBeLessThan(11);
  });

  it('states the period once beneath the heading, not on every figure', () => {
    // Requirement 2 criterion 5 as amended: no figure may be left ambiguous, but the
    // period is stated once per tile. Four repeats of `(this cycle)` wrapped the labels
    // and pushed the values out of a column.
    const { container: dom } = renderTile(
      <DashboardTile
        title="Credits"
        periodNote="This cycle, compared with last"
        content={
          <>
            <DashboardTileStat label="Current balance" value="₡1" signMeaning="no-meaning" />
            <DashboardTileStat label="Battle earnings" value="₡2" signMeaning="no-meaning" />
          </>
        }
        isLoading={false}
        error={null}
      />,
    );

    const text = dom.textContent ?? '';
    expect(text).toContain('This cycle, compared with last');
    expect(text).not.toContain('(this cycle)');
  });

  it('keeps the header block the same height when no period note is supplied', () => {
    // The note line renders either way, so a tile without one does not sit taller or
    // shorter than its neighbours.
    for (const periodNote of [undefined, 'This cycle']) {
      const { container: dom, unmount } = renderTile(
        <DashboardTile
          title="Prestige"
          periodNote={periodNote}
          content={<span>x</span>}
          isLoading={false}
          error={null}
        />,
      );
      expect(dom.querySelectorAll('section > p')).toHaveLength(1);
      unmount();
    }
  });
});

describe('Requirement 6: figures align in a column', () => {
  it('gives the value its own right-aligned cell with the comparison beneath it', () => {
    // With the value and its comparison in one right-hand group, a row with a comparison
    // put its value mid-row while a row without one put it flush right, so the figures
    // never lined up. The comparison now sits in the second column, on its own line.
    const { container: dom } = renderTile(
      <DashboardTileStat
        label="Battle earnings"
        value="₡34,429"
        comparison={{ value: '₡32,929' }}
        delta={1500}
        signMeaning="higher-is-better"
      />,
    );

    const value = [...dom.querySelectorAll('span')].find((s) => s.textContent === '₡34,429');
    expect(value?.className).toContain('text-right');
    expect(value?.className).toContain('tabular-nums');

    const comparison = [...dom.querySelectorAll('span')].find((s) =>
      s.textContent?.startsWith('vs '),
    );
    expect(comparison?.className).toContain('col-start-2');
    expect(comparison?.className).toContain('text-right');
    // The period is on the tile, so the comparison does not repeat "last cycle".
    expect(comparison?.textContent).toBe('vs ₡32,929');
  });
});

describe('Requirement 11 criteria 7 and 8: colour follows sign meaning and comparison', () => {
  function valueClassFor(props: Partial<React.ComponentProps<typeof DashboardTileStat>>) {
    const { container } = renderTile(
      <DashboardTileStat
        label="Earned"
        value="10"
        period="current-cycle"
        signMeaning="higher-is-better"
        {...props}
      />,
    );
    // The stat value is the span carrying `font-semibold`.
    return container.querySelector('.font-semibold')?.className ?? '';
  }

  it('is neutral with no comparison at all', () => {
    expect(valueClassFor({ delta: undefined })).toContain('text-white');
  });

  it('is neutral when the figure equals its comparison', () => {
    expect(valueClassFor({ delta: 0, comparison: { value: '10' } })).toContain('text-white');
  });

  it('is neutral when the direction has no meaning, whatever the delta', () => {
    expect(
      valueClassFor({ signMeaning: 'no-meaning', delta: 500, comparison: { value: '1' } }),
    ).toContain('text-white');
  });

  it('treats a rise as favourable for higher-is-better', () => {
    expect(valueClassFor({ delta: 5, comparison: { value: '5' } })).toContain('text-success');
  });

  it('treats a rise as UNfavourable for lower-is-better, so a growing repair bill is never green', () => {
    const className = valueClassFor({
      signMeaning: 'lower-is-better',
      delta: 5,
      comparison: { value: '5' },
    });
    expect(className).toContain('text-error');
    expect(className).not.toContain('text-success');
  });

  it('treats a fall as favourable for lower-is-better', () => {
    expect(
      valueClassFor({ signMeaning: 'lower-is-better', delta: -5, comparison: { value: '15' } }),
    ).toContain('text-success');
  });
});

describe('Requirement 12: the shared component owns the conventions', () => {
  it('declares the stat colours in exactly one file', () => {
    // Verification criterion 7. `text-success` / `text-error` must not appear as a
    // stat-value class in any tile.
    for (const file of ['PrestigeTile.tsx', 'TodaysBattlesTile.tsx', 'CreditsTile.tsx']) {
      const source = readTileCode(file);
      expect(source).not.toContain('text-success');
      expect(source).not.toContain('text-error');
    }
    expect(readTileCode('DashboardTile.tsx')).toContain('text-success');
  });

  it('declares no container, padding or heading typography class in any tile', () => {
    // Requirement 12 criteria 1-3: tiles supply content and props only.
    for (const file of ['PrestigeTile.tsx', 'TodaysBattlesTile.tsx', 'CreditsTile.tsx']) {
      const source = readTileCode(file);
      expect(source).not.toContain('bg-surface-elevated');
      expect(source).not.toContain('border-gray-700');
      expect(source).not.toMatch(/\bp-4\b/);
      expect(source).not.toMatch(/\btext-2xl\b/);
      // No tile renders its own heading element.
      expect(source).not.toMatch(/<h[1-6]/);
    }
  });

  it('exposes no prop through which an instance could override styling', () => {
    // Requirement 12 criterion 5, checked against the declared interface.
    const source = readTileCode('DashboardTile.tsx');
    const propsBlock = source.slice(
      source.indexOf('export interface DashboardTileProps'),
      source.indexOf('export function DashboardTile'),
    );
    for (const forbidden of ['className', 'style', 'variant', 'colour', 'color', 'size']) {
      expect(propsBlock).not.toContain(`${forbidden}?:`);
      expect(propsBlock).not.toContain(`${forbidden}:`);
    }
  });

  it('renders placeholders and no stat value while loading', () => {
    renderTile(
      <DashboardTile title="Credits" isLoading error={null} content={<span>₡500</span>} />,
    );
    expect(screen.getByTestId('dashboard-tile-loading')).toBeInTheDocument();
    expect(screen.queryByText('₡500')).not.toBeInTheDocument();
    // Requirement 12 criterion 6: no zero either — a zero reads as a real figure.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders one message and no partial stat value in the error state', () => {
    renderTile(
      <DashboardTile
        title="Credits"
        isLoading={false}
        error="Figures unavailable."
        content={<span>₡500</span>}
      />,
    );
    expect(screen.getByTestId('dashboard-tile-error')).toHaveTextContent('Figures unavailable.');
    expect(screen.queryByText('₡500')).not.toBeInTheDocument();
  });
});

describe('Requirements 13 and 14: click-through', () => {
  it('navigates with the router and never assigns window.location', async () => {
    mockNavigate.mockClear();
    renderTile(
      <DashboardTile
        title="Credits"
        clickThrough={{ label: 'Full breakdown', to: '/income' }}
        isLoading={false}
        error={null}
        content={<span>x</span>}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Full breakdown' }));
    expect(mockNavigate).toHaveBeenCalledExactlyOnceWith('/income');
  });

  it('activates on Enter and on Space, via native button semantics', async () => {
    mockNavigate.mockClear();
    renderTile(
      <DashboardTile
        title="Credits"
        clickThrough={{ label: 'Full breakdown', to: '/income' }}
        isLoading={false}
        error={null}
        content={<span>x</span>}
      />,
    );

    const button = screen.getByRole('button', { name: 'Full breakdown' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('gives the activation region at least 44px in both dimensions', () => {
    renderTile(
      <DashboardTile
        title="Credits"
        clickThrough={{ label: 'Full breakdown', to: '/income' }}
        isLoading={false}
        error={null}
        content={<span>x</span>}
      />,
    );
    const button = screen.getByRole('button', { name: 'Full breakdown' });
    // Tailwind's `11` step is 2.75rem = 44px.
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('min-w-11');
  });

  it('renders no interactive element at all when no click-through is given', () => {
    renderTile(<DashboardTile title="Prestige" isLoading={false} error={null} content={<span>x</span>} />);
    // Requirement 14 criterion 5: not in the focus order, cannot navigate.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('assigns window.location nowhere in the Overview_Row', () => {
    // Verification criterion 1.
    for (const file of fs.readdirSync(DASHBOARD_DIR)) {
      if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
      expect(readTile(file)).not.toContain('window.location');
    }
  });
});
