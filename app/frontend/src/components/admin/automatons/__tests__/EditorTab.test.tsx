import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EditorTab } from '../EditorTab';
import { formFromDetail, nextFreeSlot, savePlan, teamMaxRobots } from '../editorState';
import { teamRows, teamsSummary } from '../teamState';
import { blueprintHeader, refinementStepCosts } from '../blueprintState';
import { LIBRARY, PROFILES, WEAPONS, WEAPON_MAP, blueprint, detail, turnPreview } from './fixtures';

const api = vi.hoisted(() => ({
  getProfile: vi.fn(),
  listTurns: vi.fn(),
  listWeapons: vi.fn(),
  previewTurn: vi.fn(),
  updateBlueprint: vi.fn(),
  addBlueprint: vi.fn(),
  updateStrategy: vi.fn(),
  updateProfile: vi.fn(),
  activateProfile: vi.fn(),
  deleteDraft: vi.fn(),
  deleteBlueprint: vi.fn(),
  uploadBlueprintImage: vi.fn(),
  createDraft: vi.fn(),
  exportCatalogue: vi.fn(),
  downloadJson: vi.fn(),
}));
vi.mock('../../../../utils/automatonAdminApi', () => api);

function renderEditor(key = 'clone-legion') {
  const onSelect = vi.fn();
  const onChanged = vi.fn();
  render(<EditorTab profiles={PROFILES} strategies={LIBRARY} selectedKey={key} onSelect={onSelect} onChanged={onChanged} />);
  return { onSelect, onChanged };
}

