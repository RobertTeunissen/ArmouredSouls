import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AttributeInfo } from './AttributeInfo';
import { Stepper } from './Stepper';
import { ROBOT_ATTRIBUTE_DESCRIPTIONS } from '../../utils/robotAttributeDescriptions';
import {
  ATTRIBUTE_CATEGORIES,
  categoryCap,
  formatValue,
  inBattle,
  levelOf,
  plannedLevelOf,
  tuningMaxAt,
  type AcademyLevels,
  type AttributeCategory,
  type AttributeDef,
  type AttributeValues,
  type TuningMap,
  type UpgradePlan,
} from '../../utils/workshopBuild';
import type { RobotAttributeKey } from '../../types/robot';

export interface BuildTableProps {
  values: AttributeValues;
  academyLevels: AcademyLevels;
  plan: UpgradePlan;
  tuning: TuningMap;
  savedTuning: TuningMap;
  tuningRemaining: number;
  bonuses: Record<string, number>;
  loadoutType: string;
  stance: string;
  onSetLevel: (key: RobotAttributeKey, level: number) => void;
  onMaxAttribute: (key: RobotAttributeKey) => void;
  onMaxCategory: (keys: readonly RobotAttributeKey[]) => void;
  onTuningChange: (key: RobotAttributeKey, value: number) => void;
}

/** Grid shared by the column header and every row on wide screens. */
/** Inline label shown before a control on small screens, where there is no column header. */
const MOBILE_LABEL = 'w-12 shrink-0 text-[11px] text-secondary lg:hidden';

const ROW_GRID = 'lg:grid lg:grid-cols-[minmax(0,1.6fr)_3.5rem_9.5rem_6.5rem_8rem_4rem_6rem_6rem] lg:items-center lg:gap-3';

/**
 * One row per attribute: level (bought with credits, capped by the academy),
 * tuning (free this season) and the value in battle. A category whose
 * attributes are all at cap folds to one line.
 */
export function BuildTable(props: BuildTableProps) {
  return (
    <div>
      <div className={`hidden border-b border-white/10 pb-2 text-[11px] uppercase tracking-wide text-secondary ${ROW_GRID}`} aria-hidden="true">
        <span>Attribute</span><span>Level</span><span>Upgrade to</span><span className="text-right">Cost</span>
        <span>Tuning</span><span>Max</span><span>Base + tuning</span><span className="text-right">In battle</span>
      </div>
      <div className="space-y-5 pt-3">
        {ATTRIBUTE_CATEGORIES.map((category) => (
          <CategoryBlock key={category.id} category={category} {...props} />
        ))}
      </div>
    </div>
  );
}

/**
 * One academy category. Every category can be hidden to a one-line summary;
 * a category with all attributes at cap starts hidden. "Max group" plans the
 * category's attributes toward cap with the credits the rest of the plan leaves.
 */
