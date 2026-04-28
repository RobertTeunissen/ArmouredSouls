import { Component, Suspense } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Navigation configuration
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
    ],
  },
  {
    section: 'Game Operations',
    items: [
      { label: 'Cycle Controls', path: '/admin/cycles', icon: '⚙️' },
      { label: 'Practice Arena', path: '/admin/practice-arena', icon: '🏟️' },
    ],
  },
  {
    section: 'Battle Data',
    items: [
      { label: 'Battle Logs', path: '/admin/battles', icon: '⚔️' },
      { label: 'Robot Stats', path: '/admin/robot-stats', icon: '🤖' },
      { label: 'League Health', path: '/admin/league-health', icon: '🏆' },
      { label: 'Weapons', path: '/admin/weapons', icon: '🔫' },
    ],
  },
  {
    section: 'Player Management',
    items: [
      { label: 'Players', path: '/admin/players', icon: '👥' },
      { label: 'Economy', path: '/admin/economy', icon: '💰' },
    ],
  },
  {
    section: 'Security & Moderation',
    items: [
      { label: 'Security', path: '/admin/security', icon: '🛡️' },
      { label: 'Image Uploads', path: '/admin/image-uploads', icon: '🖼️' },
    ],
  },
  {
    section: 'Content',
    items: [
      { label: 'Changelog', path: '/admin/changelog', icon: '📝' },
      { label: 'Achievements', path: '/admin/achievements', icon: '🏅' },
      { label: 'Tuning', path: '/admin/tuning', icon: '🎛️' },
    ],
  },
  {
    section: 'Maintenance',
    items: [
      { label: 'Repair Log', path: '/admin/repair-log', icon: '🔧' },
      { label: 'Audit Log', path: '/admin/audit-log', icon: '📋' },
    ],
  },
];


/** Map route paths to human-readable page titles for the header bar. */
const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/cycles': 'Cycle Controls',
  '/admin/practice-arena': 'Practice Arena',
  '/admin/battles': 'Battle Logs',
  '/admin/robot-stats': 'Robot Stats',
  '/admin/league-health': 'League Health',
  '/admin/weapons': 'Weapons',
  '/admin/players': 'Players',
  '/admin/economy': 'Economy',
  '/admin/security': 'Security',
  '/admin/image-uploads': 'Image Uploads',
  '/admin/changelog': 'Changelog',
  '/admin/achievements': 'Achievements',
  '/admin/tuning': 'Tuning',
  '/admin/repair-log': 'Repair Log',
  '/admin/audit-log': 'Audit Log',
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
    console.error('AdminLayout error boundary caught:', error, info);
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
// Sidebar component
// ---------------------------------------------------------------------------

function Sidebar() {
  const location = useLocation();

  /**
   * Determine whether a nav item should be highlighted as active.
   * Exact match is used for most routes. For `/admin/cycles` we need
   * exact match to avoid highlighting it when on `/admin/cycles/history`.
   */
  const isActive = (path: string): boolean => {
    if (path === '/admin/cycles') {
      return location.pathname === '/admin/cycles';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-surface-elevated border-r border-white/10 flex flex-col overflow-y-auto z-40
                 w-16 md:w-60 transition-[width] duration-200"
      aria-label="Admin sidebar navigation"
    >
      {/* Sidebar header */}
      <div className="h-14 flex items-center px-4 border-b border-white/10 shrink-0">
        <span className="hidden md:inline text-primary font-bold text-lg font-header tracking-tight">
          Admin Portal
        </span>
        <span className="md:hidden text-primary font-bold text-lg">⚡</span>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.section}>
            <h3 className="hidden md:block px-4 mb-1 text-xs font-semibold text-tertiary uppercase tracking-wider">
              {group.section}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/admin/cycles'}
                      className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors
                        ${active
                          ? 'bg-primary/15 text-primary border-r-2 border-primary'
                          : 'text-secondary hover:text-white hover:bg-white/5'
                        }`}
                      title={item.label}
                    >
                      <span className="text-base shrink-0" role="img" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="hidden md:inline truncate">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
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

      {/* Main content area — offset by sidebar width */}
      <div className="ml-16 md:ml-60 flex flex-col min-h-screen transition-[margin] duration-200">
        {/* Header bar */}
        <header className="h-14 flex items-center justify-between px-6 bg-surface border-b border-white/10 shrink-0">
          <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>
          <Link
            to="/dashboard"
            className="text-sm text-secondary hover:text-primary transition-colors"
          >
            ← Back to Game
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
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
