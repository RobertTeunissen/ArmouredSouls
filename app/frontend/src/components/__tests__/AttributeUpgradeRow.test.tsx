import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttributeUpgradeRow from '../AttributeUpgradeRow';
import { ROBOT_ATTRIBUTE_DESCRIPTIONS } from '../../utils/robotAttributeDescriptions';

/** Attribute explanation tooltips on the Upgrade Planner (#572). */
describe('AttributeUpgradeRow attribute tooltip', () => {
  const baseProps = {
    attributeKey: 'penetration',
    label: 'Penetration',
    icon: '🔪',
    currentLevel: 20,
    plannedLevel: 20,
    cost: 0,
    baseCost: 0,
    cap: 42,
    isAtCap: false,
    hasPlannedChange: false,
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    onMax: vi.fn(),
    compact: true,
  };

  test('links the attribute to its description via a focusable tooltip trigger', () => {
    const description = ROBOT_ATTRIBUTE_DESCRIPTIONS.penetration;
    render(<AttributeUpgradeRow {...baseProps} description={description} />);

    const trigger = screen.getByRole('group', { name: 'Penetration, level 20 of 42' });
    expect(trigger).toHaveAttribute('tabindex', '0');
    expect(trigger).toHaveAccessibleDescription(description);
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(description);
  });

  test('Escape blurs the trigger to dismiss the tooltip', () => {
    render(<AttributeUpgradeRow {...baseProps} description="Some description" />);
    const trigger = screen.getByRole('group', { name: /Penetration/ });
    trigger.focus();
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger).not.toHaveFocus();
  });

  test('renders no tooltip or extra tab stop without a description', () => {
    render(<AttributeUpgradeRow {...baseProps} />);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  test('every attribute has a non-empty description', () => {
    for (const text of Object.values(ROBOT_ATTRIBUTE_DESCRIPTIONS)) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
    expect(Object.keys(ROBOT_ATTRIBUTE_DESCRIPTIONS)).toHaveLength(23);
  });
});
