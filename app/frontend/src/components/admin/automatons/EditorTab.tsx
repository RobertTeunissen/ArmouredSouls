/**
 * Editor tab (Spec #55, R2.2, R2.6, R3.x, R6.4, R11.2, R11.4, R11.10,
 * PLAYER_FACING_TEXT §6.5, design §17.2, task 10.3): one stable at a time.
 * Header: stable picker, New stable, Delete draft stable (drafts only),
 * Export and Save changes. Left: Stable card, Build order, Teams and Robot
 * blueprints; right: Next cycle and Cycle history. One column below 1024 px.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  activateProfile,
  addBlueprint,
  createDraft,
  deleteBlueprint,
  deleteDraft,
  downloadJson,
  exportCatalogue,
  getProfile,
  listTurns,
  listWeapons,
  previewTurn,
  updateBlueprint,
  updateProfile,
  updateStrategy,
  uploadBlueprintImage,
  type BlueprintFields,
  type CatalogueWeapon,
  type LibraryStrategy,
  type ProfileDetail,
  type ProfileListItem,
  type ProfileTurnPreview,
  type TurnRecord,
} from '../../../utils/automatonAdminApi';
import { ActionButton, Card, ConfirmDialog, Dialog, Field, INPUT_CLASS, Notice } from './ui';
import { errorText, issueMessages } from './requestErrors';
import { StableCard } from './StableCard';
import { StablePicker } from './StablePicker';
import { CashflowCard } from './CashflowCard';
import { BuildOrderPanel } from './BuildOrderPanel';
import { targetError } from './automatonText';
import { TeamsCard } from './TeamsCard';
import { sizeTeamNames, teamRows } from './teamState';
import { BlueprintEditor } from './BlueprintEditor';
import { TurnPreviewPanel } from './TurnPreviewPanel';
import { TurnHistoryTable } from './TurnHistoryTable';
import {
  NEW_BLUEPRINT,
  buildOrderRows,
  defaultTargets,
  editorItems,
  formFromDetail,
  nextFreeSlot,
  savePlan,
  teamMaxRobots,
  type EditorForm,
} from './editorState';

/** Blueprints shown before "+ {n} more blueprints". */
const COLLAPSED_BLUEPRINTS = 4;

export interface EditorTabProps {
  profiles: ProfileListItem[];
  strategies: LibraryStrategy[];
  selectedKey: string | null;
  onSelect: (catalogueKey: string | null) => void;
  /** A mutation changed the stable list or the status bar. */
  onChanged: () => void;
}

interface IssueEntry {
  message: string;
  path: (string | number)[];
}

function issueEntries(error: unknown): IssueEntry[] {
  const details = (error as { details?: { issues?: { message?: unknown; path?: unknown }[] } } | null)?.details;
  return (details?.issues ?? []).flatMap((i) => (typeof i.message === 'string'
    ? [{ message: i.message, path: Array.isArray(i.path) ? (i.path as (string | number)[]) : [] }]
    : []));
}

