import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RobotImageSelector from '../RobotImageSelector';
import { api } from '../../utils/api';

/**
 * Reachability of the Image_Library (Spec #45 R30).
 *
 * The library component and its /api/images endpoints existed but were mounted
 * nowhere, so a player had no way to reach their uploads. These assert the
 * library is reachable through the robot image selector and that selecting a
 * retained image applies it — the whole point of R30.9's reuse flow.
 */

vi.mock('../../utils/api', () => ({
  api: { get: vi.fn(), delete: vi.fn(), post: vi.fn() },
}));

const retainedImage = {
  path: '/uploads/user-robots/42/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp',
  uploadedAt: '2026-05-01T00:00:00.000Z',
  currentRobotCount: 0,
  archivedSeasonCount: 1,
};

function renderSelector(onSelect = vi.fn()): { onSelect: ReturnType<typeof vi.fn> } {
  render(
    <RobotImageSelector
      isOpen
      currentImageUrl={null}
      onSelect={onSelect}
      onClose={vi.fn()}
      robotId={7}
    />,
  );
  return { onSelect };
}

describe('RobotImageSelector — My Images tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({
      images: [retainedImage],
      retained: 1,
      limit: 20,
    });
  });

  it('should offer a My Images tab so uploads are reachable', () => {
    renderSelector();
    // Only rendered when robotId is set (upload/library require a robot).
    expect(screen.getByRole('tab', { name: /my images/i })).toBeInTheDocument();
  });

  it('should list the player\u2019s retained uploads when the tab is opened', async () => {
    renderSelector();

    fireEvent.click(screen.getByRole('tab', { name: /my images/i }));

    await waitFor(() => {
      expect(screen.getByTestId('image-library')).toBeInTheDocument();
    });
    // It reads from the images endpoint, scoped to the signed-in user server-side.
    expect(api.get).toHaveBeenCalledWith('/api/images');
    expect(screen.getByText(/1 of 20 saved/i)).toBeInTheDocument();
  });

  it('should apply a retained image to the robot when selected', async () => {
    const { onSelect } = renderSelector();

    fireEvent.click(screen.getByRole('tab', { name: /my images/i }));
    await waitFor(() => expect(screen.getByTestId('image-library')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /use this/i }));

    // Selecting applies immediately, passing the retained path back to the caller
    // that persists the robot's appearance.
    expect(onSelect).toHaveBeenCalledWith(retainedImage.path);
  });

  it('should surface the retained-image count against the cap', async () => {
    vi.mocked(api.get).mockResolvedValue({
      images: Array.from({ length: 20 }, (_, i) => ({
        ...retainedImage,
        path: `/uploads/user-robots/42/img-${i}.webp`,
      })),
      retained: 20,
      limit: 20,
    });
    renderSelector();

    fireEvent.click(screen.getByRole('tab', { name: /my images/i }));

    await waitFor(() => {
      expect(screen.getByText(/20 of 20 saved/i)).toBeInTheDocument();
    });
    // At the cap, the library tells the player to delete before uploading.
    expect(screen.getByText(/delete one before uploading/i)).toBeInTheDocument();
  });
});
