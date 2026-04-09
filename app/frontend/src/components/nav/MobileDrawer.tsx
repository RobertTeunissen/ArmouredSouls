import { useNavigate } from 'react-router-dom';
import CloseIcon from '../../assets/icons/close.svg?react';
import { DrawerMenuItem } from './DrawerMenuItem';
import { allPages, implementedPages } from './types';
import type { UserRobot } from './types';

interface DrawerSectionProps {
  emoji: string;
  title: string;
  children: React.ReactNode;
}

function DrawerSection({ emoji, title, children }: DrawerSectionProps): React.ReactElement {
  return (
    <div className="mb-6">
      <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
        {emoji} {title}
      </h3>
      <nav className="space-y-1">
        {children}
      </nav>
    </div>
  );
}

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isActive: (path: string) => boolean;
  userRobots: UserRobot[];
  isAdmin: boolean;
  onLogout: () => void;
}

export function MobileDrawer({ isOpen, onClose, isActive, userRobots, isAdmin, onLogout }: MobileDrawerProps): React.ReactElement | null {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const navTo = (path: string): void => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[1100] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div 
        className="fixed top-0 right-0 bottom-0 w-[280px] bg-surface z-[1101] shadow-2xl animate-slide-in-right"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
          <h2 className="text-lg font-bold text-primary font-header tracking-tight">
            ARMOURED SOULS
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary transition-colors"
            aria-label="Close menu"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="py-4 overflow-y-auto h-[calc(100vh-56px)]">
          {/* ROBOTS Section */}
          <DrawerSection emoji="🤖" title="Robots">
            <DrawerMenuItem
              label={allPages.robots.items[0].label}
              onClick={() => navTo(allPages.robots.items[0].path)}
              isActive={isActive(allPages.robots.items[0].path)}
              disabled={!implementedPages.has(allPages.robots.items[0].path)}
            />
            {userRobots.map(robot => (
              <DrawerMenuItem
                key={robot.id}
                label={robot.name}
                onClick={() => navTo(`/robots/${robot.id}`)}
                isActive={isActive(`/robots/${robot.id}`)}
                indent={true}
              />
            ))}
            {allPages.robots.items.slice(1).map(item => (
              <DrawerMenuItem
                key={item.path}
                label={item.label}
                onClick={() => navTo(item.path)}
                isActive={isActive(item.path)}
                disabled={!implementedPages.has(item.path)}
              />
            ))}
          </DrawerSection>

          {/* BATTLE Section */}
          <DrawerSection emoji="⚔️" title="Battle & Competition">
            {allPages.battle.items.map(item => {
              if (item.path === '---') {
                return <hr key="divider" className="my-2 mx-4 border-white/10" />;
              }
              return (
                <DrawerMenuItem
                  key={item.path}
                  label={item.label}
                  onClick={() => navTo(item.path)}
                  isActive={isActive(item.path)}
                  disabled={!implementedPages.has(item.path)}
                />
              );
            })}
          </DrawerSection>

          {/* STABLE Section */}
          <DrawerSection emoji="🏰" title="Stable Management">
            {allPages.stable.items.map(item => (
              <DrawerMenuItem
                key={item.path}
                label={item.label}
                onClick={() => navTo(item.path)}
                isActive={isActive(item.path)}
                disabled={!implementedPages.has(item.path)}
              />
            ))}
          </DrawerSection>

          {/* SOCIAL Section */}
          <DrawerSection emoji="👥" title="Social & Community">
            {allPages.social.items.map(item => (
              <DrawerMenuItem
                key={item.path}
                label={item.label}
                onClick={() => navTo(item.path)}
                isActive={isActive(item.path)}
                disabled={!implementedPages.has(item.path)}
              />
            ))}
          </DrawerSection>

          {/* CUSTOMIZE Section */}
          <DrawerSection emoji="🎨" title="Customization">
            {allPages.customize.items.map(item => (
              <DrawerMenuItem
                key={item.path}
                label={item.label}
                onClick={() => navTo(item.path)}
                isActive={isActive(item.path)}
                disabled={!implementedPages.has(item.path)}
              />
            ))}
          </DrawerSection>

          {/* SETTINGS & ADMIN Section */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
              ⚙️ Settings & Admin
            </h3>
            <nav className="space-y-1">
              <DrawerMenuItem
                label="📖 Game Guide"
                onClick={() => navTo('/guide')}
                isActive={isActive('/guide')}
              />
              <DrawerMenuItem
                label="Settings"
                onClick={() => navTo('/settings')}
                isActive={isActive('/settings')}
                disabled={true}
              />
              {isAdmin && (
                <DrawerMenuItem
                  label="⚡ Admin Panel"
                  onClick={() => navTo('/admin')}
                  isActive={isActive('/admin')}
                />
              )}
              <button
                onClick={onLogout}
                className="w-full px-4 py-3 text-left text-error hover:bg-error/10 transition-colors"
              >
                Logout
              </button>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
