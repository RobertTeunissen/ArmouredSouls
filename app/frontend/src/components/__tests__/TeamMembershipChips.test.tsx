import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamMembershipChips from '../TeamMembershipChips';

describe('TeamMembershipChips', () => {
  it('should render nothing when memberships is undefined', () => {
    const { container } = render(<TeamMembershipChips />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when memberships is empty', () => {
    const { container } = render(<TeamMembershipChips memberships={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render "2v2 League" chip for teamSize 2', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Alpha Squad' } },
    ];
    render(<TeamMembershipChips memberships={memberships} />);
    expect(screen.getByText('2v2 League')).toBeInTheDocument();
  });

  it('should render "3v3 League" chip for teamSize 3', () => {
    const memberships = [
      { id: 2, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Bravo Team' } },
    ];
    render(<TeamMembershipChips memberships={memberships} />);
    expect(screen.getByText('3v3 League')).toBeInTheDocument();
  });

  it('should render both chips when robot is in both 2v2 and 3v3 teams', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Alpha Squad' } },
      { id: 2, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Bravo Team' } },
    ];
    render(<TeamMembershipChips memberships={memberships} />);
    expect(screen.getByText('2v2 League')).toBeInTheDocument();
    expect(screen.getByText('3v3 League')).toBeInTheDocument();
  });

  it('should deduplicate chips when robot is on multiple teams of same size', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Alpha Squad' } },
      { id: 3, teamId: 30, team: { id: 30, teamSize: 2, teamName: 'Charlie Duo' } },
    ];
    render(<TeamMembershipChips memberships={memberships} />);
    const chips = screen.getAllByText('2v2 League');
    expect(chips).toHaveLength(1);
  });

  it('should apply cyan color classes for 2v2 chip', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Alpha Squad' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);
    const chip = container.querySelector('span');
    expect(chip?.className).toContain('bg-cyan-500/15');
    expect(chip?.className).toContain('text-cyan-300');
    expect(chip?.className).toContain('border-cyan-500/30');
  });

  it('should apply teal color classes for 3v3 chip', () => {
    const memberships = [
      { id: 2, teamId: 20, team: { id: 20, teamSize: 3, teamName: 'Bravo Team' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);
    const chip = container.querySelector('span');
    expect(chip?.className).toContain('bg-teal-500/15');
    expect(chip?.className).toContain('text-teal-300');
    expect(chip?.className).toContain('border-teal-500/30');
  });

  it('should render chips as rounded-full inline-flex elements', () => {
    const memberships = [
      { id: 1, teamId: 10, team: { id: 10, teamSize: 2, teamName: 'Alpha Squad' } },
    ];
    const { container } = render(<TeamMembershipChips memberships={memberships} />);
    const chip = container.querySelector('span');
    expect(chip?.className).toContain('inline-flex');
    expect(chip?.className).toContain('rounded-full');
  });
});
