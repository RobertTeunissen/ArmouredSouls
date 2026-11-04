import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AchievementReward, { TROPHY_EXPLANATION } from '../AchievementReward';

describe('AchievementReward', () => {
  it('shows credits and prestige for a normal listing', () => {
    render(<AchievementReward rewardCredits={50000} rewardPrestige={50} variant="listing" />);
    expect(screen.getByText(`₡${(50000).toLocaleString()} + 50 prestige`)).toBeInTheDocument();
    expect(screen.queryByTestId('trophy-chip')).not.toBeInTheDocument();
  });

  it('shows a gained reward with a plus sign', () => {
    render(<AchievementReward rewardCredits={25000} rewardPrestige={25} variant="gain" />);
    expect(screen.getByText(`+₡${(25000).toLocaleString()} +25 prestige`)).toBeInTheDocument();
  });

  it('marks a Trophy and never shows a ₡0 reward', () => {
    render(<AchievementReward rewardCredits={0} rewardPrestige={0} trophy variant="gain" />);
    expect(screen.getByTestId('trophy-chip')).toHaveTextContent('Trophy');
    expect(screen.getByText(TROPHY_EXPLANATION)).toBeInTheDocument();
    expect(screen.queryByText(/₡0/)).not.toBeInTheDocument();
  });
});
