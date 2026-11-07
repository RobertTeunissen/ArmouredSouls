/**
 * #572 attribute explanations, ported from the old AttributeUpgradeRow test:
 * hover, focus and Escape behave the same in the Workshop's Build table.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttributeInfo } from '../AttributeInfo';
import { ROBOT_ATTRIBUTE_DESCRIPTIONS } from '../../../utils/robotAttributeDescriptions';

const description = ROBOT_ATTRIBUTE_DESCRIPTIONS.combatPower;

function renderInfo(withDescription = true): void {
  render(
    <AttributeInfo ariaLabel="Combat Power, level 10 of 15" description={withDescription ? description : undefined}>
      <span>💥</span>
      <span>Combat Power</span>
    </AttributeInfo>,
  );
}

describe('AttributeInfo', () => {
  it('describes the attribute on hover', async () => {
    const user = userEvent.setup();
    renderInfo();
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(tooltip).toHaveAttribute('data-state', 'closed');
    await user.hover(screen.getByText('Combat Power'));
    expect(tooltip).toHaveAttribute('data-state', 'open');
    expect(tooltip).toHaveTextContent(description);
  });

  it('is reachable by keyboard and linked to the description', async () => {
    const user = userEvent.setup();
    renderInfo();
    await user.tab();
    const trigger = screen.getByRole('group', { name: 'Combat Power, level 10 of 15' });
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'open');
    expect(trigger).toHaveAccessibleDescription(description);
  });

  it('Escape dismisses a hover tooltip without moving focus, until the pointer leaves', async () => {
    const user = userEvent.setup();
    renderInfo();
    const label = screen.getByText('Combat Power');
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    await user.hover(label);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tooltip).toHaveAttribute('data-state', 'closed');
    await user.unhover(label);
    await user.hover(label);
    expect(tooltip).toHaveAttribute('data-state', 'open');
  });

  it('every attribute has a non-empty description', () => {
    for (const text of Object.values(ROBOT_ATTRIBUTE_DESCRIPTIONS)) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
    expect(Object.keys(ROBOT_ATTRIBUTE_DESCRIPTIONS)).toHaveLength(23);
  });

  it('renders a plain block when there is no description', () => {
    renderInfo(false);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });
});
