import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RobotImageSelector from '../RobotImageSelector';
import { api } from '../../utils/api';

vi.mock('../../utils/api', () => ({
  api: { get: vi.fn(), delete: vi.fn(), post: vi.fn() },
}));

function renderSelector(): void {
  render(
    <RobotImageSelector
      isOpen
      currentImageUrl={null}
      onSelect={vi.fn()}
      onClose={vi.fn()}
      robotId={7}
    />,
  );
}

describe('RobotImageSelector — moderation availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should withhold the custom upload control when moderation is unavailable', async () => {
    vi.mocked(api.get).mockResolvedValue({
      status: 'unavailable',
      changedAt: '2026-09-06T00:00:00.000Z',
    });

    renderSelector();
    fireEvent.click(screen.getByRole('tab', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Custom image uploads are temporarily unavailable. Please try again later.',
      );
    });
    expect(screen.queryByLabelText('Choose File')).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/robots/image-moderation-status');
  });

  it('should offer the custom upload control when moderation is ready', async () => {
    vi.mocked(api.get).mockResolvedValue({
      status: 'ready',
      changedAt: '2026-09-06T00:00:00.000Z',
    });

    renderSelector();
    fireEvent.click(screen.getByRole('tab', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Choose File')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
