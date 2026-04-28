import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import LogoB from '../assets/logos/logo-b.svg?react';
import HomeIcon from '../assets/icons/home.svg?react';
import RobotIcon from '../assets/icons/robot.svg?react';
import SwordsIcon from '../assets/icons/swords.svg?react';
import CartIcon from '../assets/icons/cart.svg?react';
import MenuIcon from '../assets/icons/menu.svg?react';
import OnboardingNavBanner from './OnboardingNavBanner';
import { NavLink, DropdownMenu, MobileTab, MobileDrawer } from './nav';
import { allPages } from './nav';
import type { UserRobot } from './nav';

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userRobots, setUserRobots] = useState<UserRobot[]>([]);

  useEffect(() => {
    const fetchRobots = async () => {
      try {
        const response = await apiClient.get('/api/robots');
        setUserRobots(response.data.map((robot: { id: number; name: string }) => ({ id: robot.id, name: robot.name })));
      } catch {
        // Silently handle fetch failure
      }
    };
    if (user) fetchRobots();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/dashboard' || path === '/') {
      return currentPath === '/' || currentPath === '/dashboard';
    }
    return currentPath.startsWith(path);
  };

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
              <h1 className="text-xl font-bold text-primary tracking-tight font-header">ARMOURED SOULS</h1>
            </button>

            <div className="flex gap-2 ml-4">
              <NavLink to="/dashboard" isActive={isActive('/dashboard')}>Dashboard</NavLink>

              <DropdownMenu
                label={allPages.robots.label}
                items={[
                  allPages.robots.items[0],
                  ...userRobots.map(robot => ({ path: `/robots/${robot.id}`, label: robot.name, indent: true })),
                  ...allPages.robots.items.slice(1),
                ]}
                isActive={isCategoryActive(allPages.robots.items)}
                checkActive={isActive}
              />
              <DropdownMenu label={allPages.battle.label} items={allPages.battle.items} isActive={isCategoryActive(allPages.battle.items)} checkActive={isActive} />
              <DropdownMenu label={allPages.stable.label} items={allPages.stable.items} isActive={isCategoryActive(allPages.stable.items)} checkActive={isActive} />
              <DropdownMenu label={allPages.social.label} items={allPages.social.items} isActive={isCategoryActive(allPages.social.items)} checkActive={isActive} />
              <DropdownMenu label={allPages.customize.label} items={allPages.customize.items} isActive={isCategoryActive(allPages.customize.items)} checkActive={isActive} />

              <NavLink to="/guide" isActive={isActive('/guide')}>📖 Guide</NavLink>
              {user.role === 'admin' && (
                <NavLink to="/admin" isActive={isActive('/admin')}>⚡ Admin</NavLink>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface border border-white/10 px-3 py-2 rounded-md">
              <span className="text-primary">₡</span>
              <span className="text-primary font-medium">{user.currency.toLocaleString()}</span>
            </div>
            <button
              onClick={handleLogout}
              className="border border-error/30 text-error hover:bg-error/10 px-4 py-2 rounded-md transition-all duration-150"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation - <768px */}
      <div className="lg:hidden">
        <header className="fixed top-0 left-0 right-0 bg-surface-elevated border-b border-white/10 z-[999]">
          <div className="h-14 px-4 flex items-center justify-between">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-3" aria-label="Armoured Souls Home">
              <LogoB className="w-8 h-8 text-primary" />
              <h1 className="text-lg font-bold text-primary tracking-tight font-header">ARMOURED SOULS</h1>
            </button>
            <div className="flex items-center gap-2 bg-surface border border-white/10 px-2 py-1 rounded-md">
              <span className="text-primary text-sm">₡</span>
              <span className="text-primary text-sm font-medium">{user.currency.toLocaleString()}</span>
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
        />
      </div>

      <div className="h-14 lg:h-16" />
      <OnboardingNavBanner />
      <div className="h-16 lg:hidden" />
    </>
  );
}

export default Navigation;