function NewStableDialog({ strategies, onCancel, onCreated }: {
  strategies: LibraryStrategy[];
  onCancel: () => void;
  onCreated: (key: string) => void;
}): ReactNode {
  const [values, setValues] = useState({ catalogueKey: '', stableName: '', strategyKey: strategies[0]?.key ?? '', franchise: '', backstory: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof values>): void => setValues((v) => ({ ...v, ...patch }));
  const ready = Object.values(values).every((v) => v.trim().length > 0);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const created = await createDraft(values);
      onCreated(created.catalogueKey);
    } catch (err) {
      setError([errorText(err, 'The stable could not be created.'), ...issueMessages(err)].join(' '));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="New stable"
      onClose={onCancel}
      actions={(
        <>
          <ActionButton onClick={onCancel} disabled={busy}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!ready || busy} onClick={() => void submit()}>New stable</ActionButton>
        </>
      )}
    >
      <Field label="Catalogue key" help="Permanent identifier used for export and sync. Lowercase letters, digits and hyphens. Cannot be changed later.">
        {(props) => <input {...props} className={INPUT_CLASS} value={values.catalogueKey} maxLength={40} onChange={(e) => set({ catalogueKey: e.target.value })} />}
      </Field>
      <Field label="Stable name" help="Shown to players. Same rules as player stable names.">
        {(props) => <input {...props} className={INPUT_CLASS} value={values.stableName} maxLength={30} onChange={(e) => set({ stableName: e.target.value })} />}
      </Field>
      <Field label="Strategy" help="How this stable spends its credits.">
        {(props) => (
          <select {...props} className={INPUT_CLASS} value={values.strategyKey} onChange={(e) => set({ strategyKey: e.target.value })}>
            {strategies.map((s) => <option key={s.key} value={s.key}>{s.displayName} · v{s.latestVersion}</option>)}
          </select>
        )}
      </Field>
      <Field label="Franchise" help="Admin only. Used to group stables here; not shown to players.">
        {(props) => <input {...props} className={INPUT_CLASS} value={values.franchise} maxLength={60} onChange={(e) => set({ franchise: e.target.value })} />}
      </Field>
      <Field label="Backstory" help={`Admin only for now; not shown to players. Up to 400 characters · ${values.backstory.length} / 400`}>
        {(props) => <textarea {...props} rows={3} className={INPUT_CLASS} value={values.backstory} maxLength={400} onChange={(e) => set({ backstory: e.target.value })} />}
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}

type PendingDialog =
  | { kind: 'activate' }
  | { kind: 'delete_draft' }
  | { kind: 'delete_blueprint'; slot: number; robotName: string }
  | { kind: 'new_stable' }
  | null;

