import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LogoB from '../assets/logos/logo-b.svg?react';
import HomeIcon from '../assets/icons/home.svg?react';
import RobotIcon from '../assets/icons/robot.svg?react';
import SwordsIcon from '../assets/icons/swords.svg?react';
import CartIcon from '../assets/icons/cart.svg?react';
import MenuIcon from '../assets/icons/menu.svg?react';
import CloseIcon from '../assets/icons/close.svg?react';

// Complete page inventory - all 70 pages
const implementedPages = new Set([
  '/dashboard',
  '/robots',
  '/robots/create',
  '/facilities',
  '/weapon-shop',
  '/battle-history',
  '/league-standings',
  '/admin',
  '/leaderboards/fame',
  '/leaderboards/prestige',
]);

const allPages = {
  robots: {
    label: 'Robots',
    items: [
      { path: '/robots', label: 'My Robots' },
      { path: '/robots/compare', label: 'Compare Robots' },
      { path: '/robots/training', label: 'Training Planner' },
      { path: '/robots/loadouts', label: 'Loadout Presets' },
      { path: '/robots/create', label: 'Create Robot' },
    ]
  },
  battle: {
    label: 'Battle',
    items: [
      { path: '/battle-history', label: 'Battle History' },
      { path: '/league-standings', label: 'League Standings' },
      { path: '/matchmaking', label: 'Matchmaking Queue' },
      { path: '/practice', label: 'Practice Arena' },
      { path: '/tournaments', label: 'Tournament Hub' },
      { path: '/events', label: 'Events Calendar' },
      { path: '/challenges', label: 'Daily Challenges' },
      { path: '/team/matchmaking', label: 'Team Matchmaking' },
      { path: '/team/history', label: 'Team Battle History' },
      { path: '/battle-royale', label: 'Battle Royale' },
      { path: '/guild-wars', label: 'Guild Wars' },
      { path: '/story', label: 'Story Mode' },
    ]
  },
  stable: {
    label: 'Stable',
    items: [
      { path: '/facilities', label: 'Facilities' },
      { path: '/weapon-shop', label: 'Weapon Shop' },
      { path: '/marketplace', label: 'Marketplace' },
      { path: '/marketplace/my-listings', label: 'My Listings' },
      { path: '/marketplace/history', label: 'Transaction History' },
      { path: '/crafting', label: 'Weapon Crafting' },
      { path: '/blueprints', label: 'Blueprint Library' },
      { path: '/income', label: 'Income Dashboard' },
      { path: '/prestige-store', label: 'Prestige Store' },
    ]
  },
  social: {
    label: 'Social',
    items: [
      { path: '/profile', label: 'My Profile' },
      { path: '/friends', label: 'Friends' },
      { path: '/notifications', label: 'Notifications' },
      { path: '/guilds', label: 'Browse Guilds' },
      { path: '/guild', label: 'My Guild' },
      { path: '/guild/manage', label: 'Guild Management' },
      { path: '/leaderboards/fame', label: 'Fame Leaderboard' },
      { path: '/leaderboards/prestige', label: 'Prestige Leaderboard' },
      { path: '/chat', label: 'Chat' },
      { path: '/replays', label: 'Battle Replays' },
      { path: '/spectate', label: 'Spectator Mode' },
    ]
  },
  customize: {
    label: 'Customize',
    items: [
      { path: '/customize', label: 'Customization Hub' },
      { path: '/customize/skins', label: 'Robot Skins' },
      { path: '/customize/stable', label: 'Stable Customization' },
      { path: '/customize/poses', label: 'Victory Poses' },
      { path: '/customize/emotes', label: 'Emotes & Taunts' },
    ]
  },
  analytics: {
    label: 'Analytics',
    items: [
      { path: '/analytics', label: 'Analytics Dashboard' },
      { path: '/analytics/battles', label: 'Battle Analytics' },
      { path: '/analytics/economy', label: 'Economy Analytics' },
      { path: '/simulator', label: 'Battle Simulator' },
      { path: '/calculator', label: 'Build Calculator' },
      { path: '/meta', label: 'Meta Reports' },
    ]
  },
};

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

