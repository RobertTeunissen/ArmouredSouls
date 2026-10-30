import { Component, Suspense } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { createLogger } from '../../utils/logger';
import { AdminNavList } from './AdminNav';
import { AdminMobileNav } from './AdminMobileNav';
import { ADMIN_FOCUS_RING } from './shared/focusRing';

const log = createLogger('AdminLayout');

/** Map route paths to human-readable page titles for the header bar. */
const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/search-analytics': 'Search Analytics',
  '/admin/cycles': 'Cycle Controls',
  '/admin/seasons': 'Season Control',
  '/admin/practice-arena': 'Practice Arena',
  '/admin/battles': 'Battles',
  '/admin/attributes': 'Attributes',
  '/admin/meta': 'Meta',
  '/admin/league-health': 'League Health',
  '/admin/weapons': 'Weapons',
  '/admin/players': 'Players',
  '/admin/economy': 'Economy',
  '/admin/automatons': 'Automaton Stables',
  '/admin/security': 'Security',
  '/admin/image-uploads': 'Image Uploads',
  '/admin/changelog': 'Changelog',
  '/admin/achievements': 'Achievements',
  '/admin/tuning': 'Tuning',
  '/admin/refinement': 'Refinement',
  '/admin/repair-log': 'Repair Log',
  '/admin/audit-log': 'Audit Log',
  '/admin/tournaments': 'Tournaments',
};

// ---------------------------------------------------------------------------
// Error boundary for the content area
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class AdminErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('AdminLayout error boundary caught', { error, info });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <p className="text-xl text-white font-semibold">Something went wrong</p>
          <a
            href="/admin/dashboard"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Loading fallback for Suspense
// ---------------------------------------------------------------------------

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-lg text-secondary">Loading…</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop sidebar (md and up). Below md the AdminMobileNav drawer replaces it.
// ---------------------------------------------------------------------------

function Sidebar() {
  return (
    <aside
      className="fixed top-0 left-0 h-screen w-60 bg-surface-elevated border-r border-white/10 hidden md:flex flex-col overflow-y-auto z-40"
      aria-label="Admin sidebar navigation"
    >
      <div className="h-14 flex items-center px-4 border-b border-white/10 shrink-0">
        <span className="text-primary font-bold text-lg tracking-tight">Admin Portal</span>
      </div>
      <AdminNavList />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// AdminLayout
// ---------------------------------------------------------------------------

function AdminLayout() {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Admin';

  return (
    <div className="min-h-screen bg-background text-white">
      <Sidebar />

      {/* Main content area — offset by the sidebar width from md */}
      <div className="md:ml-60 flex flex-col min-h-screen">
        <header className="h-14 flex items-center justify-between gap-3 px-4 sm:px-6 bg-surface border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AdminMobileNav />
            <h1 className="text-lg font-semibold text-white truncate">{pageTitle}</h1>
          </div>
          <Link
            to="/dashboard"
            aria-label="Back to Game"
            className={`shrink-0 rounded text-sm text-secondary hover:text-primary transition-colors ${ADMIN_FOCUS_RING}`}
          >
            <span aria-hidden="true">← </span>
            <span className="sm:hidden">Game</span>
            <span className="hidden sm:inline">Back to Game</span>
          </Link>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <AdminErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <Outlet />
            </Suspense>
          </AdminErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
