import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LogoB from '../assets/logos/logo-b.svg?react';
import HomeIcon from '../assets/icons/home.svg?react';
import RobotIcon from '../assets/icons/robot.svg?react';
import SwordsIcon from '../assets/icons/swords.svg?react';
import CartIcon from '../assets/icons/cart.svg?react';
import MenuIcon from '../assets/icons/menu.svg?react';
import OnboardingNavBanner from './OnboardingNavBanner';
import SeasonProgressIndicator from './season/SeasonProgressIndicator';
import SeasonCountdownBanner from './season/SeasonCountdownBanner';
import SeasonSummaryModal from './season/SeasonSummaryModal';
import { useSeasonStore } from '../stores/seasonStore';
import { NavLink, DropdownMenu, AccountMenu, MobileTab, MobileDrawer } from './nav';
import { allPages, stableNavItems } from './nav';
import { listSavedAccounts, type SavedAccount } from '../utils/savedAccounts';
import type { UserRobot } from './nav';
import { useRobotStore } from '../stores';
import SearchTrigger from './search/SearchTrigger';
import { workshopPath } from '../utils/robotRoutes';

export interface NavigationProps {
  onOpenSearch?: () => void;
}

function Navigation({ onOpenSearch }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, switchAccount } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const storeRobots = useRobotStore((state) => state.robots);
  const fetchRobots = useRobotStore((state) => state.fetchRobots);
  const userRobots: UserRobot[] = storeRobots.map((robot) => ({ id: robot.id, name: robot.name }));
  const fetchSeason = useSeasonStore((s) => s.fetchSeason);

  // Season state drives the progress indicator, countdown banner, and summary
  // modal. Fetched once here rather than per component.
  useEffect(() => {
    void fetchSeason();
  }, [fetchSeason]);

  useEffect(() => {
    if (user) void fetchRobots();
  }, [fetchRobots, user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Account switching. Read on each render so a freshly-saved account (e.g. right
  // after login) appears without a reload; the list is small.
  const savedAccounts: SavedAccount[] = listSavedAccounts();

  const handleSwitchAccount = (account: SavedAccount): void => {
    setDrawerOpen(false);
    void switchAccount(account)
      .then(() => {
        // Land on the dashboard of the newly-active account.
        navigate('/dashboard');
      })
      .catch(() => {
        // The saved token was expired or revoked: send the player to the login
        // form to authenticate as that account again.
        navigate('/login');
      });
  };

  const handleAddAccount = (): void => {
    setDrawerOpen(false);
    // Adding an account is just logging into another one. Clear the active
    // session first so the login form is shown rather than a redirect home.
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/dashboard' || path === '/') {
      return currentPath === '/' || currentPath === '/dashboard';
    }
    // Exact match: /stables/7 must not light up on /stables/70 or another player's stable.
    if (path.startsWith('/stables/')) return currentPath === path;
    return currentPath.startsWith(path);
  };

  const stableItems = stableNavItems(user.id);

  const isCategoryActive = (items: Array<{ path: string; label: string }>) =>
    items.some(item => isActive(item.path));

  return (
    <>
      {/* Desktop Navigation - ≥1024px */}
      <nav className="hidden lg:block fixed top-0 left-0 right-0 bg-surface-elevated border-b border-white/10 z-[1000]">
        <div className="h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-4 transition-opacity hover:opacity-80"
              aria-label="Armoured Souls Home"
            >
              <LogoB className="w-10 h-10 text-primary" />
              <h1 className="text-xl font-bold text-primary tracking-tight">ARMOURED SOULS</h1>
            </button>

            <div className="flex gap-2 ml-4">
              <NavLink to="/dashboard" isActive={isActive('/dashboard')}>Dashboard</NavLink>

              <DropdownMenu
                label={allPages.robots.label}
                items={[
                  allPages.robots.items[0],
                  ...userRobots.map(robot => ({ path: workshopPath(robot.id), label: robot.name, indent: true })),
                  ...allPages.robots.items.slice(1),
                ]}
                isActive={isCategoryActive(allPages.robots.items)}
                checkActive={isActive}
              />
              <DropdownMenu label={allPages.battle.label} items={allPages.battle.items} isActive={isCategoryActive(allPages.battle.items)} checkActive={isActive} />
              <DropdownMenu label={allPages.stable.label} items={stableItems} isActive={isCategoryActive(stableItems)} checkActive={isActive} />
              <DropdownMenu label={allPages.social.label} items={allPages.social.items} isActive={isCategoryActive(allPages.social.items)} checkActive={isActive} />

              <NavLink to="/guide" isActive={isActive('/guide')}>📖 Guide</NavLink>
              {user.role === 'admin' && (
                <NavLink to="/admin" isActive={isActive('/admin')}>⚡ Admin</NavLink>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SearchTrigger onOpenSearch={onOpenSearch} />
            <SeasonProgressIndicator />
            <div className="flex items-center gap-2 bg-surface border border-white/10 px-3 py-2 rounded-md">
              <span className="text-primary">₡</span>
              <span className="text-primary font-medium">{user.currency.toLocaleString()}</span>
            </div>
            <AccountMenu
              currentLabel={user.stableName || user.username}
              currentUserId={user.id}
              savedAccounts={savedAccounts}
              onSwitchAccount={handleSwitchAccount}
              onAddAccount={handleAddAccount}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </nav>

      {/* Mobile Navigation - <768px */}
      <div className="lg:hidden">
        <header className="fixed top-0 left-0 right-0 bg-surface-elevated border-b border-white/10 z-[999]">
          <div className="h-14 px-1 sm:px-4 flex min-w-0 items-center justify-between">
            <button onClick={() => navigate('/dashboard')} className="flex min-w-0 shrink items-center gap-1 sm:gap-3" aria-label="Armoured Souls Home">
              <LogoB className="h-8 w-8 shrink-0 text-primary" />
              <h1 className="hidden truncate text-lg font-bold tracking-tight text-primary sm:block">ARMOURED SOULS</h1>
            </button>
          <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            <SeasonProgressIndicator compact className="hidden max-w-[6rem] overflow-hidden text-ellipsis sm:inline-flex sm:max-w-none" />
            <SearchTrigger variant="mobile" onOpenSearch={onOpenSearch} />
            <div className="flex min-w-0 max-w-[4.5rem] items-center gap-1 overflow-hidden rounded-md border border-white/10 bg-surface px-1.5 py-1 sm:max-w-none sm:gap-2 sm:px-2">
              <span className="text-primary text-sm">₡</span>
              <span className="truncate text-primary text-sm font-medium">{user.currency.toLocaleString()}</span>
            </div>
            </div>
          </div>
        </header>

        <nav className="fixed bottom-0 left-0 right-0 bg-surface-elevated border-t border-white/10 z-[1000]">
          <div className="flex">
            <MobileTab icon={<HomeIcon />} label="Dashboard" isActive={isActive('/dashboard')} onClick={() => navigate('/dashboard')} />
            <MobileTab icon={<RobotIcon />} label="Robots" isActive={isActive('/robots')} onClick={() => navigate('/robots')} />
            <MobileTab icon={<SwordsIcon />} label="Battles" isActive={isActive('/battle-history')} onClick={() => navigate('/battle-history')} />
            <MobileTab icon={<CartIcon />} label="Shop" isActive={isActive('/weapon-shop')} onClick={() => navigate('/weapon-shop')} />
            <MobileTab icon={<MenuIcon />} label="More" isActive={drawerOpen} onClick={() => setDrawerOpen(true)} />
          </div>
        </nav>

        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          isActive={isActive}
          userRobots={userRobots}
          isAdmin={user.role === 'admin'}
          onLogout={handleLogout}
          userId={user.id}
          currentUserId={user.id}
          savedAccounts={savedAccounts}
          onSwitchAccount={handleSwitchAccount}
          onAddAccount={handleAddAccount}
        />
      </div>

      <div className="h-14 lg:h-16" />
      <SeasonCountdownBanner userId={user.id} />
      <OnboardingNavBanner />
      {/* The spacer for the fixed bottom tab bar lives after the page
          (PlayerShell). Here it pushed every mobile page down by 64px, a blank
          band under the header and banners. */}
      <SeasonSummaryModal />
    </>
  );
}

export default Navigation;