function CategoryBlock({ category, ...props }: BuildTableProps & { category: AttributeCategory }) {
  const { values, academyLevels, plan, tuning, onMaxCategory } = props;
  const cap = categoryCap(category, academyLevels);
  const academyLevel = academyLevels[category.academy] ?? 0;
  const keys = category.attributes.map(({ key }) => key);
  const atCapCount = keys.filter((key) => levelOf(values, key) >= cap).length;
  const allAtCap = atCapCount === keys.length;
  const canMax = keys.some((key) => plannedLevelOf(plan, values, key) < cap);
  const plannedCost = keys.reduce((sum, key) => sum + (plan[key]?.cost ?? 0), 0);
  const [open, setOpen] = useState(!allAtCap);
  const tuned = keys.map((key) => tuning[key] ?? 0);
  const sameTuning = tuned.every((t) => t === tuned[0]);
  const headingId = `cat-${category.id}`;

  const controls = (
    <span className="ml-auto flex items-center gap-1">
      {!allAtCap && (
        <button
          type="button"
          onClick={() => onMaxCategory(keys)}
          disabled={!canMax}
          className="min-h-[44px] rounded px-2 text-xs font-semibold text-primary hover:underline disabled:opacity-30 lg:min-h-0"
          aria-label={`Upgrade all ${category.label} as far as credits allow`}
        >
          Max group
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="min-h-[44px] px-2 text-xs text-primary hover:underline lg:min-h-0"
        aria-expanded={open}
        aria-label={`${open ? 'Hide' : 'Show'} ${category.label}`}
      >
        {open ? 'Hide' : 'Show'}
      </button>
    </span>
  );

  if (!open) {
    return (
      <section aria-labelledby={headingId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface-elevated px-3 py-1.5">
        <h4 id={headingId} className="text-sm font-semibold">
          <span aria-hidden="true">{category.icon} </span>{category.label}
        </h4>
        <span className="text-xs text-secondary">
          {allAtCap ? `All ${keys.length}` : `${atCapCount} of ${keys.length}`} at cap {cap}
          {sameTuning ? (tuned[0] > 0 ? ` · tuned +${formatValue(tuned[0])} each` : ' · not tuned') : ' · tuned'}
          {plannedCost > 0 && <> · <span className="font-semibold text-white">₡{plannedCost.toLocaleString()} planned</span></>}
          {allAtCap && <>{' · '}<Link to="/facilities" className="text-primary hover:underline">raise the cap</Link></>}
        </span>
        {controls}
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4 id={headingId} className="text-sm font-semibold">
          <span aria-hidden="true">{category.icon} </span>{category.label}
        </h4>
        <span className="text-xs text-secondary">cap {cap} · {category.academyLabel} {academyLevel}</span>
        {controls}
      </div>
      <ul className="space-y-1.5">
        {category.attributes.map((attr) => (
          <AttributeRow key={attr.key} attr={attr} cap={cap} {...props} />
        ))}
      </ul>
    </section>
  );
}

function AttributeRow({ attr, cap, ...props }: BuildTableProps & { attr: AttributeDef; cap: number }) {
  const { values, plan, tuning, savedTuning, tuningRemaining, bonuses, loadoutType, stance, onSetLevel, onMaxAttribute, onTuningChange } = props;
  const { key, label, icon } = attr;
  const base = Number(values[key]);
  const current = levelOf(values, key);
  const planned = plannedLevelOf(plan, values, key);
  const entry = plan[key];
  const upgrading = planned > current;
  const allocated = tuning[key] ?? 0;
  const maxNow = tuningMaxAt(cap, base);
  const maxPlanned = tuningMaxAt(cap, upgrading ? planned : base);
  const tuningOver = allocated > maxPlanned;
  const plannedBase = upgrading ? planned : base;
  const before = inBattle(base, savedTuning[key] ?? 0, bonuses, key, loadoutType, stance);
  const after = inBattle(plannedBase, Math.min(allocated, maxPlanned), bonuses, key, loadoutType, stance);
  const changed = upgrading || allocated !== (savedTuning[key] ?? 0);
  const atCap = current >= cap;

  return (
    <li
      className={`flex flex-col gap-1.5 rounded-md px-3 py-2.5 ${ROW_GRID} ${changed ? 'border border-primary/30 bg-primary/5' : 'border border-transparent bg-white/[0.02]'}`}
      data-testid={`build-row-${key}`}
    >
      <AttributeInfo
        ariaLabel={`${label}, level ${current} of ${cap}`}
        description={ROBOT_ATTRIBUTE_DESCRIPTIONS[key]}
        className="flex min-w-0 items-center gap-2"
      >
        <span aria-hidden="true">{icon}</span>
        <span className="truncate text-sm">{label}</span>
        <span className="ml-auto text-xs text-secondary lg:hidden">Level {current} / {cap}</span>
      </AttributeInfo>

      <span className="hidden text-sm tabular-nums lg:block">{current}</span>

      {/* On small screens each control shares a line with its value; lg:contents hands both cells to the row grid. */}
      <div className="flex items-center justify-between gap-2 lg:contents">
      <span className="flex items-center gap-1.5 lg:gap-2">
        <span className={MOBILE_LABEL}>Upgrade</span>
        {atCap ? (
          <span className="text-xs text-tertiary">at cap</span>
        ) : (
          <>
            <Stepper
              label={`${label} level`}
              value={String(planned)}
              changed={upgrading}
              canDecrement={upgrading}
              canIncrement={planned < cap}
              onDecrement={() => onSetLevel(key, planned - 1)}
              onIncrement={() => onSetLevel(key, planned + 1)}
            />
            <button
              type="button"
              onClick={() => onMaxAttribute(key)}
              disabled={planned >= cap}
              className="min-h-[44px] rounded px-1.5 text-[11px] font-semibold text-primary hover:underline disabled:opacity-30 lg:min-h-0"
              aria-label={`Upgrade ${label} as far as credits allow`}
            >
              Max
            </button>
          </>
        )}
      </span>

      <span className={`text-right text-sm tabular-nums ${upgrading ? 'font-semibold' : 'text-tertiary'}`}>
        {upgrading && entry ? `₡${entry.cost.toLocaleString()}` : '—'}
      </span>
      </div>

      <div className="flex items-center justify-between gap-2 lg:contents">
      <span className="flex items-center gap-1.5 lg:gap-2">
        <span className={MOBILE_LABEL}>Tuning</span>
        <Stepper
          label={`${label} tuning`}
          value={formatValue(allocated)}
          changed={allocated !== (savedTuning[key] ?? 0)}
          canDecrement={allocated > 0}
          canIncrement={allocated < maxPlanned && tuningRemaining > 0}
          onDecrement={() => onTuningChange(key, Math.max(0, allocated - 1))}
          onIncrement={() => onTuningChange(key, Math.min(maxPlanned, allocated + Math.min(1, tuningRemaining)))}
        />
      </span>

      <span className="text-right text-sm tabular-nums lg:text-left">
        <span className="text-xs text-secondary lg:hidden">max </span>
        {maxPlanned !== maxNow ? (
          <span><span className="text-secondary">{formatValue(maxNow)}</span> → <span className={tuningOver ? 'text-error' : 'text-warning'}>{formatValue(maxPlanned)}</span></span>
        ) : (
          <span className="text-secondary">{formatValue(maxNow)}</span>
        )}
      </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-1.5 lg:contents">
      <span className="text-sm tabular-nums">
        <span className="text-xs text-secondary lg:hidden">Base + tuning </span>
        {changed ? (
          <span><span className="text-secondary">{formatValue(before.baseAndTuning)}</span> → <span className="font-bold text-success">{formatValue(after.baseAndTuning)}</span></span>
        ) : (
          <span className="font-semibold">{formatValue(before.baseAndTuning)}</span>
        )}
      </span>

      <span
        className="text-right text-sm tabular-nums"
        title={`Weapons +${formatValue(after.weapon)}, loadout ${Math.round(after.loadout * 100)}%, stance ${Math.round(after.stance * 100)}%`}
      >
        <span className="text-xs text-secondary lg:hidden">In battle </span>
        {changed && after.total !== before.total ? (
          <span><span className="text-secondary">{before.total.toFixed(1)}</span> → <span className="text-success">{after.total.toFixed(1)}</span></span>
        ) : (
          before.total.toFixed(1)
        )}
      </span>
      </div>
      {tuningOver && (
        <p className="text-xs text-error lg:col-span-8" role="note">
          Upgrading lowers this attribute&apos;s tuning room to {formatValue(maxPlanned)}; {formatValue(allocated - maxPlanned)} tuning will be removed when you save.
        </p>
      )}
    </li>
  );
}

export default BuildTable;