describe('editor state helpers', () => {
  it('sizes the Team_Rule by min(highest robots bound, buildable blueprints)', () => {
    const d = detail();
    expect(teamMaxRobots(d.strategy.buildOrder, [1, 2, 3])).toBe(3);
    expect(teamMaxRobots(d.strategy.buildOrder, [1, 3])).toBe(1);
    const rows = teamRows(3, d.teamNames, new Map([[1, 'Rex'], [2, 'Cody']]));
    expect(rows.map((r) => [r.size, r.name, r.formed, r.waitsForSlot])).toEqual([[2, 'Torrent Company', true, 2], [3, 'Bad Batch', false, 3]]);
    expect(teamsSummary(rows)).toBe('Torrent Company: Formed · 1 more wait for robots (next: Bad Batch, robot 3)');
  });

  it('plans the save calls in order with Team_Names on the first call that changes their count', () => {
    const d = detail();
    const form = formFromDetail(d);
    expect(savePlan(d, form, d.strategy.buildOrder)).toEqual([]);
    form.backstory = 'New backstory.';
    form.targets['swarm.v1.01.robots'] = 2;
    form.pending = [{ slot: 4, fields: { ...form.blueprints[1], robotName: 'Echo' } }];
    form.blueprints[2] = { ...form.blueprints[2], stance: 'offensive' };
    const plan = savePlan(d, form, d.strategy.buildOrder);
    expect(plan.map((s) => s.kind)).toEqual(['update_blueprint', 'add_blueprint', 'update_strategy', 'update_profile']);
    expect(plan[3]).toEqual({ kind: 'update_profile', patch: { backstory: 'New backstory.' } });
  });

  it('sizes additions with the pinned strategy and the strategy step with the new one', () => {
    const d = detail();
    const form = formFromDetail(d);
    // New strategy: robots up to 11, so 4 blueprints need 2 + 1 names; the pinned one caps robots at 3 (1 + 1).
    const newRows = d.strategy.buildOrder.map((r) => (r.type === 'robots' ? { ...r, goalId: 'paragon.v1.01.robots', bounds: { min: 1, max: 11 }, defaultTarget: 1, target: 1 } : r));
    form.strategyKey = 'paragon';
    form.targets = { 'paragon.v1.01.robots': 1 };
    form.teamNames = { twoVsTwo: ['Torrent Company', 'Ghost Company'], threeVsThree: ['Bad Batch'] };
    form.pending = [{ slot: 4, fields: { ...form.blueprints[1], robotName: 'Echo' } }];
    const plan = savePlan(d, form, newRows);
    expect(plan.map((s) => s.kind)).toEqual(['add_blueprint', 'update_strategy']);
    expect(plan[0]).toMatchObject({ teamNames: { twoVsTwo: ['Torrent Company'], threeVsThree: ['Bad Batch'] } });
    expect(plan[1]).toMatchObject({ strategyKey: 'paragon', teamNames: { twoVsTwo: ['Torrent Company', 'Ghost Company'], threeVsThree: ['Bad Batch'] } });
  });

  it('switches to a strategy with a lower robots bound before an addition that would need hidden Team_Names', () => {
    const d = detail();
    const form = formFromDetail(d);
    // Pinned strategy: robots up to 3, so 4 blueprints would need 1 + 1 names; the new one caps robots at 2 (1 + 0).
    const newRows = d.strategy.buildOrder.map((r) => (r.type === 'robots' ? { ...r, goalId: 'duo.v1.01.robots', bounds: { min: 1, max: 2 }, defaultTarget: 2, target: 2 } : r));
    form.strategyKey = 'duo';
    form.targets = { 'duo.v1.01.robots': 2 };
    form.teamNames = { twoVsTwo: ['Torrent Company'], threeVsThree: [] };
    form.pending = [{ slot: 4, fields: { ...form.blueprints[1], robotName: 'Echo' } }];
    const plan = savePlan(d, form, newRows);
    expect(plan.map((s) => s.kind)).toEqual(['update_strategy', 'add_blueprint']);
    // Both calls carry only the names the Teams card shows: no '' padding for a 3v3 row it never rendered.
    expect(plan[0]).toMatchObject({ strategyKey: 'duo', teamNames: { twoVsTwo: ['Torrent Company'], threeVsThree: [] } });
    expect(plan[1]).toMatchObject({ slot: 4, teamNames: { twoVsTwo: ['Torrent Company'], threeVsThree: [] } });
  });

  it('keeps additions first when the lower robots bound does not change the Team_Names count', () => {
    const d = detail();
    // Pinned bound 3 vs new bound 2 with one blueprint added to two: both give min(bound, 2) = 2.
    const twoSlots = { ...d, blueprints: d.blueprints.filter((b) => b.slot <= 1) };
    const twoForm = formFromDetail(twoSlots);
    const newRows = d.strategy.buildOrder.map((r) => (r.type === 'robots' ? { ...r, goalId: 'duo.v1.01.robots', bounds: { min: 1, max: 2 }, defaultTarget: 2, target: 2 } : r));
    twoForm.strategyKey = 'duo';
    twoForm.targets = { 'duo.v1.01.robots': 2 };
    twoForm.teamNames = { twoVsTwo: ['Torrent Company'], threeVsThree: [] };
    twoForm.pending = [{ slot: 2, fields: { ...twoForm.blueprints[1], robotName: 'Echo' } }];
    // The new target (2) needs the second blueprint first (R3.7), so the strategy step stays last.
    expect(savePlan(twoSlots, twoForm, newRows).map((s) => s.kind)).toEqual(['add_blueprint', 'update_strategy']);
  });

  it('keeps the strategy step first for a gap-filling addition, so the save fails closed (R3.7)', () => {
    // Slots 1, 2, 4 (buildable 2) under a pinned robots bound of 4; the form switches to a bound and target of 3.
    const base = detail();
    const pinnedRows = base.strategy.buildOrder.map((r) => (r.type === 'robots' ? { ...r, bounds: { min: 1, max: 4 } } : r));
    const gapped = detail({ blueprints: [blueprint(1), blueprint(2), blueprint(4)], strategy: { ...base.strategy, buildOrder: pinnedRows } });
    const form = formFromDetail(gapped);
    const newRows = base.strategy.buildOrder.map((r) => (r.type === 'robots' ? { ...r, goalId: 'duo.v1.01.robots', bounds: { min: 1, max: 3 }, defaultTarget: 3, target: 3 } : r));
    form.strategyKey = 'duo';
    form.targets = { 'duo.v1.01.robots': 3 };
    form.teamNames = { twoVsTwo: ['Torrent Company'], threeVsThree: ['Bad Batch'] };
    form.pending = [{ slot: 3, fields: { ...form.blueprints[1], robotName: 'Echo' } }];
    // Filling slot 3 raises the buildable count from 2 to 4: pinned-sized names would need a hidden second 2v2 name,
    // and the strategy step goes out while buildable is still 2, below its target of 3 (the backend rejects it).
    expect(teamMaxRobots(pinnedRows, [1, 2, 3, 4])).toBe(4);
    expect(teamMaxRobots(newRows, [1, 2, 4])).toBe(2);
    const plan = savePlan(gapped, form, newRows);
    expect(plan.map((s) => s.kind)).toEqual(['update_strategy', 'add_blueprint']);
    // No step carries a '' Team_Name the Teams card never shows.
    for (const step of plan) {
      if (step.kind === 'update_strategy' || step.kind === 'add_blueprint') {
        expect([...step.teamNames.twoVsTwo, ...step.teamNames.threeVsThree]).not.toContain('');
      }
    }
  });

  it('finds the next free slot, 11 at most', () => {
    expect(nextFreeSlot([1, 2, 4])).toBe(3);
    expect(nextFreeSlot(Array.from({ length: 11 }, (_, i) => i + 1))).toBeNull();
  });

  it('prices refinement steps with the shared formula and writes the blueprint header', () => {
    expect(refinementStepCosts([
      { tier: 'sharpen', hand: 'main', magnitude: 1 },
      { tier: 'sharpen', hand: 'offhand', magnitude: 1 },
      { tier: 'sharpen', hand: 'main', magnitude: 1 },
      { tier: 'hone', hand: 'main', targetAttribute: 'targetingSystems', magnitude: 4 },
    ])).toEqual([300_000, 300_000, 900_000, 160_000]);
    const item = { slot: 1, fields: formFromDetail(detail()).blueprints[1], imageUrl: null, liveRobot: { id: 1, name: 'Rex' }, pending: false };
    expect(blueprintHeader(item, WEAPON_MAP)).toEqual({ title: '1 · CT-7567 Rex', summary: 'Single · balanced · Versatile · range melee (from weapons) · in play' });
  });
});