export function EditorTab({ profiles, strategies, selectedKey, onSelect, onChanged }: EditorTabProps): ReactNode {
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [form, setForm] = useState<EditorForm | null>(null);
  const [weapons, setWeapons] = useState<ReadonlyMap<string, CatalogueWeapon>>(new Map());
  const [preview, setPreview] = useState<ProfileTurnPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [turns, setTurns] = useState<TurnRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ text: string; issues: IssueEntry[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set([1]));
  const [showAll, setShowAll] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listWeapons()
      .then((list) => { if (!cancelled) setWeapons(new Map(list.map((w) => [w.name, w]))); })
      .catch(() => { /* weapon names stay as text; the backend validates */ });
    return () => { cancelled = true; };
  }, []);

  /**
   * Loads the stable. `keepForm` refreshes only the server state and keeps
   * the form, so unsaved edits survive a reload after a committed call
   * (partial Save, blueprint delete, image upload): the form is diffed
   * against the new detail, so committed edits drop out of the next save plan.
   */
  const load = useCallback(async (key: string, options: { keepForm?: boolean } = {}): Promise<void> => {
    setLoadError(null);
    try {
      const next = await getProfile(key);
      setDetail(next);
      if (options.keepForm) {
        // Saved blueprints that no longer exist lose their edits.
        const live = new Set(next.blueprints.map((b) => b.slot));
        setForm((f) => (f ? { ...f, blueprints: Object.fromEntries(Object.entries(f.blueprints).filter(([slot]) => live.has(Number(slot)))) } : formFromDetail(next)));
      } else {
        setForm(formFromDetail(next));
      }
      setTurns(null);
      listTurns(key).then((page) => setTurns(page.items)).catch(() => setTurns([]));
    } catch (err) {
      setDetail(null);
      setForm(null);
      setLoadError(errorText(err, 'The stable could not be loaded.'));
    }
  }, []);

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    setSaveError(null);
    setNotice(null);
    if (selectedKey) void load(selectedKey);
    else {
      setDetail(null);
      setForm(null);
    }
  }, [selectedKey, load]);

  const rows = useMemo(() => (detail && form ? buildOrderRows(detail, form.strategyKey, strategies) : []), [detail, form, strategies]);
  const items = useMemo(() => (detail && form ? editorItems(detail, form) : []), [detail, form]);
  const maxRobots = teamMaxRobots(rows, items.map((i) => i.slot));
  const liveNames = useMemo(() => new Map(items.flatMap((i) => (i.liveRobot ? [[i.slot, i.liveRobot.name] as const] : []))), [items]);
  const teams = form ? teamRows(maxRobots, sizeTeamNames(form.teamNames, maxRobots), liveNames) : [];
  const hasTargetErrors = rows.some((r) => targetError(r, form?.targets[r.goalId] ?? r.target) !== null);

  const update = (patch: Partial<EditorForm>): void => setForm((f) => (f ? { ...f, ...patch } : f));

  const runPreview = async (): Promise<void> => {
    if (!detail) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      setPreview(await previewTurn(detail.catalogueKey));
    } catch (err) {
      setPreviewError(errorText(err, 'The preview could not be computed.'));
    } finally {
      setPreviewing(false);
    }
  };

  const fail = (err: unknown, fallback: string): void => {
    setSaveError({ text: errorText(err, fallback), issues: issueEntries(err) });
  };

  const save = async (): Promise<void> => {
    if (!detail || !form) return;
    setBusy(true);
    setSaveError(null);
    setNotice(null);
    const key = detail.catalogueKey;
    let committed = false;
    try {
      for (const step of savePlan(detail, form, rows)) {
        if (step.kind === 'update_blueprint') await updateBlueprint(key, step.slot, step.fields);
        if (step.kind === 'add_blueprint') {
          await addBlueprint(key, { ...step.fields, slot: step.slot, teamNames: step.teamNames });
          // Saved: never post it twice if a later step fails.
          setForm((f) => (f ? { ...f, pending: f.pending.filter((p) => p.slot !== step.slot), blueprints: { ...f.blueprints, [step.slot]: step.fields } } : f));
        }
        if (step.kind === 'update_strategy') await updateStrategy(key, { strategyKey: step.strategyKey, targets: step.targets, teamNames: step.teamNames });
        if (step.kind === 'update_profile') await updateProfile(key, step.patch);
        committed = true;
      }
      await load(key);
      setNotice('Saved. Changes apply from the next settlement.');
      onChanged();
    } catch (err) {
      fail(err, 'The changes could not be saved.');
      // Earlier calls are saved: refresh the server state so the cards and
      // the next save plan include them, and keep the edits not saved yet.
      if (committed) {
        await load(key, { keepForm: true });
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmDialog = async (): Promise<void> => {
    if (!detail || !form || !dialog) return;
    setBusy(true);
    setSaveError(null);
    try {
      if (dialog.kind === 'activate') {
        await activateProfile(detail.catalogueKey);
        await load(detail.catalogueKey);
        onChanged();
      } else if (dialog.kind === 'delete_draft') {
        await deleteDraft(detail.catalogueKey);
        onSelect(null);
        onChanged();
      } else if (dialog.kind === 'delete_blueprint') {
        const pending = form.pending.some((p) => p.slot === dialog.slot);
        if (pending) {
          update({ pending: form.pending.filter((p) => p.slot !== dialog.slot) });
        } else {
          const remaining = items.filter((i) => i.slot !== dialog.slot && !i.pending).map((i) => i.slot);
          // The backend checks these names against the pinned strategy.
          await deleteBlueprint(detail.catalogueKey, dialog.slot, sizeTeamNames(form.teamNames, teamMaxRobots(detail.strategy.buildOrder, remaining)));
          await load(detail.catalogueKey, { keepForm: true });
        }
      }
      setDialog(null);
    } catch (err) {
      fail(err, 'The action could not be completed.');
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const addBlueprintSlot = (): void => {
    if (!form) return;
    const slot = nextFreeSlot(items.map((i) => i.slot));
    if (slot === null) return;
    update({ pending: [...form.pending, { slot, fields: { ...NEW_BLUEPRINT, weaponPath: [{ main: '' }], refinementPlan: [] } }] });
    setExpanded((e) => new Set([...e, slot]));
    setShowAll(true);
  };

  const setBlueprint = (slot: number, fields: BlueprintFields): void => {
    if (!form) return;
    if (form.pending.some((p) => p.slot === slot)) update({ pending: form.pending.map((p) => (p.slot === slot ? { slot, fields } : p)) });
    else update({ blueprints: { ...form.blueprints, [slot]: fields } });
  };

  const upload = async (slot: number, file: File): Promise<void> => {
    if (!detail) return;
    setUploadingSlot(slot);
    setSaveError(null);
    try {
      await uploadBlueprintImage(detail.catalogueKey, slot, file);
      await load(detail.catalogueKey, { keepForm: true });
    } catch (err) {
      fail(err, 'The image could not be uploaded.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const exportStable = async (): Promise<void> => {
    if (!detail) return;
    try {
      downloadJson(`automaton-catalogue-${detail.catalogueKey}.json`, await exportCatalogue([detail.catalogueKey]));
    } catch (err) {
      fail(err, 'The stable could not be exported.');
    }
  };

  const blueprintErrors = (slot: number): string[] => (saveError?.issues ?? [])
    .filter((i) => i.path[0] === 'blueprints' && Number(i.path[1]) === slot)
    .map((i) => i.message);
  const generalIssues = (saveError?.issues ?? []).filter((i) => i.path[0] !== 'blueprints').map((i) => i.message);
  const teamNamesError = (saveError?.issues ?? []).find((i) => i.path[0] === 'teamNames')?.message ?? null;

  const visibleItems = showAll ? items : items.slice(0, COLLAPSED_BLUEPRINTS);
  const hiddenCount = items.length - visibleItems.length;

  const header = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 lg:w-96">
        <Field label="Editing">
          {(props) => (
            <StablePicker {...props} profiles={profiles} selectedKey={selectedKey} onSelect={onSelect} showStatus />
          )}
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2">
        <ActionButton onClick={() => setDialog({ kind: 'new_stable' })}>New stable</ActionButton>
        <ActionButton
          variant="danger"
          disabled={!detail || detail.status !== 'draft'}
          title={detail && detail.status !== 'draft' ? 'Drafts only' : undefined}
          onClick={() => setDialog({ kind: 'delete_draft' })}
        >
          Delete draft stable
        </ActionButton>
        <ActionButton disabled={!detail} onClick={() => void exportStable()}>Export</ActionButton>
        {detail?.status === 'draft' && (
          <ActionButton variant="ghost" disabled={busy} onClick={() => setDialog({ kind: 'activate' })}>Activate stable</ActionButton>
        )}
        <ActionButton variant="primary" disabled={!detail || busy || hasTargetErrors} onClick={() => void save()}>Save changes</ActionButton>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 min-w-0">
      {header}
      {loadError && <Notice tone="error">{loadError}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {saveError && (
        <Notice tone="error">
          <p>{saveError.text}</p>
          {generalIssues.length > 0 && <ul className="mt-1 list-disc pl-5">{generalIssues.map((m) => <li key={m}>{m}</li>)}</ul>}
        </Notice>
      )}

      {!selectedKey && <p className="text-sm text-secondary">Pick a stable to edit, or create a new one.</p>}

      {detail && form && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
          <div className="space-y-4 min-w-0">
            <StableCard
              catalogueKey={detail.catalogueKey}
              values={form}
              pinned={detail.strategy}
              strategies={strategies}
              onChange={(patch) => {
                if (patch.strategyKey !== undefined && patch.strategyKey !== form.strategyKey) {
                  const nextRows = buildOrderRows(detail, patch.strategyKey, strategies);
                  update({ ...patch, targets: patch.strategyKey === detail.strategy.key ? formFromDetail(detail).targets : defaultTargets(nextRows) });
                } else {
                  update(patch);
                }
              }}
            />
            <BuildOrderPanel
              heading={`Build order · ${(strategies.find((s) => s.key === form.strategyKey)?.displayName ?? form.strategyKey)} v${form.strategyKey === detail.strategy.key ? detail.strategy.version : strategies.find((s) => s.key === form.strategyKey)?.latestVersion ?? ''}`}
              rows={rows}
              targets={form.targets}
              preview={form.strategyKey === detail.strategy.key ? preview : null}
              attributePlans={form.strategyKey === detail.strategy.key ? detail.attributePlans : []}
              previewing={previewing}
              onTargetChange={(goalId, target) => update({ targets: { ...form.targets, [goalId]: target } })}
              onPreview={() => void runPreview()}
            />
            <TeamsCard
              rows={teams}
              error={teamNamesError}
              onNameChange={(size, index, name) => {
                const sized = sizeTeamNames(form.teamNames, maxRobots);
                const list = size === 2 ? [...sized.twoVsTwo] : [...sized.threeVsThree];
                list[index] = name;
                update({ teamNames: size === 2 ? { ...sized, twoVsTwo: list } : { ...sized, threeVsThree: list } });
              }}
            />
            <Card
              title="Robot blueprints"
              actions={<ActionButton variant="ghost" disabled={items.length >= 11} onClick={addBlueprintSlot}>Add blueprint</ActionButton>}
            >
              <p className="mb-3 text-xs text-secondary">Next free slot, 11 at most.</p>
              <div className="space-y-2">
                {visibleItems.map((item) => (
                  <BlueprintEditor
                    key={item.slot}
                    item={item}
                    weapons={weapons}
                    buildFocusOptions={detail.buildFocusOptions}
                    expanded={expanded.has(item.slot)}
                    errors={blueprintErrors(item.slot)}
                    uploading={uploadingSlot === item.slot}
                    onToggle={() => setExpanded((e) => {
                      const next = new Set(e);
                      if (next.has(item.slot)) next.delete(item.slot);
                      else next.add(item.slot);
                      return next;
                    })}
                    onChange={(fields) => setBlueprint(item.slot, fields)}
                    onDelete={() => setDialog({ kind: 'delete_blueprint', slot: item.slot, robotName: item.fields.robotName })}
                    onUpload={(file) => void upload(item.slot, file)}
                  />
                ))}
                {hiddenCount > 0 && (
                  <ActionButton className="w-full" onClick={() => setShowAll(true)}>+ {hiddenCount} more blueprints</ActionButton>
                )}
              </div>
            </Card>
          </div>
          <div className="space-y-4 min-w-0">
            <TurnPreviewPanel stableName={detail.stableName} preview={preview} error={previewError} loading={previewing} />
            <CashflowCard catalogueKey={detail.catalogueKey} active={detail.status === 'active'} />
            <TurnHistoryTable records={turns} />
          </div>
        </div>
      )}

      {dialog?.kind === 'new_stable' && (
        <NewStableDialog
          strategies={strategies}
          onCancel={() => setDialog(null)}
          onCreated={(key) => {
            setDialog(null);
            onSelect(key);
            onChanged();
          }}
        />
      )}
      {dialog?.kind === 'activate' && detail && (
        <ConfirmDialog
          title={`Activate ${detail.stableName}?`}
          message="It joins the game with ₡3,000,000 and starts building after the next settlement. Activation cannot be undone."
          confirmLabel="Activate stable"
          busy={busy}
          onConfirm={() => void confirmDialog()}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete_draft' && detail && (
        <ConfirmDialog
          title="Delete draft stable"
          message={`Delete draft ${detail.stableName}? This cannot be undone. A stable from a catalogue file comes back as a draft at the next sync.`}
          confirmLabel="Delete draft stable"
          destructive
          busy={busy}
          onConfirm={() => void confirmDialog()}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete_blueprint' && (
        <ConfirmDialog
          title="Delete blueprint"
          message={`Delete blueprint ${dialog.slot} · ${dialog.robotName}? This cannot be undone.`}
          confirmLabel="Delete blueprint"
          destructive
          busy={busy}
          onConfirm={() => void confirmDialog()}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
