import { type ReactElement, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../../App';
import PlayerShell, { PlayerNotFound } from '../PlayerShell';

vi.mock('../../Navigation', () => ({
  default: () => <div data-testid="player-navigation">Navigation</div>,
}));

vi.mock('../../search/SearchPalette', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="search-palette" data-open={String(isOpen)}>
      Search palette
    </div>
  ),
}));

vi.mock('../../search/SearchResultList', () => ({
  default: () => <div data-testid="search-result-list">Search results</div>,
}));

vi.mock('../../search/useSearchPalette', () => ({
  default: () => ({
    isOpen: false,
    query: '',
    state: 'closed',
    errorMessage: null,
    history: [],
    response: null,
    activeResultIndex: 0,
    inputRef: { current: null },
    dialogRef: { current: null },
    openSearch: vi.fn(),
    submitQuery: vi.fn(),
    onQueryChange: vi.fn(),
    closeSearch: vi.fn(),
    retry: vi.fn(),
    selectRecentSearch: vi.fn(),
    clearHistory: vi.fn(),
    handleDialogKeyDown: vi.fn(),
    selectResult: vi.fn(),
    onActiveResultIndexChange: vi.fn(),
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: {
      id: 7,
      username: 'shell-test-player',
      email: 'shell-test-player@example.test',
      role: 'admin',
      currency: 1000,
      prestige: 0,
    },
    token: 'test-token',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useAchievementToasts', () => ({
  useAchievementToasts: () => ({ toasts: [], dismissToast: vi.fn() }),
}));

vi.mock('../../../pages/FrontPage', () => ({
  default: () => <div data-testid="front-page">Front page</div>,
}));

vi.mock('../../../pages/OnboardingPage', () => ({
  default: () => <div data-testid="onboarding-page">Onboarding</div>,
}));

vi.mock('../../../pages/DashboardPage', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard</div>,
}));

vi.mock('../../../pages/admin/DashboardPage', () => ({
  default: () => <div data-testid="admin-dashboard-page">Admin dashboard</div>,
}));

function renderShell(content: ReactElement): void {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<PlayerShell />}>
          <Route path="/dashboard" element={content} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function expectSingleSharedShell(): void {
  expect(screen.getAllByTestId('player-navigation')).toHaveLength(1);
  expect(screen.getAllByTestId('search-palette')).toHaveLength(1);
}

function NormalPage(): ReactElement {
  return <main data-testid="normal-page">Normal player page</main>;
}

const pendingRouteContent = new Promise<never>(() => undefined);
function LoadingPage(): ReactElement {
  throw pendingRouteContent;
}

function ErrorPage(): ReactElement {
  throw new Error('route content failed');
}

function setBrowserPath(path: string): void {
  Object.assign(window.location, {
    origin: 'http://localhost',
    href: `http://localhost${path}`,
    pathname: path,
    search: '',
    hash: '',
  });
  window.history.replaceState({}, '', path);
}

function renderAppAt(path: string): void {
  setBrowserPath(path);
  render(<App />);
}

afterEach(() => {
  setBrowserPath('/');
});

describe('PlayerShell route layout', () => {
  it('renders exactly one Navigation and SearchPalette around normal route content', () => {
    renderShell(<NormalPage />);

    expect(screen.getByTestId('normal-page')).toBeInTheDocument();
    expectSingleSharedShell();
  });

  it('keeps the shared Navigation and SearchPalette available while route content loads', () => {
    renderShell(<LoadingPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expectSingleSharedShell();
  });

  it('keeps the shared Navigation and SearchPalette available when route content errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      renderShell(<ErrorPage />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expectSingleSharedShell();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps the shared Navigation and SearchPalette available for the player not-found state', () => {
    render(
      <MemoryRouter initialEntries={['/missing-player-route']}>
        <Routes>
          <Route element={<PlayerShell />}>
            <Route path="*" element={<PlayerNotFound />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expectSingleSharedShell();
  });

  it('uses the shared shell as the only page-level Navigation and SearchPalette composition', () => {
    renderShell(<main data-testid="page-without-shell">Page content owns no global shell</main>);

    expect(screen.getByTestId('page-without-shell')).toBeInTheDocument();
    expect(screen.queryAllByTestId('player-navigation')).toHaveLength(1);
    expect(screen.queryAllByTestId('search-palette')).toHaveLength(1);
  });
});

describe('App route boundaries', () => {
  it.each([
    ['/onboarding', 'onboarding-page'],
    ['/login', 'front-page'],
    ['/register', 'front-page'],
    ['/', 'front-page'],
    ['/admin/dashboard', 'admin-dashboard-page'],
  ])('does not mount the player shell on the excluded route %s', async (path, contentTestId) => {
    renderAppAt(path);

    expect(await screen.findByTestId(contentTestId)).toBeInTheDocument();
    expect(screen.queryByTestId('player-navigation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-palette')).not.toBeInTheDocument();
  });
});
