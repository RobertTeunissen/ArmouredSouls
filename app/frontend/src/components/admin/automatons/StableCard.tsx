/**
 * Editor — Stable card (Spec #55, R3.5, R3.8, R6.4, PLAYER_FACING_TEXT §6.5,
 * task 10.3): catalogue key (read-only), stable name, franchise, Backstory
 * with a live 400-character count, strategy select and the Event_Order
 * control. Two columns at ≥ 1024 px, one column from 320 px to 1023 px.
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { LibraryStrategy } from '../../../utils/automatonAdminApi';
import { Card, Field, FieldHelp, INPUT_CLASS } from './ui';
import { EventOrderList } from './EventOrderList';

export const BACKSTORY_MAX_LENGTH = 400;

export interface StableCardValues {
  stableName: string;
  franchise: string;
  backstory: string;
  strategyKey: string;
  eventOrder: string[];
}

export interface StableCardProps {
  catalogueKey: string;
  values: StableCardValues;
  /** The pinned Strategy_Version of the saved profile. */
  pinned: { key: string; version: number; displayName: string | null; latestVersion: number | null };
  strategies: LibraryStrategy[];
  errors?: Partial<Record<keyof StableCardValues, string>>;
  onChange: (patch: Partial<StableCardValues>) => void;
}

export function StableCard({ catalogueKey, values, pinned, strategies, errors = {}, onChange }: StableCardProps): ReactNode {
  const eventLabelId = useId();
  const eventHelpId = useId();
  const options = strategies.map((s) => ({
    key: s.key,
    label: s.key === pinned.key ? `${pinned.displayName ?? s.displayName} · v${pinned.version}` : `${s.displayName} · v${s.latestVersion}`,
  }));
  if (!options.some((o) => o.key === pinned.key)) {
    options.unshift({ key: pinned.key, label: `${pinned.displayName ?? pinned.key} · v${pinned.version}` });
  }
  const newer = values.strategyKey === pinned.key && pinned.latestVersion !== null && pinned.latestVersion > pinned.version
    ? pinned.latestVersion
    : null;

  return (
    <Card title="Stable">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Field label="Catalogue key" help="Permanent identifier used for export and sync. Lowercase letters, digits and hyphens. Cannot be changed later.">
          {(props) => <input {...props} className={`${INPUT_CLASS} opacity-80`} value={catalogueKey} readOnly />}
        </Field>
        <Field label="Stable name" help="Shown to players. Same rules as player stable names." error={errors.stableName}>
          {(props) => (
            <input {...props} className={INPUT_CLASS} value={values.stableName} maxLength={30} onChange={(e) => onChange({ stableName: e.target.value })} />
          )}
        </Field>
        <Field label="Franchise" help="Admin only. Used to group stables here; not shown to players." error={errors.franchise}>
          {(props) => (
            <input {...props} className={INPUT_CLASS} value={values.franchise} maxLength={60} onChange={(e) => onChange({ franchise: e.target.value })} />
          )}
        </Field>
        <Field
          label="Strategy"
          help={(
            <>
              How this stable spends its credits.
              {newer !== null && <span className="ml-1 text-amber-200">v{newer} available — upgrade in the Strategy library</span>}
            </>
          )}
          error={errors.strategyKey}
        >
          {(props) => (
            <select {...props} className={INPUT_CLASS} value={values.strategyKey} onChange={(e) => onChange({ strategyKey: e.target.value })}>
              {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          )}
        </Field>
        <div className="lg:col-span-2">
          <Field
            label="Backstory"
            help={`Admin only for now; not shown to players. Up to 400 characters · ${values.backstory.length} / ${BACKSTORY_MAX_LENGTH}`}
            error={errors.backstory ?? (values.backstory.length > BACKSTORY_MAX_LENGTH ? 'Up to 400 characters.' : null)}
          >
            {(props) => (
              <textarea {...props} rows={4} className={INPUT_CLASS} value={values.backstory} onChange={(e) => onChange({ backstory: e.target.value })} />
            )}
          </Field>
        </div>
        <div className="lg:col-span-2 min-w-0">
          <p id={eventLabelId} className="block text-sm font-medium text-white mb-1">Event order</p>
          <EventOrderList value={values.eventOrder} labelledBy={eventLabelId} onChange={(eventOrder) => onChange({ eventOrder })} />
          <FieldHelp id={eventHelpId}>All 9 event types in order of preference. Team events are entered by a whole team or not at all.</FieldHelp>
        </div>
      </div>
    </Card>
  );
}
