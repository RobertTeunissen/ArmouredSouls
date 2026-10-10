/**
 * Strategy_Builder (Spec #55, R6.9–R6.14, PLAYER_FACING_TEXT §6.4b, design
 * §14.0b and §17.2, task 10.4): draft metadata, the numbered Goal list (add
 * from the Goal_Library, Move up / Move down, Remove, default and bounds
 * inputs), rule errors next to the Goal and the Build_Order-level errors above
 * the list, Save draft, Delete draft and Export strategy file (disabled while
 * any rule fails or changes are unsaved), plus the draft preview. Below
 * 768 px the Goal list is one card per Goal.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  deleteStrategyDraft,
  downloadJson,
  exportStrategyDraft,
  getStrategyDraft,
  updateStrategyDraft,
  type DraftView,
  type FileBuildOrderEntry,
  type FileTargetValue,
  type ProfileListItem,
  type UpgradeWarningEntry,
} from '../../../utils/automatonAdminApi';
import { ActionButton, Card, ConfirmDialog, FOCUS_RING, Field, FieldError, IconButton, INPUT_CLASS, Notice } from './ui';
import { errorText, issueMessages } from './requestErrors';
import { BUILDER_FACILITY_TYPES, upgradeWarningText } from './automatonText';
import { DraftPreviewPanel } from './DraftPreviewPanel';
import {
  addGoal,
  buildOrderIssues,
  type BuilderRow,
  goalLabel,
  goalLibraryChoices,
  issuesAt,
  metadataIssues,
  moveGoal,
  parseTarget,
  removeGoal,
  targetFieldText,
} from './builderState';

export interface StrategyBuilderProps {
  draftId: number;
  profiles: ProfileListItem[];
  onBack: () => void;
  /** The draft list (error counts) changed. */
  onChanged: () => void;
}

type Row = BuilderRow;

function TargetField({ label, value, allowMax, onChange }: { label: string; value: FileTargetValue; allowMax: boolean; onChange: (v: FileTargetValue) => void }): ReactNode {
  const [raw, setRaw] = useState(targetFieldText(value));
  const committed = useRef(value);
  useEffect(() => {
    if (committed.current !== value) {
      committed.current = value;
      setRaw(targetFieldText(value));
    }
  }, [value]);
  const invalid = parseTarget(raw, allowMax) === null;
  return (
    <input
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      inputMode={allowMax ? 'text' : 'numeric'}
      className={`${INPUT_CLASS} w-20 ${invalid ? 'border-red-400' : ''}`}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const parsed = parseTarget(e.target.value, allowMax);
        if (parsed !== null) {
          committed.current = parsed;
          onChange(parsed);
        }
      }}
    />
  );
}

