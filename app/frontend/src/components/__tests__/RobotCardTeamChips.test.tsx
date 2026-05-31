import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamMembershipChips from '../TeamMembershipChips';

/**
 * Tests for TeamMembershipChips on robot cards — specifically the scenario
 * where a robot is in all 3 team types (Tag Team handled separately via EventBadge,
 * but 2v2 and 3v3 are shown via TeamMembershipChips).
 *
 * Requirements: R9.2, R9.16
 */
describe('RobotCard - Team Membership Chips (all team types)', () => {
  it('should render chips for robot in both 2v2 and 3v3 teams simultaneously', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Iron Duo' } },
      { id: 2, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Steel Triad' } },
    ];
    render(<TeamMembershipChips memberships={memberships} />);

    expect(screen.getByText('2v2 League')).toBeInTheDocument();
    expect(screen.getByText('3v3 League')).toBeInTheDocument();
  });

  it('should render exactly 2 chips when robot is in both 2v2 and 3v3 (one per size)', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Iron Duo' } },
      { id: 2, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Steel Triad' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);

    const chips = container.querySelectorAll('span');
    expect(chips).toHaveLength(2);
  });

  it('should render chips with correct colors for each team type', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Iron Duo' } },
      { id: 2, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Steel Triad' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);

    const chips = container.querySelectorAll('span');
    // 2v2 chip should be cyan
    expect(chips[0].className).toContain('bg-cyan-500/15');
    expect(chips[0].className).toContain('text-cyan-300');
    // 3v3 chip should be teal
    expect(chips[1].className).toContain('bg-teal-500/15');
    expect(chips[1].className).toContain('text-teal-300');
  });

  it('should deduplicate when robot is on multiple teams of same size', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Team A' } },
      { id: 2, teamId: 11, team: { id: 11, teamSize: 2, teamName: 'Team B' } },
      { id: 3, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Team C' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);

    // Should only show 2 chips (one per unique size), not 3
    const chips = container.querySelectorAll('span');
    expect(chips).toHaveLength(2);
    expect(screen.getByText('2v2 League')).toBeInTheDocument();
    expect(screen.getByText('3v3 League')).toBeInTheDocument();
  });

  it('should render chips as inline-flex with rounded-full for pill appearance', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Iron Duo' } },
      { id: 2, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Steel Triad' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);

    const chips = container.querySelectorAll('span');
    chips.forEach((chip) => {
      expect(chip.className).toContain('inline-flex');
      expect(chip.className).toContain('rounded-full');
    });
  });

  it('should have touch-friendly sizing (text-xs with px-2 py-0.5 padding)', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Iron Duo' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);

    const chip = container.querySelector('span');
    expect(chip?.className).toContain('text-xs');
    expect(chip?.className).toContain('px-2');
  });

  it('should wrap chips in a flex container with gap for mobile layout', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Iron Duo' } },
      { id: 2, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Steel Triad' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);

    // The wrapper div should use flex-wrap to prevent overflow on mobile
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('flex-wrap');
    expect(wrapper.className).toContain('gap-1.5');
  });

  it('should render nothing when robot has no team memberships', () => {
    const { container } = render(<TeamMembershipChips memberships={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when memberships prop is undefined', () => {
    const { container } = render(<TeamMembershipChips />);
    expect(container.firstChild).toBeNull();
  });
});
