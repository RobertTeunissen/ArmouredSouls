import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TeamAssignmentStep from '../TeamAssignmentStep';

const mocks = vi.hoisted(() => ({
  robots: [] as Array<{ id: number; name: string }>,
  fetchRobots: vi.fn(),
  getMyTeamBattles: vi.fn(),
  registerTeamBattle: vi.fn(),
}));
vi.mock('../../../../stores', () => ({
  useRobotStore: (selector: (s: { robots: typeof mocks.robots; fetchRobots: typeof mocks.fetchRobots }) => unknown) =>
    selector({ robots: mocks.robots, fetchRobots: mocks.fetchRobots }),
}));
vi.mock('../../../../utils/teamBattleApi', () => ({
  getMyTeamBattles: mocks.getMyTeamBattles,
  registerTeamBattle: mocks.registerTeamBattle,
}));

const ROBOTS = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Bravo' }, { id: 3, name: 'Charlie' }];

function renderStep(onComplete = vi.fn()) {
  render(
    <MemoryRouter>
      <TeamAssignmentStep robotId={3} loadoutType="single" onComplete={onComplete} onSkip={vi.fn()} />
    </MemoryRouter>,
  );
  return onComplete;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.robots = ROBOTS;
  mocks.fetchRobots.mockResolvedValue(undefined);
  mocks.getMyTeamBattles.mockResolvedValue([]);
  mocks.registerTeamBattle.mockResolvedValue({ id: 10 });
});

describe('TeamAssignmentStep', () => {
  it('creates a 2v2 team with the teammate the player picks', async () => {
    const user = userEvent.setup();
    const onComplete = renderStep();

    await user.type(screen.getByLabelText('Team name'), 'Iron Pair');
    await user.selectOptions(screen.getByLabelText('Teammate 1'), 'Bravo');
    await user.click(screen.getByRole('button', { name: 'Create 2v2 team' }));

    expect(mocks.registerTeamBattle).toHaveBeenCalledWith([3, 2], 'Iron Pair', 2);
    expect(onComplete).toHaveBeenCalled();
  });

  it('offers 3v3 with two different teammates', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole('button', { name: '3v3', exact: true }));
    expect(screen.getByRole('button', { name: '3v3', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText('Team name'), 'Trio');
    await user.click(screen.getByRole('button', { name: 'Create 3v3 team' }));

    expect(mocks.registerTeamBattle).toHaveBeenCalledWith([3, 1, 2], 'Trio', 3);
  });

  it('needs a name of at least three characters (the API rejects shorter)', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.type(screen.getByLabelText('Team name'), 'AB');
    expect(screen.getByRole('button', { name: 'Create 2v2 team' })).toBeDisabled();
  });

  it('disables 3v3 when the stable has only two robots', () => {
    mocks.robots = ROBOTS.slice(1);
    renderStep();
    expect(screen.getByRole('button', { name: '3v3', exact: true })).toBeDisabled();
  });
});