function NavLink({ to, children, isActive, onClick, disabled = false }: NavLinkProps) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (!disabled) {
      navigate(to);
      onClick?.();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        px-3 py-2 rounded-md transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated
        ${disabled 
          ? 'text-tertiary cursor-not-allowed opacity-60' 
          : isActive 
            ? 'text-primary bg-primary/15 border-b-2 border-primary font-semibold rounded-t-md' 
            : 'text-secondary hover:text-primary hover:bg-white/5'
        }
      `}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
}

interface DropdownMenuProps {
  label: string;
  items: Array<{ path: string; label: string }>;
  isActive: boolean;
  checkActive: (path: string) => boolean;
}

function DropdownMenu({ label, items, isActive, checkActive }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [closeTimer, setCloseTimer] = useState<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const handleMouseEnter = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      setCloseTimer(null);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // Add 200ms delay before closing
    const timer = setTimeout(() => {
      setIsOpen(false);
    }, 200);
    setCloseTimer(timer);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`
          px-3 py-2 rounded-md transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated
          ${isActive 
            ? 'text-primary bg-primary/15 border-b-2 border-primary font-semibold rounded-t-md' 
            : 'text-secondary hover:text-primary hover:bg-white/5'
          }
        `}
      >
        {label} ▾
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-0 w-56 bg-surface-elevated border border-white/10 rounded-md shadow-xl z-50 py-2">
          {items.map(item => {
            const disabled = !implementedPages.has(item.path);
            const active = checkActive(item.path);
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  if (!disabled) {
                    navigate(item.path);
                    setIsOpen(false);
                    if (closeTimer) clearTimeout(closeTimer);
                  }
                }}
                disabled={disabled}
                className={`
                  w-full px-4 py-2 text-left transition-colors text-sm
                  ${disabled
                    ? 'text-tertiary cursor-not-allowed opacity-60'
                    : active
                      ? 'text-primary bg-primary/10'
                      : 'text-primary hover:bg-primary/5'
                  }
                `}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MobileTabProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function MobileTab({ icon, label, isActive, onClick }: MobileTabProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center flex-1 h-16
        transition-all duration-150
        ${isActive 
          ? 'text-primary bg-primary/10 font-semibold' 
          : 'text-secondary active:bg-primary/5 active:scale-95'
        }
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="w-6 h-6 mb-1">
        {icon}
      </div>
      <span className="text-xs leading-tight">{label}</span>
    </button>
  );
}

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Check if any item in a category is active
  const isCategoryActive = (items: Array<{ path: string; label: string }>) => {
    return items.some(item => isActive(item.path));
  };

  return (
    <>
      {/* Desktop Navigation - ≥1024px */}
      <nav className="hidden lg:block fixed top-0 left-0 right-0 bg-surface-elevated border-b border-white/10 z-[1000]">
        <div className="h-16 px-6 flex items-center justify-between">
          {/* Left Section: Logo + Primary Links */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-4 transition-opacity hover:opacity-80"
              aria-label="Armoured Souls Home"
            >
              <LogoB className="w-10 h-10 text-primary" />
              <h1 className="text-xl font-bold text-primary tracking-tight font-header">
                ARMOURED SOULS
              </h1>
            </button>
            
            <div className="flex gap-2 ml-4">
              <NavLink 
                to="/dashboard" 
                isActive={isActive('/dashboard')}
              >
                Dashboard
              </NavLink>
              
              <DropdownMenu
                label={allPages.robots.label}
                items={allPages.robots.items}
                isActive={isCategoryActive(allPages.robots.items)}
                checkActive={isActive}
              />
              
              <DropdownMenu
                label={allPages.battle.label}
                items={allPages.battle.items}
                isActive={isCategoryActive(allPages.battle.items)}
                checkActive={isActive}
              />
              
              <DropdownMenu
                label={allPages.stable.label}
                items={allPages.stable.items}
                isActive={isCategoryActive(allPages.stable.items)}
                checkActive={isActive}
              />
              
              <DropdownMenu
                label={allPages.social.label}
                items={allPages.social.items}
                isActive={isCategoryActive(allPages.social.items)}
                checkActive={isActive}
              />
              
              <DropdownMenu
                label={allPages.customize.label}
                items={allPages.customize.items}
                isActive={isCategoryActive(allPages.customize.items)}
                checkActive={isActive}
              />
              
              <DropdownMenu
                label={allPages.analytics.label}
                items={allPages.analytics.items}
                isActive={isCategoryActive(allPages.analytics.items)}
                checkActive={isActive}
              />
              
              {user.role === 'admin' && (
                <NavLink 
                  to="/admin" 
                  isActive={isActive('/admin')}
                >
                  ⚡ Admin
                </NavLink>
              )}
            </div>
          </div>

          {/* Right Section: Credits + Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface border border-white/10 px-3 py-2 rounded-md">
              <span className="text-primary">₡</span>
              <span className="text-primary font-medium">
                {user.currency.toLocaleString()}
              </span>
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
        {/* Mobile Top Header */}
        <header className="fixed top-0 left-0 right-0 bg-surface-elevated border-b border-white/10 z-[999]">
          <div className="h-14 px-4 flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3"
              aria-label="Armoured Souls Home"
            >
              <LogoB className="w-8 h-8 text-primary" />
              <h1 className="text-lg font-bold text-primary tracking-tight font-header">
                ARMOURED SOULS
              </h1>
            </button>
            
            <div className="flex items-center gap-2 bg-surface border border-white/10 px-2 py-1 rounded-md">
              <span className="text-primary text-sm">₡</span>
              <span className="text-primary text-sm font-medium">
                {user.currency.toLocaleString()}
              </span>
            </div>
          </div>
        </header>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-surface-elevated border-t border-white/10 z-[1000]">
          <div className="flex">
            <MobileTab
              icon={<HomeIcon />}
              label="Dashboard"
              isActive={isActive('/dashboard')}
              onClick={() => navigate('/dashboard')}
            />
            <MobileTab
              icon={<RobotIcon />}
              label="Robots"
              isActive={isActive('/robots')}
              onClick={() => navigate('/robots')}
            />
            <MobileTab
              icon={<SwordsIcon />}
              label="Battles"
              isActive={isActive('/battle-history')}
              onClick={() => navigate('/battle-history')}
            />
            <MobileTab
              icon={<CartIcon />}
              label="Shop"
              isActive={isActive('/weapon-shop')}
              onClick={() => navigate('/weapon-shop')}
            />
            <MobileTab
              icon={<MenuIcon />}
              label="More"
              isActive={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            />
          </div>
        </nav>

        {/* Hamburger Drawer */}
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 z-[1100] animate-fade-in"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            
            {/* Drawer */}
            <div 
              className="fixed top-0 right-0 bottom-0 w-[280px] bg-surface z-[1101] shadow-2xl animate-slide-in-right"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              {/* Drawer Header */}
              <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
                <h2 className="text-lg font-bold text-primary font-header tracking-tight">
                  ARMOURED SOULS
                </h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary transition-colors"
                  aria-label="Close menu"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Drawer Content - Scrollable */}
              <div className="py-4 overflow-y-auto h-[calc(100vh-56px)]">
                {/* ROBOTS Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    🤖 Robots
                  </h3>
                  <nav className="space-y-1">
                    {allPages.robots.items.map(item => (
                      <DrawerMenuItem
                        key={item.path}
                        label={item.label}
                        onClick={() => {
                          navigate(item.path);
                          setDrawerOpen(false);
                        }}
                        isActive={isActive(item.path)}
                        disabled={!implementedPages.has(item.path)}
                      />
                    ))}
                  </nav>
                </div>

                {/* BATTLE Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    ⚔️ Battle & Competition
                  </h3>
                  <nav className="space-y-1">
                    {allPages.battle.items.map(item => (
                      <DrawerMenuItem
                        key={item.path}
                        label={item.label}
                        onClick={() => {
                          navigate(item.path);
                          setDrawerOpen(false);
                        }}
                        isActive={isActive(item.path)}
                        disabled={!implementedPages.has(item.path)}
                      />
                    ))}
                  </nav>
                </div>

                {/* STABLE Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    🏰 Stable Management
                  </h3>
                  <nav className="space-y-1">
                    {allPages.stable.items.map(item => (
                      <DrawerMenuItem
                        key={item.path}
                        label={item.label}
                        onClick={() => {
                          navigate(item.path);
                          setDrawerOpen(false);
                        }}
                        isActive={isActive(item.path)}
                        disabled={!implementedPages.has(item.path)}
                      />
                    ))}
                  </nav>
                </div>

                {/* SOCIAL Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    👥 Social & Community
                  </h3>
                  <nav className="space-y-1">
                    {allPages.social.items.map(item => (
                      <DrawerMenuItem
                        key={item.path}
                        label={item.label}
                        onClick={() => {
                          navigate(item.path);
                          setDrawerOpen(false);
                        }}
                        isActive={isActive(item.path)}
                        disabled={!implementedPages.has(item.path)}
                      />
                    ))}
                  </nav>
                </div>

                {/* CUSTOMIZE Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    🎨 Customization
                  </h3>
                  <nav className="space-y-1">
                    {allPages.customize.items.map(item => (
                      <DrawerMenuItem
                        key={item.path}
                        label={item.label}
                        onClick={() => {
                          navigate(item.path);
                          setDrawerOpen(false);
                        }}
                        isActive={isActive(item.path)}
                        disabled={!implementedPages.has(item.path)}
                      />
                    ))}
                  </nav>
                </div>

                {/* ANALYTICS Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    📊 Analytics & Tools
                  </h3>
                  <nav className="space-y-1">
                    {allPages.analytics.items.map(item => (
                      <DrawerMenuItem
                        key={item.path}
                        label={item.label}
                        onClick={() => {
                          navigate(item.path);
                          setDrawerOpen(false);
                        }}
                        isActive={isActive(item.path)}
                        disabled={!implementedPages.has(item.path)}
                      />
                    ))}
                  </nav>
                </div>

                {/* SETTINGS & ADMIN Section */}
                <div className="border-t border-white/10 pt-4">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    ⚙️ Settings & Admin
                  </h3>
                  <nav className="space-y-1">
                    <DrawerMenuItem
                      label="Settings"
                      onClick={() => {
                        navigate('/settings');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/settings')}
                      disabled={true}
                    />
                    {user.role === 'admin' && (
                      <DrawerMenuItem
                        label="⚡ Admin Panel"
                        onClick={() => {
                          navigate('/admin');
                          setDrawerOpen(false);
                        }}
                        isActive={isActive('/admin')}
                      />
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left text-error hover:bg-error/10 transition-colors"
                    >
                      Logout
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Spacer for fixed navigation */}
      <div className="h-14 lg:h-16" />
      {/* Bottom spacer for mobile nav bar */}
      <div className="h-16 lg:hidden" />
    </>
  );
}

interface DrawerMenuItemProps {
  label: string;
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
}

function DrawerMenuItem({ label, onClick, isActive, disabled = false }: DrawerMenuItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        w-full px-4 py-3 text-left transition-colors
        ${disabled
          ? 'text-tertiary cursor-not-allowed opacity-60'
          : isActive 
            ? 'text-primary bg-primary/10 border-l-2 border-primary' 
            : 'text-primary hover:bg-primary/5'
        }
      `}
      aria-disabled={disabled}
    >
      {label}
    </button>
  );
}

export default Navigation;
