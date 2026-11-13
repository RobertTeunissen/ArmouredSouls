import CloseIcon from '../../assets/icons/close.svg?react';
import { DrawerMenuItem } from './DrawerMenuItem';
import { allPages, implementedPages, isNavPageImplemented, stableNavItems } from './types';
import type { UserRobot } from './types';
import { workshopPath } from '../../utils/robotRoutes';
import type { SavedAccount } from '../../utils/savedAccounts';

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
  /** Signed-in player: adds "My Stable" (their public stable page) to the Stable section. */
  userId?: number;
  /** The active account's user id, to exclude it from the switch list. */
  currentUserId?: number;
  /** Saved accounts available for switching (includes the current one). */
  savedAccounts?: SavedAccount[];
  onSwitchAccount?: (account: SavedAccount) => void;
  onAddAccount?: () => void;
}

export function MobileDrawer({
  isOpen,
  onClose,
  isActive,
  userRobots,
  isAdmin,
  onLogout,
  userId,
  currentUserId,
  savedAccounts = [],
  onSwitchAccount,
  onAddAccount,
}: MobileDrawerProps): React.ReactElement | null {
  if (!isOpen) return null;

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
          <h2 className="text-lg font-bold text-primary tracking-tight">
            ARMOURED SOULS
          </h2>
          <button
            onClick={onClose}
            className="w-11 h-11 -mr-1.5 flex items-center justify-center text-secondary hover:text-primary transition-colors"
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
              to={allPages.robots.items[0].path}
              onNavigate={onClose}
              isActive={isActive(allPages.robots.items[0].path)}
              disabled={!implementedPages.has(allPages.robots.items[0].path)}
            />
            {userRobots.map(robot => (
              <DrawerMenuItem
                key={robot.id}
                label={robot.name}
                to={workshopPath(robot.id)}
                onNavigate={onClose}
                isActive={isActive(`/robots/${robot.id}`)}
                indent={true}
              />
            ))}
            {allPages.robots.items.slice(1).map(item => (
              <DrawerMenuItem
                key={item.path}
                label={item.label}
                to={item.path}
                onNavigate={onClose}
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
                  to={item.path}
                  onNavigate={onClose}
                  isActive={isActive(item.path)}
                  disabled={!implementedPages.has(item.path)}
                />
              );
            })}
          </DrawerSection>

          {/* STABLE Section */}
          <DrawerSection emoji="🏰" title="Stable Management">
            {(userId !== undefined ? stableNavItems(userId) : allPages.stable.items).map(item => (
              <DrawerMenuItem
                key={item.path}
                label={item.label}
                to={item.path}
                onNavigate={onClose}
                isActive={isActive(item.path)}
                disabled={!isNavPageImplemented(item.path)}
              />
            ))}
          </DrawerSection>

          {/* SOCIAL Section */}
          <DrawerSection emoji="👥" title="Social & Community">
            {allPages.social.items.map(item => (
              <DrawerMenuItem
                key={item.path}
                label={item.label}
                to={item.path}
                onNavigate={onClose}
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
                to="/guide"
                onNavigate={onClose}
                isActive={isActive('/guide')}
              />
              <DrawerMenuItem
                label="Settings"
                to="/settings"
                onNavigate={onClose}
                isActive={isActive('/settings')}
                disabled={true}
              />
              {isAdmin && (
                <DrawerMenuItem
                  label="⚡ Admin Panel"
                  to="/admin"
                  onNavigate={onClose}
                  isActive={isActive('/admin')}
                />
              )}

              {/* Account switching: list other saved accounts, then add + logout. */}
              {onSwitchAccount &&
                savedAccounts
                  .filter((account) => account.userId !== currentUserId)
                  .map((account) => (
                    <button
                      key={account.userId}
                      type="button"
                      onClick={() => onSwitchAccount(account)}
                      className="w-full px-4 py-3 text-left text-primary hover:bg-primary/5 transition-colors truncate"
                      title={account.label}
                    >
                      👤 Switch to {account.label}
                    </button>
                  ))}
              {onAddAccount && (
                <button
                  type="button"
                  onClick={onAddAccount}
                  className="w-full px-4 py-3 text-left text-primary hover:bg-primary/5 transition-colors"
                >
                  + Add account
                </button>
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