export function StrategyBuilder({ draftId, profiles, onBack, onChanged }: StrategyBuilderProps): ReactNode {
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [meta, setMeta] = useState({ key: '', displayName: '', description: '' });
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<{ fileName: string; warning: UpgradeWarningEntry[] | null } | null>(null);
  const [addChoice, setAddChoice] = useState('robots');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nextId = useRef(1);

  const adopt = (view: DraftView): void => {
    setDraft(view);
    setMeta({ key: view.definition.key, displayName: view.definition.displayName, description: view.definition.description });
    setRows(view.definition.buildOrder.map((entry) => ({ id: nextId.current++, entry })));
    setDirty(false);
  };

  useEffect(() => {
    let cancelled = false;
    setDraft(null);
    setExported(null);
    getStrategyDraft(draftId)
      .then((view) => { if (!cancelled) adopt(view); })
      .catch((err: unknown) => { if (!cancelled) setError(errorText(err, 'The draft could not be loaded.')); });
    return () => { cancelled = true; };
  }, [draftId]);

  const setList = (next: Row[]): void => {
    setRows(next);
    setDirty(true);
    setExported(null);
  };

  const patchEntry = (index: number, patch: Partial<FileBuildOrderEntry>): void => {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, entry: { ...r.entry, ...patch } } : r)));
    setDirty(true);
    setExported(null);
  };

  const save = async (): Promise<void> => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const view = await updateStrategyDraft(draft.id, {
        ...(draft.basedOn === null ? { key: meta.key } : {}),
        displayName: meta.displayName,
        description: meta.description,
        buildOrder: rows.map((r) => r.entry),
      });
      adopt(view);
      onChanged();
    } catch (err) {
      setError([errorText(err, 'The draft could not be saved.'), ...issueMessages(err)].join(' '));
    } finally {
      setBusy(false);
    }
  };

  const exportFile = async (): Promise<void> => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const result = await exportStrategyDraft(draft.id);
      // Only the Strategy_Definition_File: the saved file unpacks with `automaton:unpack` (review C10F-1).
      downloadJson(result.fileName, result.definition);
      setExported({ fileName: result.fileName, warning: result.upgradeWarning });
    } catch (err) {
      setError(errorText(err, 'The draft could not be exported.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!draft) return;
    setBusy(true);
    try {
      await deleteStrategyDraft(draft.id);
      onChanged();
      onBack();
    } catch (err) {
      setError(errorText(err, 'The draft could not be deleted.'));
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  const back = (
    <button type="button" onClick={onBack} className={`min-h-11 text-sm text-primary hover:underline ${FOCUS_RING}`}>← Strategy library</button>
  );

  if (!draft) {
    return (
      <div className="space-y-3">
        {back}
        {error ? <Notice tone="error">{error}</Notice> : <p className="text-sm text-secondary">Loading…</p>}
      </div>
    );
  }

  const issues = draft.issues;
  const listIssues = buildOrderIssues(issues);
  const otherIssues = metadataIssues(issues);
  const exportDisabled = !draft.ready || dirty || busy;
  // Why Export is disabled; `busy` is momentary and needs no reason.
  const exportHelp = !draft.ready
    ? `Export is disabled while the draft has errors (${draft.errorCount}).`
    : dirty ? 'Save the draft before exporting.' : null;
  const exportHelpId = `export-help-${draft.id}`;
  const choices = goalLibraryChoices(BUILDER_FACILITY_TYPES);
  const subtitle = draft.basedOn ? `new version of ${draft.definition.displayName || draft.definition.key}` : 'new strategy';
  const warning = exported?.warning ?? draft.upgradeWarning;

  return (
    <div className="space-y-4 min-w-0">
      {back}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
        <Card title={<>Strategy builder <span className="text-sm font-normal text-secondary">· {subtitle}</span></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Strategy key" help="Permanent identifier, lowercase letters, digits and hyphens. A new version keeps the key.">
                {(props) => (
                  <input
                    {...props}
                    className={`${INPUT_CLASS} ${draft.basedOn ? 'opacity-80' : ''}`}
                    value={meta.key}
                    maxLength={40}
                    readOnly={draft.basedOn !== null}
                    onChange={(e) => { setMeta((m) => ({ ...m, key: e.target.value })); setDirty(true); }}
                  />
                )}
              </Field>
              <Field label="Version" help="Set automatically: v1 for a new strategy, the next number for a new version.">
                {(props) => <input {...props} className={`${INPUT_CLASS} opacity-80`} value={`v${draft.definition.version}`} readOnly />}
              </Field>
              <Field label="Display name" help="Shown on the admin page only.">
                {(props) => (
                  <input {...props} className={INPUT_CLASS} value={meta.displayName} maxLength={60} onChange={(e) => { setMeta((m) => ({ ...m, displayName: e.target.value })); setDirty(true); }} />
                )}
              </Field>
            </div>
            <Field label="Description" help="One or two sentences on how this strategy spends.">
              {(props) => (
                <textarea {...props} rows={2} className={INPUT_CLASS} value={meta.description} maxLength={500} onChange={(e) => { setMeta((m) => ({ ...m, description: e.target.value })); setDirty(true); }} />
              )}
            </Field>
            {otherIssues.map((m) => <FieldError key={m}>{m}</FieldError>)}

            <div>
              <h4 className="text-sm font-semibold text-white">Build order</h4>
              <p className="text-xs text-secondary">Goal 1 is bought first. The last goal is always &quot;Attributes → Max&quot;. Every goal type is needed at least once.</p>
              {listIssues.length > 0 && (
                <ul className="mt-2 space-y-1">{listIssues.map((m) => <li key={m}><FieldError>{m}</FieldError></li>)}</ul>
              )}
              <ol className="mt-2 space-y-2" aria-label="Build order">
                {rows.map((row, index) => {
                  const entry = row.entry;
                  const label = goalLabel(entry.goal);
                  const name = `${entry.position} ${label}`;
                  const allowMax = entry.goal.type === 'attributes';
                  const prefix = entry.goal.type === 'facility' ? 'L' : '';
                  const errors = issuesAt(issues, entry.position);
                  return (
                    <li key={row.id} className="rounded-md border border-white/10 bg-background p-2">
                      <div className="grid grid-cols-1 md:grid-cols-[2rem_minmax(7rem,1fr)_auto_auto_auto] gap-2 md:items-center text-sm">
                        <span className="text-secondary">{entry.position}</span>
                        <span className="font-medium text-white">{label}</span>
                        <span className="flex items-center gap-1">
                          <span className="text-secondary">Default</span>
                          {prefix && <span aria-hidden="true">{prefix}</span>}
                          <TargetField label={`Default: ${name}`} value={entry.defaultTarget} allowMax={allowMax} onChange={(v) => patchEntry(index, { defaultTarget: v })} />
                          {entry.goal.type === 'refine' && <span className="text-xs text-secondary">steps</span>}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-secondary">Allowed</span>
                          <TargetField label={`Allowed from: ${name}`} value={entry.bounds.min} allowMax={allowMax} onChange={(v) => patchEntry(index, { bounds: { ...entry.bounds, min: v } })} />
                          <span aria-hidden="true">–</span>
                          <TargetField label={`Allowed to: ${name}`} value={entry.bounds.max} allowMax={allowMax} onChange={(v) => patchEntry(index, { bounds: { ...entry.bounds, max: v } })} />
                        </span>
                        <span className="flex gap-1">
                          <IconButton label={`Move up: ${name}`} disabled={index === 0} onClick={() => setList(moveGoal(rows, index, -1))}>▲</IconButton>
                          <IconButton label={`Move down: ${name}`} disabled={index === rows.length - 1} onClick={() => setList(moveGoal(rows, index, 1))}>▼</IconButton>
                          <IconButton label={`Remove: ${name}`} onClick={() => setList(removeGoal(rows, index))}>✕</IconButton>
                        </span>
                      </div>
                      {errors.map((m) => <FieldError key={m}>{m}</FieldError>)}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field label="Add goal">
                  {(props) => (
                    <select {...props} className={INPUT_CLASS} value={addChoice} onChange={(e) => setAddChoice(e.target.value)}>
                      {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  )}
                </Field>
                <ActionButton
                  onClick={() => {
                    const choice = choices.find((c) => c.value === addChoice);
                    if (choice) setList(addGoal(rows, choice.goal, nextId.current++));
                  }}
                >
                  Add goal
                </ActionButton>
              </div>
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {warning && warning.length > 0 && <Notice>{upgradeWarningText(warning)}</Notice>}
            {exported && (
              <Notice tone="success">
                Exported {exported.fileName}. Ask a developer to run <code>pnpm run automaton:unpack</code> and open a pull request; the strategy appears here after it is merged and deployed.
              </Notice>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <ActionButton variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete draft</ActionButton>
              <div className="flex flex-col gap-2 sm:flex-row">
                <ActionButton disabled={busy} onClick={() => void save()}>Save draft</ActionButton>
                <ActionButton variant="primary" disabled={exportDisabled} aria-describedby={exportHelp ? exportHelpId : undefined} onClick={() => void exportFile()}>
                  Export strategy file
                </ActionButton>
              </div>
            </div>
            {exportHelp && <p id={exportHelpId} className="text-xs text-secondary">{exportHelp}</p>}
          </div>
        </Card>
        <DraftPreviewPanel draftId={draft.id} profiles={profiles} disabled={dirty} />
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete draft"
          message={`Delete draft "${draft.definition.displayName || draft.definition.key}"? This cannot be undone.`}
          confirmLabel="Delete draft"
          destructive
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
