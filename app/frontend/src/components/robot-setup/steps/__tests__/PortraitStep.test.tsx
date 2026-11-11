import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortraitStep from '../PortraitStep';

const mocks = vi.hoisted(() => ({ updateAppearance: vi.fn() }));
vi.mock('../../../../utils/robotApi', () => ({ updateAppearance: mocks.updateAppearance }));
// The real selector calls onSelect and then onClose; the stub does the same.
vi.mock('../../../RobotImageSelector', () => ({
  default: ({ isOpen, onSelect, onClose }: { isOpen: boolean; onSelect: (url: string) => void; onClose: () => void }) =>
    isOpen ? (
      <div>
        <button type="button" onClick={() => { onSelect('/img/robot-1.webp'); onClose(); }}>Pick image</button>
        <button type="button" onClick={onClose}>Close picker</button>
      </div>
    ) : null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateAppearance.mockResolvedValue({});
});

describe('PortraitStep', () => {
  it('saves the picked portrait and advances exactly once', async () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<PortraitStep robotId={4} loadoutType="single" onComplete={onComplete} onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: 'Pick image' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(mocks.updateAppearance).toHaveBeenCalledWith(4, '/img/robot-1.webp');
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('skips when the picker is closed without a pick', async () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<PortraitStep robotId={4} loadoutType="single" onComplete={onComplete} onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: 'Close picker' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('still advances when saving the portrait fails', async () => {
    mocks.updateAppearance.mockRejectedValue(new Error('boom'));
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<PortraitStep robotId={4} loadoutType="single" onComplete={onComplete} onSkip={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Pick image' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });
});
