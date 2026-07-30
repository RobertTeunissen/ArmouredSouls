/**
 * Unit tests for SeasonControlPage (Admin_Season_Portal, Spec #45).
 *
 * Covers: state renders after load, preview loads on demand, the rollover
 * confirmation modal gates the destructive action behind the exact phrase,
 * and the phase-adjustment helpers call their endpoints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeasonControlPage from '../SeasonControlPage';
import type { AdminSeasonState, RolloverPreview, RolloverResult } from '../../../utils/seasonApi';

// ----------------------------------------------------------------
// Mock the season API module
// ----------------------------------------------------------------
const mockGetState = vi.fn();
const mockGetPreview = vi.fn();
const mockExecuteRollover = vi.fn();
const mockExtend = vi.fn();
const mockSetPrep = vi.fn();

vi.mock('../../../utils/seasonApi', () => ({
  getAdminSeasonState: () => mockGetState(),
  getRolloverPreview: () => mockGetPreview(),
  executeRollover: (n: number) => mockExecuteRollover(n),
  extendSeason: (n: number) => mockExtend(n),
  setPreparationCycles: (n: number) => mockSetPrep(n),
}));

const legacyState: AdminSeasonState = {
  seasonNumber: 0,
  phase: 'competitive',
  seasonCycle: 118,
  seasonLengthCycles: 100,
  remainingCompetitiveCycles: 0,
  preparationDay: 0,
  remainingPreparationCycles: 0,
  isLegacy: true,
  rolloverInProgress: false,
  balanceChangesAppropriate: false,
  config: {
    seasonLengthCycles: 100,
    preparationLengthCycles: 2,
    countdownCycles: 5,
    accoladeDepth: 3,
    retainedImagesPerStable: 20,
  },
};

const preview: RolloverPreview = {
  humanStables: 4,
  humanRobots: 12,
  generatedStables: 2000,
  generatedRobots: 6000,
  rowsToPurge: { battles: 5000, standings: 800 },
  imagesRetained: 30,
  imagesDeleted: 0,
};

const result: RolloverResult = {
  completedSeasonNumber: 0,
  newSeasonNumber: 1,
  stablesArchived: 4,
  robotsArchived: 12,
  snapshotRows: 100,
  accoladeRows: 20,
  generatedStablesDeleted: 2000,
  totalRowsPurged: 5800,
  durations: { archiveMs: 1000, purgeMs: 2000, postMs: 500, totalMs: 3500 },
};

describe('SeasonControlPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockResolvedValue(legacyState);
    mockGetPreview.mockResolvedValue(preview);
    mockExecuteRollover.mockResolvedValue(result);
    mockExtend.mockResolvedValue({ ...legacyState });
    mockSetPrep.mockResolvedValue({ ...legacyState });
  });

  it('should render the page header', async () => {
    render(<SeasonControlPage />);
    expect(screen.getByText('Season Control')).toBeInTheDocument();
    await waitFor(() => expect(mockGetState).toHaveBeenCalled());
  });

  it('should render current season state after load', async () => {
    render(<SeasonControlPage />);
    await waitFor(() => expect(screen.getByText('0 (Legacy)')).toBeInTheDocument());
    expect(screen.getByText('Competitive')).toBeInTheDocument();
  });

  it('should load a rollover preview on demand', async () => {
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await waitFor(() => expect(screen.getByText('0 (Legacy)')).toBeInTheDocument());

    await user.click(screen.getByText(/Preview Rollover/));

    await waitFor(() => expect(screen.getByText('Rollover Preview')).toBeInTheDocument());
    expect(mockGetPreview).toHaveBeenCalled();
    expect(screen.getByText('Human Stables')).toBeInTheDocument();
  });

  it('should gate the rollover behind the exact confirmation phrase', async () => {
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await waitFor(() => expect(screen.getByText('0 (Legacy)')).toBeInTheDocument());

    await user.click(screen.getByText(/Trigger Rollover/));

    const modal = screen.getByText('Confirm Season Rollover').closest('div')!;
    const confirmButton = within(modal).getByText('Confirm Rollover');
    expect(confirmButton).toBeDisabled();

    // Wrong phrase keeps it disabled
    const input = screen.getByLabelText('Confirmation phrase');
    await user.type(input, 'nope');
    expect(confirmButton).toBeDisabled();

    // Exact phrase enables it
    await user.clear(input);
    await user.type(input, 'CONFIRM_ROLLOVER');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    await waitFor(() => expect(mockExecuteRollover).toHaveBeenCalledWith(0));
  });

  it('should show the rollover result after a successful rollover', async () => {
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await waitFor(() => expect(screen.getByText('0 (Legacy)')).toBeInTheDocument());

    await user.click(screen.getByText(/Trigger Rollover/));
    await user.type(screen.getByLabelText('Confirmation phrase'), 'CONFIRM_ROLLOVER');
    await user.click(screen.getByText('Confirm Rollover'));

    await waitFor(() => expect(screen.getByText('Last Rollover Result')).toBeInTheDocument());
  });

  it('should extend the competitive phase', async () => {
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await waitFor(() => expect(screen.getByText('0 (Legacy)')).toBeInTheDocument());

    await user.click(screen.getByText('Extend'));
    await waitFor(() => expect(mockExtend).toHaveBeenCalledWith(1));
  });

  it('should set remaining preparation cycles', async () => {
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await waitFor(() => expect(screen.getByText('0 (Legacy)')).toBeInTheDocument());

    await user.click(screen.getByText('Set'));
    await waitFor(() => expect(mockSetPrep).toHaveBeenCalledWith(2));
  });

  it('should disable the trigger button while a rollover is in progress', async () => {
    mockGetState.mockResolvedValue({ ...legacyState, rolloverInProgress: true });
    render(<SeasonControlPage />);
    await waitFor(() => expect(screen.getByText('0 (Legacy)')).toBeInTheDocument());

    expect(screen.getByText(/Trigger Rollover/)).toBeDisabled();
  });
});