describe('EditorTab (task 10.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getProfile.mockResolvedValue(detail());
    api.listTurns.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    api.listWeapons.mockResolvedValue(WEAPONS);
    api.previewTurn.mockResolvedValue(turnPreview());
  });

  it('renders the stable card with a live backstory count and the pinned strategy', async () => {
    renderEditor();
    const backstory = await screen.findByLabelText('Backstory');
    expect(screen.getByText(/Up to 400 characters · 38 \/ 400/)).toBeInTheDocument();
    fireEvent.change(backstory, { target: { value: 'x'.repeat(401) } });
    expect(screen.getByText(/401 \/ 400/)).toBeInTheDocument();
    expect(screen.getByText('v2 available — upgrade in the Strategy library')).toBeInTheDocument();
    expect(screen.getByLabelText('Catalogue key')).toHaveAttribute('readonly');
  });

  it('disables Delete draft stable for an active stable and Save while a target is out of bounds', async () => {
    renderEditor();
    const target = await screen.findByLabelText('Target: 1 Robots');
    expect(screen.getByRole('button', { name: 'Delete draft stable' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    fireEvent.change(target, { target: { value: '4' } });
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'Allowed 1–3')).toBe(true);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('renders the Turn_Preview statuses in the build order and the Next cycle summary', async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview next cycle' }));
    expect(await screen.findByText('If settlement ran now, Kamino Clone Legion would:')).toBeInTheDocument();
    expect(screen.getByText('Goal 2 · Booking Office L2 for ₡150,000')).toBeInTheDocument();
    expect(screen.getByText(/Goal 3 · Attributes → 5: needs ₡225,000, has ₡166,000\. Goal 4 waits\./)).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Build order' })).getByText('Waiting 🔒')).toBeInTheDocument();
    expect(screen.getByText('This is a preview. Nothing has been bought.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '▸ Show plan' }));
    expect(screen.getByText('Plan for Attributes → 5')).toBeInTheDocument();
  });

  it('saves target and stable changes through the profile endpoints', async () => {
    api.updateStrategy.mockResolvedValue(detail());
    api.updateProfile.mockResolvedValue(detail());
    const { onChanged } = renderEditor();
    fireEvent.change(await screen.findByLabelText('Target: 1 Robots'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Franchise'), { target: { value: 'Star Wars' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(api.updateStrategy).toHaveBeenCalledWith('clone-legion', expect.objectContaining({ strategyKey: 'swarm', targets: expect.objectContaining({ 'swarm.v1.01.robots': 2 }) }));
    expect(api.updateProfile).toHaveBeenCalledWith('clone-legion', { franchise: 'Star Wars' });
    expect(await screen.findByText('Saved. Changes apply from the next settlement.')).toBeInTheDocument();
  });

  it('shows a rejected save with the backend rule message', async () => {
    api.updateProfile.mockRejectedValue(Object.assign(new Error('This stable needs 1 team names for 2v2 and 1 for 3v3.'), {
      code: 'AUTOMATON_TEAM_NAMES_MISMATCH', details: { issues: [{ rule: 'team_names_count', message: 'This stable needs 1 team names for 2v2 and 1 for 3v3.', path: ['teamNames'] }] },
    }));
    renderEditor();
    fireEvent.change(await screen.findByLabelText('Franchise'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findAllByText('This stable needs 1 team names for 2v2 and 1 for 3v3.')).length).toBeGreaterThan(0);
  });

  it('confirms Activation of a draft with the approved text', async () => {
    api.getProfile.mockResolvedValue(detail({ status: 'draft', userId: null, credits: null, prestige: null, blueprints: [blueprint(1)] }));
    api.activateProfile.mockResolvedValue({ catalogueKey: 'clone-legion', userId: 9, stableName: 'Kamino Clone Legion', activatedAt: '' });
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Activate stable' }));
    const dialog = screen.getByRole('dialog', { name: 'Activate Kamino Clone Legion?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('It joins the game with ₡3,000,000 and starts building after the next settlement. Activation cannot be undone.');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate stable' }));
    await waitFor(() => expect(api.activateProfile).toHaveBeenCalledWith('clone-legion'));
  });

  it('confirms Delete draft stable for a draft', async () => {
    api.getProfile.mockResolvedValue(detail({ status: 'draft', userId: null }));
    api.deleteDraft.mockResolvedValue(undefined);
    const { onSelect } = renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete draft stable' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete draft stable' });
    expect(dialog).toHaveTextContent('Delete draft Kamino Clone Legion? This cannot be undone. A stable from a catalogue file comes back as a draft at the next sync.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete draft stable' }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
  });

  it('disables Delete blueprint while a live robot is linked and confirms otherwise', async () => {
    api.deleteBlueprint.mockResolvedValue(detail());
    renderEditor();
    await screen.findByText('1 · CT-7567 Rex');
    expect(screen.getByText(/A robot built from this blueprint is in play\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete blueprint' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /3 · CT-5555 Fives/ }));
    const buttons = screen.getAllByRole('button', { name: 'Delete blueprint' });
    fireEvent.click(buttons[buttons.length - 1]);
    const dialog = screen.getByRole('dialog', { name: 'Delete blueprint' });
    expect(dialog).toHaveTextContent('Delete blueprint 3 · CT-5555 Fives? This cannot be undone.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete blueprint' }));
    await waitFor(() => expect(api.deleteBlueprint).toHaveBeenCalledWith('clone-legion', 3, expect.any(Object)));
  });

  it('keeps a saved addition and the unsaved edits after a later Save step fails, and the retry sizes Team_Names with it', async () => {
    // Robots up to 4: blueprint 4 opens a second 2v2 team (robots 3+4).
    const base = detail();
    const strategy = { ...base.strategy, buildOrder: base.strategy.buildOrder.map((r) => (r.type === 'robots' ? { ...r, bounds: { min: 1, max: 4 } } : r)) };
    const before = detail({ strategy });
    const added = blueprint(4, { robotName: '', weaponPath: [{ main: '' }], refinementPlan: [] });
    const after = detail({ strategy, blueprints: [...before.blueprints, added], teamNames: { twoVsTwo: ['Torrent Company', 'Ghost Company'], threeVsThree: ['Bad Batch'] } });
    api.getProfile.mockReset();
    api.getProfile.mockResolvedValueOnce(before).mockResolvedValue(after);
    api.addBlueprint.mockResolvedValue(added);
    api.updateProfile
      .mockRejectedValueOnce(Object.assign(new Error('That stable name is taken.'), { code: 'STABLE_NAME_TAKEN' }))
      .mockResolvedValue(after);
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Add blueprint' }));
    fireEvent.change(screen.getAllByLabelText('Team name: 2v2 robots 3+4')[0], { target: { value: 'Ghost Company' } });
    fireEvent.change(screen.getByLabelText('Franchise'), { target: { value: 'Star Wars' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('That stable name is taken.')).toBeInTheDocument();
    expect(api.addBlueprint).toHaveBeenCalledWith('clone-legion', expect.objectContaining({ slot: 4, teamNames: { twoVsTwo: ['Torrent Company', 'Ghost Company'], threeVsThree: ['Bad Batch'] } }));
    await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(2));
    // The saved blueprint is still shown and the edit that failed is kept.
    expect(screen.getByRole('button', { name: /^4 ·/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Franchise')).toHaveValue('Star Wars');

    fireEvent.change(screen.getAllByLabelText('Team name: 2v2 robots 3+4')[0], { target: { value: 'Ghost Co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved. Changes apply from the next settlement.')).toBeInTheDocument();
    expect(api.addBlueprint).toHaveBeenCalledTimes(1);
    expect(api.updateBlueprint).not.toHaveBeenCalled();
    expect(api.updateProfile).toHaveBeenLastCalledWith('clone-legion', {
      franchise: 'Star Wars',
      teamNames: { twoVsTwo: ['Torrent Company', 'Ghost Co'], threeVsThree: ['Bad Batch'] },
    });
  });

  it('keeps unsaved edits when a saved blueprint is deleted or an image is uploaded', async () => {
    const base = detail();
    api.getProfile.mockReset();
    api.getProfile.mockResolvedValueOnce(base).mockResolvedValue(detail({ blueprints: base.blueprints.slice(0, 2) }));
    api.deleteBlueprint.mockResolvedValue(undefined);
    api.uploadBlueprintImage.mockResolvedValue(undefined);
    renderEditor();
    fireEvent.change(await screen.findByLabelText('Franchise'), { target: { value: 'Star Wars' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add blueprint' }));
    expect(screen.getByRole('button', { name: /^4 ·/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /3 · CT-5555 Fives/ }));
    const buttons = screen.getAllByRole('button', { name: 'Delete blueprint' });
    fireEvent.click(buttons[buttons.length - 2]);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete blueprint' })).getByRole('button', { name: 'Delete blueprint' }));
    await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(2));
    expect(api.deleteBlueprint).toHaveBeenCalledWith('clone-legion', 3, { twoVsTwo: ['Torrent Company'], threeVsThree: [] });
    await waitFor(() => expect(screen.queryByRole('button', { name: /3 · CT-5555 Fives/ })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Franchise')).toHaveValue('Star Wars');
    expect(screen.getByRole('button', { name: /^4 ·/ })).toBeInTheDocument();

    const file = new File(['img'], 'rex.webp', { type: 'image/webp' });
    fireEvent.change(screen.getByLabelText('Upload image: 1 CT-7567 Rex'), { target: { files: [file] } });
    await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(3));
    expect(api.uploadBlueprintImage).toHaveBeenCalledWith('clone-legion', 1, file);
    expect(screen.getByLabelText('Franchise')).toHaveValue('Star Wars');
    expect(screen.getByRole('button', { name: /^4 ·/ })).toBeInTheDocument();
  });

  it('adds a blueprint in the next free slot and limits weapons to the loadout', async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Add blueprint' }));
    expect(screen.getByRole('button', { name: /^4 ·/ })).toHaveAttribute('aria-expanded', 'true');
    const main = screen.getAllByLabelText('Main hand, stage 0').at(-1) as HTMLSelectElement;
    const options = Array.from(main.options).map((o) => o.value);
    expect(options).toContain('Laser Pistol');
    expect(options).not.toContain('Tower Shield');
    expect(options).not.toContain('War Hammer');
  });
});
