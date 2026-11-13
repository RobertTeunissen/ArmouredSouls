/**
 * AccountMenu — desktop navbar account dropdown for the Switch Account feature.
 *
 * ACC players run several stables, each a separate account. This menu shows the
 * current stable, lets the player switch to any other account they've signed
 * into, add a new account (go to login), and log out.
 *
 * Switching is a best-effort token swap: a saved token can be expired or
 * revoked, so the caller's switch handler routes the player to the login form
 * when a switch fails. This component only presents the choices.
 *
 * Mirrors DropdownMenu's hover-open pattern and styling, but its items trigger
 * callbacks (switch/add/logout) rather than being plain route links, which is
 * why it is a separate component.
 */

import { useState } from 'react';
import type { SavedAccount } from '../../utils/savedAccounts';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export interface AccountMenuProps {
  /** Label for the active account: stable name when set, else username. */
  currentLabel: string;
  /** The active account's user id, to exclude it from the switch list. */
  currentUserId: number;
  /** Every saved account, including the current one. */
  savedAccounts: SavedAccount[];
  onSwitchAccount: (account: SavedAccount) => void;
  onAddAccount: () => void;
  onLogout: () => void;
}

export function AccountMenu({
  currentLabel,
  currentUserId,
  savedAccounts,
  onSwitchAccount,
  onAddAccount,
  onLogout,
}: AccountMenuProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [closeTimer, setCloseTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const otherAccounts = savedAccounts.filter((a) => a.userId !== currentUserId);

  const open = (): void => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      setCloseTimer(null);
    }
    setIsOpen(true);
  };

  const scheduleClose = (): void => {
    const timer = setTimeout(() => setIsOpen(false), 200);
    setCloseTimer(timer);
  };

  const close = (): void => {
    setIsOpen(false);
    if (closeTimer) clearTimeout(closeTimer);
  };

  useEscapeKey(close, isOpen);

  const itemClasses =
    'block w-full px-4 py-2 text-left transition-colors text-sm text-primary hover:bg-primary/5';

  return (
    <div className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={() => (isOpen ? close() : open())}
        aria-haspopup="menu"
        aria-label={`Account menu, signed in as ${currentLabel}`}
        title={currentLabel}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 px-2 py-2 rounded-md border border-white/10 transition-all duration-150 text-secondary hover:text-primary hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated"
      >
        {/* The desktop top bar has no spare width below ~1536px: it previously
            ended in a compact "Logout" button, and anything wider pushes the row
            into horizontal overflow (or, if the groups are allowed to shrink,
            makes the nav links overlap the search trigger). So the trigger is
            icon + caret only — narrower than the old Logout button — and the
            stable name appears beside it only on 2xl screens. The full name is
            always in the accessible label, the tooltip, and the open menu. */}
        <span className="flex-shrink-0" aria-hidden="true">👤</span>
        <span className="hidden 2xl:inline max-w-[12rem] truncate" aria-hidden="true">{currentLabel}</span>
        <span className="flex-shrink-0" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-0 w-64 bg-surface-elevated border border-white/10 rounded-md shadow-xl z-50 py-2"
        >
          <div className="px-4 py-2 text-xs font-semibold text-tertiary uppercase tracking-wider">
            Signed in as
          </div>
          <div className="px-4 pb-2 text-sm text-white font-medium truncate" title={currentLabel}>
            {currentLabel}
          </div>

          {otherAccounts.length > 0 && (
            <>
              <hr className="my-1 border-white/10" />
              <div className="px-4 py-1 text-xs font-semibold text-tertiary uppercase tracking-wider">
                Switch to
              </div>
              {otherAccounts.map((account) => (
                <button
                  key={account.userId}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    onSwitchAccount(account);
                  }}
                  className={`${itemClasses} truncate`}
                  title={account.label}
                >
                  {account.label}
                </button>
              ))}
            </>
          )}

          <hr className="my-1 border-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onAddAccount();
            }}
            className={itemClasses}
          >
            + Add account
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onLogout();
            }}
            className="block w-full px-4 py-2 text-left transition-colors text-sm text-error hover:bg-error/10"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
