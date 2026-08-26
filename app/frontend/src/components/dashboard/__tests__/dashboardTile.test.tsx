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
    const heights = (['loading', 'error', 'loaded'] as const).map((state) => {
      const { container: dom, unmount } = renderTile(
        <DashboardTile
          title="Prestige"
          content={<span>x</span>}
          isLoading={state === 'loading'}
          error={state === 'error' ? 'nope' : null}
        />,
      );
      const inner = dom.querySelector('section > div');
      const className = inner?.className ?? '';
      unmount();
      return className;
    });

    // Requirement 11 criterion 9: the same min-height class in all three.
    for (const className of heights) {
      expect(className).toContain('min-h-');
    }
    expect(new Set(heights).size).toBe(1);
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
