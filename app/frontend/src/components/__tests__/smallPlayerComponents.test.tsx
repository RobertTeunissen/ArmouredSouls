/**
 * Small player components that had no tests: the achievement toast, the KotH /
 * Grand Melee match card, the battle-detail robot selector and the pruned
 * playback notice.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AchievementToast from '../AchievementToast';
import KothMatchCard from '../match-cards/KothMatchCard';
import { RobotSelector } from '../battle-detail/RobotSelector';
import { PlaybackUnavailableNotice } from '../battle-detail/PlaybackUnavailableNotice';
import type { UnlockedAchievement } from '../../utils/achievementUtils';
import type { ScheduledMatch } from '../../utils/matchmakingApi';
import type { BattleLogParticipant } from '@shared/types';

afterEach(() => {
  vi.useRealTimers();
});

const ACHIEVEMENT: UnlockedAchievement = {
  id: 'C1', name: 'First Blood', description: 'Win your first battle', tier: 'easy',
  rewardCredits: 5000, rewardPrestige: 10, badgeIconFile: 'c1.png', robotId: null, robotName: null,
};

describe('AchievementToast', () => {
  it('announces the achievement and links to the achievements page', () => {
    render(<MemoryRouter><AchievementToast achievement={ACHIEVEMENT} onDismiss={vi.fn()} /></MemoryRouter>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('First Blood');
    expect(alert).toHaveTextContent('Win your first battle');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/achievements');
  });

  it('dismisses itself after five seconds and the slide-out', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<MemoryRouter><AchievementToast achievement={ACHIEVEMENT} onDismiss={onDismiss} /></MemoryRouter>);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

function kothMatch(overrides: Partial<ScheduledMatch> = {}): ScheduledMatch {
  return {
    id: 1, matchType: 'koth', scheduledFor: '2026-11-10T20:00:00.000Z',
    kothParticipants: [
      { id: 11, name: 'Alpha', elo: 1200, userId: 1 },
      { id: 12, name: 'Bravo', elo: 1210, userId: 2 },
      { id: 13, name: 'Gamma', elo: 1190, userId: 2 },
    ],
    ...overrides,
  } as unknown as ScheduledMatch;
}

describe('KothMatchCard', () => {
  it('shows the mode and the viewer\'s robot with the field size', () => {
    render(<KothMatchCard match={kothMatch()} myUserId={1} />);
    expect(screen.getAllByText('King of the Hill').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('• 3 robots').length).toBeGreaterThan(0);
  });

  it('follows the robot whose page it is on, and labels Grand Melee', () => {
    render(<KothMatchCard match={kothMatch({ matchType: 'grand_melee', kothParticipantCount: 12 })} myUserId={2} perspectiveRobotId={13} />);
    expect(screen.getAllByText('Grand Melee').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gamma').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument();
    expect(screen.getAllByText('• 12 robots').length).toBeGreaterThan(0);
  });

  it('shows only the field size when the viewer has no robot in it', () => {
    render(<KothMatchCard match={kothMatch()} myUserId={99} />);
    expect(screen.getAllByText('3 robots').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });
});

function participant(robotId: number, robotName: string): BattleLogParticipant {
  return { robotId, robotName } as BattleLogParticipant;
}

describe('RobotSelector', () => {
  it('renders nothing for a single robot', () => {
    const { container } = render(<RobotSelector participants={[participant(1, 'Alpha')]} selectedIndex={0} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the selected robot, shortens long names and reports a pick', () => {
    const onSelect = vi.fn();
    render(
      <RobotSelector
        participants={[participant(1, 'Alpha'), participant(2, 'Extraordinarily Long Name')]}
        selectedIndex={0}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    const long = screen.getByRole('button', { name: 'Extraordinarily…' });
    expect(long).toHaveAttribute('aria-pressed', 'false');
    expect(long).toHaveAttribute('title', 'Extraordinarily Long Name');

    fireEvent.click(long);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('PlaybackUnavailableNotice', () => {
  it('explains that the replay expired but the overview stays', () => {
    render(<PlaybackUnavailableNotice />);
    expect(screen.getByText(/available for 7 days after the battle/)).toBeInTheDocument();
  });
});
