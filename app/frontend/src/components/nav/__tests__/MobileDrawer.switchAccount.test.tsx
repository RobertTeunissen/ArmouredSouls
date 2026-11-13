/**
 * MobileDrawer — account-switching wiring in the Settings & Admin section.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The `?react` SVG component import needs the Vite SVGR transform, which the
// test runner does not apply.
vi.mock('../../../assets/icons/close.svg?react', () => ({
  default: () => <svg aria-hidden="true" />,
}));

import { MobileDrawer } from '../MobileDrawer';
import type { SavedAccount } from '../../../utils/savedAccounts';

const alice: SavedAccount = { userId: 1, label: 'Iron Wolves', username: 'alice', token: 't1' };
const bob: SavedAccount = { userId: 2, label: 'Steel Hawks', username: 'bob', token: 't2' };

describe('MobileDrawer account switching', () => {
  const onSwitchAccount = vi.fn();
  const onAddAccount = vi.fn();
  const onLogout = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  function renderDrawer(saved: SavedAccount[]) {
    return render(
      <MemoryRouter>
        <MobileDrawer
          isOpen
          onClose={vi.fn()}
          isActive={() => false}
          userRobots={[]}
          isAdmin={false}
          onLogout={onLogout}
          userId={1}
          currentUserId={1}
          savedAccounts={saved}
          onSwitchAccount={onSwitchAccount}
          onAddAccount={onAddAccount}
        />
      </MemoryRouter>,
    );
  }

  it('lists other saved accounts and triggers a switch', () => {
    renderDrawer([alice, bob]);
    const switchBtn = screen.getByRole('button', { name: /Switch to Steel Hawks/ });
    fireEvent.click(switchBtn);
    expect(onSwitchAccount).toHaveBeenCalledWith(bob);
    // The current account is not offered as a switch target.
    expect(screen.queryByRole('button', { name: /Switch to Iron Wolves/ })).not.toBeInTheDocument();
  });

  it('offers Add account', () => {
    renderDrawer([alice]);
    fireEvent.click(screen.getByRole('button', { name: /Add account/ }));
    expect(onAddAccount).toHaveBeenCalled();
  });

  it('always offers Logout', () => {
    renderDrawer([alice]);
    fireEvent.click(screen.getByRole('button', { name: /^Logout$/ }));
    expect(onLogout).toHaveBeenCalled();
  });
});
