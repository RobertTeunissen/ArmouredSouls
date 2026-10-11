/**
 * Catalogue tab (Spec #55, R10.5, R10.7, PLAYER_FACING_TEXT §6.7, task 10.2):
 * the last Catalogue_Sync summary with its conflicts, and Catalogue_Export of
 * one stable or all stables as a file.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  downloadJson,
  exportCatalogue,
  getSyncStatus,
  type CatalogueSyncSummary,
  type ProfileListItem,
} from '../../../utils/automatonAdminApi';
import { ActionButton, Field, INPUT_CLASS, Notice } from './ui';
import { errorText } from './requestErrors';
import { formatDateTime } from './automatonText';

export interface CatalogueTabProps {
  profiles: ProfileListItem[];
  /** The stable open in the Editor, the default for "Export this stable". */
  selectedKey: string | null;
}

export function CatalogueTab({ profiles, selectedKey }: CatalogueTabProps): ReactNode {
  const [summary, setSummary] = useState<CatalogueSyncSummary | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string>(selectedKey ?? '');
  const exportKey = chosen || selectedKey || profiles[0]?.catalogueKey || '';

  useEffect(() => {
    let cancelled = false;
    getSyncStatus()
      .then((r) => { if (!cancelled) setSummary(r.summary); })
      .catch((err: unknown) => { if (!cancelled) { setSummary(null); setError(errorText(err, 'The sync status could not be loaded.')); } });
    return () => { cancelled = true; };
  }, []);

  const runExport = async (keys: string[]): Promise<void> => {
    setError(null);
    try {
      const name = keys.length === 1 ? `automaton-catalogue-${keys[0]}.json` : 'automaton-catalogue-export.json';
      downloadJson(name, await exportCatalogue(keys));
    } catch (err) {
      setError(errorText(err, 'The export failed.'));
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h3 className="text-base font-semibold text-white">Catalogue</h3>
        <p className="text-sm text-secondary max-w-3xl">
          Catalogue files in the repository are added here as drafts on every deploy. Existing stables are never overwritten. Use Export to turn stables built here into catalogue files.
        </p>
      </div>
      {summary === undefined ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : summary === null ? (
        <p className="text-sm text-secondary">Last sync: Never</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-white">
            <b>Last sync: {formatDateTime(summary.ranAt)}</b>
            <span className="text-secondary"> · Added {summary.added.length} · Already present {summary.present.length} · Images filled {summary.filled.length} · Conflicts {summary.conflicts.length}</span>
          </p>
          {summary.conflicts.map((c) => (
            <p key={c.catalogueKey} className="text-amber-200">
              <code>{c.catalogueKey}</code>: stable name &quot;{c.stableName}&quot; is already taken. Skipped.
            </p>
          ))}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="md:w-80">
          <Field label="Stable">
            {(props) => (
              <select {...props} className={INPUT_CLASS} value={exportKey} onChange={(e) => setChosen(e.target.value)}>
                {profiles.map((p) => <option key={p.catalogueKey} value={p.catalogueKey}>{p.stableName}</option>)}
              </select>
            )}
          </Field>
        </div>
        <ActionButton className="w-full md:w-auto" disabled={!exportKey} onClick={() => void runExport([exportKey])}>Export this stable</ActionButton>
        <ActionButton className="w-full md:w-auto" disabled={profiles.length === 0} onClick={() => void runExport([])}>Export all</ActionButton>
      </div>
    </div>
  );
}
