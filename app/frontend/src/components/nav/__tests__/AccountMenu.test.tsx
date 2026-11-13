/**
 * AccountMenu — desktop account dropdown for Switch Account.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountMenu } from '../AccountMenu';
import type { SavedAccount } from '../../../utils/savedAccounts';

const alice: SavedAccount = { userId: 1, label: 'Iron Wolves', username: 'alice', token: 't1' };
const bob: SavedAccount = { userId: 2, label: 'Steel Hawks', username: 'bob', token: 't2' };

describe('AccountMenu', () => {
  const onSwitchAccount = vi.fn();
  const onAddAccount = vi.fn();
  const onLogout = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  function renderMenu(saved: SavedAccount[] = [alice, bob]) {
    return render(
      <AccountMenu
        currentLabel="Iron Wolves"
        currentUserId={1}
        savedAccounts={saved}
        onSwitchAccount={onSwitchAccount}
        onAddAccount={onAddAccount}
        onLogout={onLogout}
      />,
    );
  }

  it('shows the current account label on the trigger', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: /Iron Wolves/ })).toBeInTheDocument();
  });

  it('opens on click and lists other saved accounts, excluding the current one', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /Iron Wolves/ }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    // Bob is offered; Alice (current) is not offered as a switch target.
    expect(screen.getByRole('menuitem', { name: 'Steel Hawks' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Iron Wolves' })).not.toBeInTheDocument();
  });

  it('triggers onSwitchAccount with the chosen account', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /Iron Wolves/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Steel Hawks' }));
    expect(onSwitchAccount).toHaveBeenCalledWith(bob);
  });

  it('offers Add account and Logout', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /Iron Wolves/ }));

    fireEvent.click(screen.getByRole('menuitem', { name: /Add account/ }));
    expect(onAddAccount).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Iron Wolves/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Logout/ }));
    expect(onLogout).toHaveBeenCalled();
  });

  it('shows no switch targets when the current account is the only saved one', () => {
    renderMenu([alice]);
    fireEvent.click(screen.getByRole('button', { name: /Iron Wolves/ }));
    expect(screen.queryByRole('menuitem', { name: 'Steel Hawks' })).not.toBeInTheDocument();
    // Add account + Logout are still present.
    expect(screen.getByRole('menuitem', { name: /Add account/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Logout/ })).toBeInTheDocument();
  });
});
