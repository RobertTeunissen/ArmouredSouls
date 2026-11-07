/**
 * Public robot profile (#504): header, per-mode season cards, achievements,
 * owner-only Workshop link and the redirect of old owner-tab links. Replaces
 * the RobotDetail* page tests of the tabbed page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const detail = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const profile = vi.hoisted(() => ({ value: { profile: null as unknown, failed: false } }));

vi.mock('../../hooks/useRobotDetail', () => ({ useRobotDetail: () => detail.value }));
vi.mock('../../components/robot-profile/useRobotProfile', () => ({ useRobotProfile: () => profile.value }));
vi.mock('../../components/robot-profile/FormSection', () => ({ FormSection: () => <div data-testid="form-section" /> }));
vi.mock('../../components/robot-profile/HistorySection', () => ({ HistorySection: () => <div data-testid="history-section" /> }));
vi.mock('../../components/RobotImage', () => ({ default: () => <div data-testid="robot-image" /> }));

import RobotProfilePage from '../RobotProfilePage';

const robot = {
  id: 5, name: 'Gobbelientje', userId: 203, imageUrl: null, elo: 1922, fame: 13376, kills: 263, totalBattles: 328,
  createdAt: '2026-07-31T11:56:02.738Z',
  user: { username: 'LortGob', stableName: 'LortGob Industries', stableType: 'automaton' },
};

const standing = (o: Record<string, unknown>) => ({
  wins: 0, losses: 0, draws: 0, totalMatches: null, teamName: null, teamId: null, ...o,
});

const PROFILE = {
  standings: [
    standing({ mode: 'league_1v1', tier: 'champion', leaguePoints: 142, wins: 57, losses: 35, draws: 3, leagueInstanceId: 'champion_1', rank: 5, instanceSize: 30 }),
    standing({ mode: 'league_3v3', tier: 'diamond', leaguePoints: 212, wins: 77, losses: 19, teamName: 'LortGob Industries 3v3', teamId: 9, leagueInstanceId: 'diamond_1', rank: 3, instanceSize: 40 }),
    standing({ mode: 'koth', tier: 'champion', leaguePoints: 460, wins: 27, totalMatches: 95, leagueInstanceId: 'champion_2', rank: 3, instanceSize: 78 }),
  ],
  form: [],
  achievements: Array.from({ length: 8 }, (_, i) => ({ id: `A${i}`, name: `Badge ${i}`, tier: 'hard', badgeIconFile: `achievement-a${i}`, unlockedAt: '2026-10-01T00:00:00Z', holders: i })),
  accolades: [{ seasonNumber: 0, category: 'kothLongestWinStreak', rank: 7, value: 0, valueLabel: 'consecutive wins', mode: 'koth' }],
};

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/robots/:id" element={<RobotProfilePage />} />
        <Route path="/robots/:id/prepare" element={<div data-testid="workshop" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  detail.value = { robot, loading: false, isOwner: false, allModesBattleCount: 531, battleReadiness: undefined };
  profile.value = { profile: PROFILE, failed: false };
});

describe('RobotProfilePage', () => {
  it('shows the owner with the Automaton badge, the highest tier and all-modes battles', () => {
    renderAt('/robots/5');
    const header = screen.getByRole('heading', { name: 'Gobbelientje' }).closest('section') as HTMLElement;
    expect(within(header).getByRole('link', { name: 'LortGob Industries' })).toHaveAttribute('href', '/stables/203');
    expect(within(header).getByTestId('automaton-badge')).toBeInTheDocument();
    expect(within(header).getByText(/fighting since July 2026/)).toBeInTheDocument();
    expect(within(header).getByText('Champion ×2')).toBeInTheDocument();
    expect(within(header).getByText('531')).toBeInTheDocument();
    expect(within(header).getByText(/#7 KotH Longest Win Streak|#7 Longest Win Streak/)).toBeInTheDocument();
  });

  it('has one card per mode played, with rank in the league, team standings and first places', () => {
    renderAt('/robots/5');
    const solo = screen.getByTestId('mode-card-league_1v1');
    expect(solo).toHaveTextContent('#5 of 30');
    expect(solo).toHaveTextContent('in Champion 1');
    expect(solo).toHaveTextContent('60%');
    const team = screen.getByTestId('mode-card-league_3v3');
    expect(team).toHaveTextContent('LortGob Industries 3v3');
    expect(team).toHaveTextContent('#3 of 40 teams');
    expect(team).toHaveTextContent('in Diamond 1');
    expect(screen.getByTestId('mode-card-koth')).toHaveTextContent('27 first places in 95');
    expect(screen.getByText(/not entered: League 2v2, Tag Team, Grand Melee/)).toBeInTheDocument();
  });

  it('shows six achievements and the rest behind "+N more"', () => {
    renderAt('/robots/5');
    const section = screen.getByRole('heading', { name: 'Achievements' }).closest('section') as HTMLElement;
    expect(within(section).getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(within(section).getByRole('button', { name: '+2 more' }));
    expect(within(section).getAllByRole('listitem')).toHaveLength(8);
  });

  it('shows no attributes, tuning or configuration to visitors and no Workshop link', () => {
    renderAt('/robots/5');
    expect(screen.queryByText(/Combat Power|Tuning|Stance|Yield/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Workshop/ })).toBeNull();
  });

  it('gives the owner a Workshop link', () => {
    detail.value = { ...detail.value, isOwner: true };
    renderAt('/robots/5');
    expect(screen.getByRole('link', { name: 'Workshop →' })).toHaveAttribute('href', '/robots/5/prepare');
  });

  it('sends the owner from an old owner-tab link to the Workshop', () => {
    detail.value = { ...detail.value, isOwner: true };
    renderAt('/robots/5?tab=upgrades');
    expect(screen.getByTestId('workshop')).toBeInTheDocument();
  });

  it('keeps a visitor on the profile for an old owner-tab link', () => {
    renderAt('/robots/5?tab=battle-config');
    expect(screen.getByRole('heading', { name: 'Gobbelientje' })).toBeInTheDocument();
  });

  it('says when the season standings could not load', () => {
    profile.value = { profile: null, failed: true };
    renderAt('/robots/5');
    expect(screen.getByRole('alert')).toHaveTextContent("Could not load this season's standings.");
  });
});
