import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchPalette from '../SearchPalette';
import SearchResultList from '../SearchResultList';
import useSearchPalette from '../useSearchPalette';
import { search } from '../../../utils/searchApi';
import { buildSearchResultRoute } from '../../../utils/searchRoutes';
import type { SearchResult, SearchResponse } from '../../../utils/searchTypes';

vi.mock('../../../utils/searchApi', () => ({
  search: vi.fn(),
}));

const mockedSearch = vi.mocked(search);

const SEARCH_RESPONSE: SearchResponse = {
  robots: [
    {
      category: 'robots',
      id: 7,
      label: 'Atlas',
    },
  ],
  stables: [],
  guide: [],
};

function CurrentPath(): ReactElement {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

function SearchIntegrationHarness(): ReactElement {
  const navigate = useNavigate();
  const palette = useSearchPalette();

  const selectResult = (result: SearchResult): void => {
    const route = buildSearchResultRoute(result);
    if (route === null) return;

    palette.selectResult(result);
    navigate(route);
  };

  return (
    <>
      <button type="button" onClick={() => palette.openSearch()}>
        Open search
      </button>
      <SearchPalette
        isOpen={palette.isOpen}
        query={palette.query}
        state={palette.state}
        onQueryChange={palette.onQueryChange}
        onSubmit={palette.submitQuery}
        onClose={palette.closeSearch}
        recentSearches={palette.history}
        onSelectRecentSearch={palette.selectRecentSearch}
        onClearHistory={palette.clearHistory}
        inputRef={palette.inputRef}
        dialogRef={palette.dialogRef}
        onDialogKeyDown={palette.handleDialogKeyDown}
        resultContent={palette.response ? (
          <SearchResultList
            results={palette.response}
            onSelect={selectResult}
            activeResultIndex={palette.activeResultIndex}
            onActiveResultIndexChange={palette.onActiveResultIndexChange}
          />
        ) : undefined}
      />
      <CurrentPath />
    </>
  );
}

describe('SearchPalette history and result integration', () => {
  beforeEach(() => {
    mockedSearch.mockReset();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockClear();
    vi.mocked(localStorage.removeItem).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects browser-local history, debounces the populated query, and clears to empty history', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(['Atlas', 'Guide']));
    mockedSearch.mockResolvedValue(SEARCH_RESPONSE);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SearchIntegrationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Open search' }));
    await user.click(screen.getByRole('button', { name: 'Use recent search Atlas' }));

    expect(screen.getByRole('searchbox')).toHaveValue('Atlas');
    expect(mockedSearch).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mockedSearch).toHaveBeenCalledWith('Atlas', expect.any(AbortSignal));
    });

    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('button', { name: 'Clear recent searches' }));

    expect(screen.getByText('No recent searches yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear recent searches' })).not.toBeInTheDocument();
    expect(localStorage.removeItem).toHaveBeenCalledWith('armoured-souls:recent-searches');
  });

  it('stores a valid submitted query once and stores it once more only when a result is selected', async () => {
    mockedSearch.mockResolvedValue(SEARCH_RESPONSE);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SearchIntegrationHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Open search' }));
    const input = screen.getByRole('searchbox');
    await user.type(input, 'Atlas');
    await user.keyboard('{Enter}');

    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.setItem).toHaveBeenLastCalledWith(
      'armoured-souls:recent-searches',
      JSON.stringify(['Atlas']),
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Robot: Atlas' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Robot: Atlas' }));

    expect(localStorage.setItem).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/robots/7');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
