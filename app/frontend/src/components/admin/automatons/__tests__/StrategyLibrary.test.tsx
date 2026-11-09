import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { StrategyLibrary } from '../StrategyLibrary';
import type { BuildOrderDescriptor, DraftSummary, LibraryStrategy } from '../../../../utils/automatonAdminApi';

const BUILD_ORDER: BuildOrderDescriptor[] = [
  { position: 1, goalId: 'g1', type: 'robots', label: 'Robots', defaultTarget: 2, bounds: { min: 1, max: 3 }, isMax: false, buys: 'A second robot' },
  { position: 2, goalId: 'g2', type: 'facility', facilityType: 'booking_office', label: 'Booking Office', defaultTarget: 3, bounds: { min: 0, max: 6 }, isMax: false, buys: 'More event entries' },
];

const SWARM: LibraryStrategy = {
  key: 'swarm', displayName: 'Swarm', description: 'Many cheap robots', latestVersion: 2, profileCount: 5,
  versions: [
    { version: 1, displayName: 'Swarm', description: '', latest: false, profileCount: 3, buildOrder: [] },
    { version: 2, displayName: 'Swarm', description: '', latest: true, profileCount: 2, buildOrder: BUILD_ORDER },
  ],
};
const FORTRESS: LibraryStrategy = {
  key: 'fortress', displayName: 'Fortress', description: 'One tank', latestVersion: 1, profileCount: 1,
  versions: [{ version: 1, displayName: 'Fortress', description: '', latest: true, profileCount: 1, buildOrder: [] }],
};

function draft(overrides: Partial<DraftSummary>): DraftSummary {
  return {
    id: 1, key: 'swarm', version: 3, basedOn: 'swarm.v2', displayName: 'Swarm', goalCount: 4, errorCount: 0, ready: true,
    createdBy: 1, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...overrides,
  };
}

type Props = ComponentProps<typeof StrategyLibrary>;

function renderLibrary(props: Partial<Props> = {}) {
  const handlers = {
    onNewStrategy: vi.fn().mockResolvedValue(undefined),
    onNewVersion: vi.fn().mockResolvedValue(undefined),
    onUpgrade: vi.fn(),
    onOpenDraft: vi.fn(),
  };
  render(<StrategyLibrary strategies={[SWARM, FORTRESS]} drafts={[]} error={null} {...handlers} {...props} />);
  return handlers;
}

const card = (name: RegExp): HTMLElement => screen.getByRole('heading', { name }).closest('section') as HTMLElement;

describe('StrategyLibrary', () => {
  it('shows loading states before the library and drafts arrive', () => {
    renderLibrary({ strategies: null, drafts: null });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('lists each strategy with its versions, newest first, and stables per version', () => {
    renderLibrary();
    const swarm = within(card(/Swarm · v2/));
    const versions = swarm.getAllByRole('listitem').map((li) => li.textContent);
    expect(versions).toEqual(['v2 (latest)2 stables on v2', 'v13 stables on v1']);
  });

  it('offers Upgrade stables only when stables sit on an older version', () => {
    renderLibrary();
    expect(within(card(/Swarm · v2/)).getByRole('button', { name: 'Upgrade stables' })).toBeInTheDocument();
    expect(within(card(/Fortress · v1/)).queryByRole('button', { name: 'Upgrade stables' })).not.toBeInTheDocument();
  });

  it('shows the latest version\'s build order on request', () => {
    renderLibrary();
    const swarm = within(card(/Swarm · v2/));
    const toggle = swarm.getByRole('button', { name: '▸ Show build order' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);

    expect(swarm.getByRole('button', { name: '▾ Hide build order' })).toHaveAttribute('aria-expanded', 'true');
    const rows = swarm.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => c.textContent));
    expect(rows).toEqual([
      ['1', 'Robots', '2', 'Allowed 1–3', 'A second robot'],
      ['2', 'Booking Office', 'L3', 'Allowed L0–L6', 'More event entries'],
    ]);
  });

  it('starts a new version and shows its failure', async () => {
    const onNewVersion = vi.fn().mockRejectedValue(new Error('A draft for swarm v3 already exists'));
    const { onUpgrade } = renderLibrary({ onNewVersion });
    fireEvent.click(within(card(/Swarm · v2/)).getByRole('button', { name: 'New version' }));
    expect(await screen.findByText('A draft for swarm v3 already exists')).toBeInTheDocument();
    expect(onNewVersion).toHaveBeenCalledWith(SWARM);

    fireEvent.click(within(card(/Swarm · v2/)).getByRole('button', { name: 'Upgrade stables' }));
    expect(onUpgrade).toHaveBeenCalledWith(SWARM);
  });

  it('lists drafts with their state and opens one', () => {
    const { onOpenDraft } = renderLibrary({
      drafts: [draft({ id: 4 }), draft({ id: 5, key: 'blitz', displayName: '', basedOn: null, version: 1, ready: false, errorCount: 2 })],
    });
    expect(screen.getByText('ready to export')).toBeInTheDocument();
    expect(screen.getByText('· from v2')).toBeInTheDocument();
    expect(screen.getByText('2 errors')).toBeInTheDocument();
    expect(screen.getByText('· new strategy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'blitz v1' }));
    expect(onOpenDraft).toHaveBeenCalledWith(5);
  });

  it('creates a blank strategy from the dialog', async () => {
    const { onNewStrategy } = renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'New strategy' }));
    const dialog = within(screen.getByRole('dialog', { name: 'New strategy (blank)' }));
    const submit = dialog.getByRole('button', { name: 'New strategy' });
    expect(submit).toBeDisabled();

    fireEvent.change(dialog.getByLabelText(/Strategy key/), { target: { value: 'blitz' } });
    fireEvent.change(dialog.getByLabelText(/Display name/), { target: { value: 'Blitz' } });
    fireEvent.click(submit);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onNewStrategy).toHaveBeenCalledWith({ key: 'blitz', displayName: 'Blitz' });
  });

  it('keeps the dialog open with the error when creating fails', async () => {
    renderLibrary({ onNewStrategy: vi.fn().mockRejectedValue(new Error('Key already in use')) });
    fireEvent.click(screen.getByRole('button', { name: 'New strategy' }));
    const dialog = within(screen.getByRole('dialog', { name: 'New strategy (blank)' }));
    fireEvent.change(dialog.getByLabelText(/Strategy key/), { target: { value: 'swarm' } });
    fireEvent.click(dialog.getByRole('button', { name: 'New strategy' }));

    expect(await dialog.findByText('Key already in use')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
