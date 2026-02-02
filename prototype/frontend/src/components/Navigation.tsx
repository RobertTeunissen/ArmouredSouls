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

  const primaryNavLinks = [
    { path: '/dashboard', label: 'Dashboard', disabled: false },
    { path: '/robots', label: 'My Robots', disabled: false },
    { path: '/facilities', label: 'Facilities', disabled: false },
    { path: '/weapon-shop', label: 'Weapon Shop', disabled: false },
    { path: '/battle-history', label: 'Battle History', disabled: false },
    { path: '/league-standings', label: 'Leagues', disabled: false },
    { path: '/matchmaking', label: 'Matchmaking', disabled: true },
    { path: '/profile', label: 'Profile', disabled: true },
  ];

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
              {primaryNavLinks.map(link => (
                <NavLink 
                  key={link.path}
                  to={link.path} 
                  isActive={isActive(link.path)}
                  disabled={link.disabled}
                >
                  {link.label}
                </NavLink>
              ))}
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

              {/* Drawer Content */}
              <div className="py-4">
                {/* MANAGE STABLE Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    🛠️ Manage Stable
                  </h3>
                  <nav className="space-y-1">
                    <DrawerMenuItem
                      label="My Robots"
                      onClick={() => {
                        navigate('/robots');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/robots')}
                    />
                    <DrawerMenuItem
                      label="Facilities"
                      onClick={() => {
                        navigate('/facilities');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/facilities')}
                    />
                    <DrawerMenuItem
                      label="Weapon Shop"
                      onClick={() => {
                        navigate('/weapon-shop');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/weapon-shop')}
                    />
                    <DrawerMenuItem
                      label="Weapon Inventory"
                      onClick={() => {
                        navigate('/weapon-inventory');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/weapon-inventory')}
                    />
                  </nav>
                </div>

                {/* COMPETE Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    🏆 Compete
                  </h3>
                  <nav className="space-y-1">
                    <DrawerMenuItem
                      label="Matchmaking"
                      onClick={() => {
                        navigate('/matchmaking');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/matchmaking')}
                      disabled={true}
                    />
                    <DrawerMenuItem
                      label="Battle History"
                      onClick={() => {
                        navigate('/battle-history');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/battle-history')}
                    />
                    <DrawerMenuItem
                      label="Leagues"
                      onClick={() => {
                        navigate('/league-standings');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/league-standings')}
                    />
                    <DrawerMenuItem
                      label="Tournaments"
                      onClick={() => {
                        navigate('/tournaments');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/tournaments')}
                      disabled={true}
                    />
                    {user.role === 'admin' && (
                      <DrawerMenuItem
                        label="⚡ Admin"
                        onClick={() => {
                          navigate('/admin');
                          setDrawerOpen(false);
                        }}
                        isActive={isActive('/admin')}
                      />
                    )}
                  </nav>
                </div>

                {/* SOCIAL Section */}
                <div className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    👥 Social
                  </h3>
                  <nav className="space-y-1">
                    <DrawerMenuItem
                      label="Friends"
                      onClick={() => {
                        navigate('/friends');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/friends')}
                      disabled={true}
                    />
                    <DrawerMenuItem
                      label="Guild"
                      onClick={() => {
                        navigate('/guild');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/guild')}
                      disabled={true}
                    />
                    <DrawerMenuItem
                      label="Leaderboards"
                      onClick={() => {
                        navigate('/leaderboards');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/leaderboards')}
                      disabled={true}
                    />
                  </nav>
                </div>

                {/* SETTINGS Section */}
                <div className="border-t border-white/10 pt-4">
                  <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
                    ⚙️ Settings
                  </h3>
                  <nav className="space-y-1">
                    <DrawerMenuItem
                      label="Profile"
                      onClick={() => {
                        navigate('/profile');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/profile')}
                      disabled={true}
                    />
                    <DrawerMenuItem
                      label="Settings"
                      onClick={() => {
                        navigate('/settings');
                        setDrawerOpen(false);
                      }}
                      isActive={isActive('/settings')}
                      disabled={true}
                    />
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
