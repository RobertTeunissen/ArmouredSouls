import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchPalette from '../SearchPalette';
import SearchResultList from '../SearchResultList';
import SearchTrigger from '../SearchTrigger';
import useSearchPalette from '../useSearchPalette';
import { search } from '../../../utils/searchApi';
import { buildSearchResultRoute } from '../../../utils/searchRoutes';
import type { SearchResponse, SearchResult } from '../../../utils/searchTypes';

vi.mock('../../../utils/searchApi', () => ({
  search: vi.fn(),
}));

const mockedSearch = vi.mocked(search);
const SCOPE_TEXT = 'Search robots, stables, or guide articles';

const SEARCH_RESPONSE: SearchResponse = {
  robots: [{ category: 'robots', id: 7, label: 'Atlas', subtitle: 'North Stable' }],
  stables: [{ category: 'stables', userId: 12, label: 'North Stable' }],
  guide: [{
    category: 'guide',
    title: 'Combat Basics',
    sectionTitle: 'Combat',
    sectionSlug: 'combat',
    articleSlug: 'basics',
  }],
};

const baseProps = {
  isOpen: true,
  query: '',
  onQueryChange: vi.fn(),
  onClose: vi.fn(),
};

function CurrentRoute(): ReactElement {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

function SearchControllerHarness(): ReactElement {
  const navigate = useNavigate();
  const palette = useSearchPalette();

  const handleResultSelect = (result: SearchResult): void => {
    const route = buildSearchResultRoute(result);
    if (route === null) return;
    palette.selectResult(result);
    navigate(route);
  };

  return (
    <>
      <SearchTrigger onOpenSearch={() => palette.openSearch()} />
      <SearchPalette
        isOpen={palette.isOpen}
        query={palette.query}
        state={palette.state}
        onQueryChange={palette.onQueryChange}
        onSubmit={palette.submitQuery}
        onClose={palette.closeSearch}
        onRetry={palette.retry}
        errorMessage={palette.errorMessage}
        recentSearches={palette.history}
        onSelectRecentSearch={palette.selectRecentSearch}
        onClearHistory={palette.clearHistory}
        inputRef={palette.inputRef}
        dialogRef={palette.dialogRef}
        onDialogKeyDown={palette.handleDialogKeyDown}
        resultContent={palette.response ? (
          <SearchResultList
            results={palette.response}
            onSelect={handleResultSelect}
            activeResultIndex={palette.activeResultIndex}
            onActiveResultIndexChange={palette.onActiveResultIndexChange}
          />
        ) : undefined}
      />
      <CurrentRoute />
      <output aria-label="Search response">
        {palette.response ? JSON.stringify(palette.response) : ''}
      </output>
    </>
  );
}

function renderResultsPalette(onSelect: (result: SearchResult) => void = vi.fn()): void {
  render(
    <SearchPalette
      {...baseProps}
      state="results"
      resultContent={<SearchResultList results={SEARCH_RESPONSE} onSelect={onSelect} />}
    />,
  );
}

describe('SearchPalette', () => {
  beforeEach(() => {
    mockedSearch.mockReset();
    vi.mocked(localStorage.getItem).mockReset();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockReset();
    vi.mocked(localStorage.removeItem).mockReset();
  });

  it('renders a visible Search trigger and palette scope with Cmd/Ctrl accelerator metadata', () => {
    render(
      <>
        <SearchTrigger onOpenSearch={vi.fn()} />
        <SearchPalette {...baseProps} state="recent-history" />
      </>,
    );

    const trigger = screen.getByRole('button', { name: 'Open search' });
    expect(screen.getByText('Search', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('⌘ K')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
    expect(trigger.className).toContain('min-h-11');
    expect(trigger.className).toContain('min-w-11');
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getAllByText(SCOPE_TEXT)).toHaveLength(2);
    expect(screen.getByRole('searchbox', { name: SCOPE_TEXT })).toBeInTheDocument();
  });

  it('keeps the desktop overlay bounded and the content region vertically scrollable without horizontal overflow', () => {
    render(
      <SearchPalette
        {...baseProps}
        state="results"
        resultContent={<p>Current page remains visible behind the palette.</p>}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Search' });
    const overlay = dialog.parentElement;
    const scrollRegion = screen.getByRole('region', { name: 'Search results' }).parentElement;

    expect(overlay?.className).toContain('overflow-x-hidden');
    expect(overlay?.className).toContain('overflow-y-auto');
    expect(dialog.className).toContain('max-w-2xl');
    expect(dialog.className).toContain('max-h-[calc(100dvh-1rem)]');
    expect(dialog.className).toContain('overflow-hidden');
    expect(scrollRegion?.className).toContain('overflow-y-auto');
  });

  it('renders loading, too-short, empty, and error states with retry', async () => {
    const retry = vi.fn();
    const { rerender } = render(<SearchPalette {...baseProps} state="loading" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Searching robots, stables, and guide articles',
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');

    rerender(<SearchPalette {...baseProps} state="too-short" />);
    expect(screen.getByRole('status')).toHaveTextContent('Type at least 2 characters');

    rerender(<SearchPalette {...baseProps} state="empty" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'No matches found in robots, stables, or guide articles',
    );

    rerender(
      <SearchPalette
        {...baseProps}
        state="error"
        errorMessage="Search is unavailable. Please try again."
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Search is unavailable');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry search' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders recent history, invokes selection and clear controls, and has no command actions', async () => {
    const user = userEvent.setup();
    const onSelectRecentSearch = vi.fn();
    const onClearHistory = vi.fn();
    render(
      <SearchPalette
        {...baseProps}
        state="recent-history"
        recentSearches={['Atlas', 'Guide']}
        onSelectRecentSearch={onSelectRecentSearch}
        onClearHistory={onClearHistory}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Use recent search Atlas' }));
    await user.click(screen.getByRole('button', { name: 'Clear recent searches' }));

    expect(onSelectRecentSearch).toHaveBeenCalledWith('Atlas');
    expect(onClearHistory).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create|edit|delete|navigate/i })).not.toBeInTheDocument();
  });

  it('renders grouped clickable result references only, with approved route targets and no analytics fields', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderResultsPalette(onSelect);

    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Robots',
      'Stables',
      'Guide articles',
    ]);

    const resultButtons = [
      screen.getByRole('button', { name: 'Robot: Atlas, North Stable' }),
      screen.getByRole('button', { name: 'Stable: North Stable' }),
      screen.getByRole('button', { name: 'Guide article: Combat Basics, section Combat' }),
    ];
    const expectedRoutes = ['/robots/7', '/stables/12', '/guide/combat/basics'];

    for (const [index, button] of resultButtons.entries()) {
      await user.click(button);
      const result = onSelect.mock.calls[index]?.[0];
      expect(result).toBeDefined();
      expect(buildSearchResultRoute(result)).toBe(expectedRoutes[index]);
      expect(result).not.toHaveProperty('analytics');
      expect(result).not.toHaveProperty('query');
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('min-w-11');
    }

    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('moves through grouped results with arrows and activates Enter without unsupported actions', async () => {
    mockedSearch.mockResolvedValue(SEARCH_RESPONSE);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SearchControllerHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Open search' }));
    await user.type(screen.getByRole('searchbox'), 'Atlas');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Robot: Atlas, North Stable' })).toBeInTheDocument();
    });

    const robot = screen.getByRole('button', { name: 'Robot: Atlas, North Stable' });
    const stable = screen.getByRole('button', { name: 'Stable: North Stable' });
    robot.focus();
    await user.keyboard('{ArrowDown}');
    expect(stable).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/stables/12');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('focuses the input on open, traps Tab focus, restores the trigger, and closes on Escape', async () => {
    const user = userEvent.setup();
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(['Atlas']));
    render(
      <MemoryRouter>
        <SearchControllerHarness />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Open search' });
    await user.click(trigger);
    const input = screen.getByRole('searchbox');
    const clearHistory = screen.getByRole('button', { name: 'Clear recent searches' });
    const recentSearch = screen.getByRole('button', { name: 'Use recent search Atlas' });
    const headerClose = screen.getAllByRole('button', { name: 'Close search' })[1];

    await waitFor(() => expect(input).toHaveFocus());
    await user.tab();
    expect(clearHistory).toHaveFocus();
    await user.tab();
    expect(recentSearch).toHaveFocus();
    await user.tab();
    expect(headerClose).toHaveFocus();
    await user.tab({ shift: true });
    expect(recentSearch).toHaveFocus();

    const dialog = screen.getByRole('dialog');
    const escapeEvent = createEvent.keyDown(dialog, {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    });
    fireEvent(dialog, escapeEvent);

    expect(escapeEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('keeps the successful Search_Response unchanged when telemetry fails open', async () => {
    const telemetryAttempt = vi.fn().mockRejectedValue(new Error('telemetry persistence failed'));
    mockedSearch.mockImplementation(async () => {
      await telemetryAttempt().catch(() => undefined);
      return SEARCH_RESPONSE;
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SearchControllerHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Open search' }));
    await user.type(screen.getByRole('searchbox'), 'private phrase');

    const responseOutput = screen.getByLabelText('Search response');
    await waitFor(() => {
      expect(responseOutput.textContent).toBe(JSON.stringify(SEARCH_RESPONSE));
    });

    const playerResponse = JSON.parse(responseOutput.textContent ?? 'null') as SearchResponse;
    expect(playerResponse).toEqual(SEARCH_RESPONSE);
    expect(playerResponse).not.toHaveProperty('analytics');
    expect(playerResponse).not.toHaveProperty('normalizedQuery');
    expect(JSON.stringify(playerResponse)).not.toContain('private phrase');
    expect(telemetryAttempt).toHaveBeenCalledOnce();
  });
});
