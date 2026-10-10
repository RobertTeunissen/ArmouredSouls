/**
 * Editor — Robot_Blueprint editor (Spec #55, R3.2–R3.4, R3.9–R3.12,
 * PLAYER_FACING_TEXT §6.5, design §15.1 and §17.2, task 10.3): one collapsible
 * card per Blueprint_Slot with name, image upload, Build_Focus, loadout,
 * stance, yield threshold, the Weapon_Path builder (one column per hand,
 * weapons limited to the loadout, derived range per stage) and the
 * Refinement_Plan steps of the last stage in plan order. No event ordering:
 * the Event_Order belongs to the stable. The backend validates every rule;
 * its messages are listed under the blueprint.
 */
import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import type {
  BlueprintFields,
  BuildFocusOption,
  CatalogueWeapon,
  Hand,
  LoadoutType,
  RefinementStep,
  RefinementTierKey,
  Stance,
  WeaponStage,
} from '../../../utils/automatonAdminApi';
import { REQUIRED_WORKSHOP_LEVELS } from '@shared/utils/weaponRefinement';
import { ROBOT_ATTRIBUTES } from '@shared/utils/robotAttributes';
import { canEquipToSlot } from '@shared/utils/weaponSlots';
import { formatAttributeName } from '../../weapon-refinement/attributeFormat';
import { blueprintHeader, refinementStepCosts, type BlueprintEditorItem } from './blueprintState';
import { ActionButton, Field, FieldError, FOCUS_RING, IconButton, INPUT_CLASS } from './ui';
import {
  HAND_LABELS,
  LOADOUT_LABELS,
  STANCE_LABELS,
  TIER_LABELS,
  formatCredits,
  stageCost,
  stageRangeText,
} from './automatonText';

export const MAX_WEAPON_STAGES = 4;
export const MAX_REFINEMENT_STEPS_PER_WEAPON = 5;
export const MAX_YIELD_THRESHOLD = 50;

export interface BlueprintEditorProps {
  item: BlueprintEditorItem;
  weapons: ReadonlyMap<string, CatalogueWeapon>;
  buildFocusOptions: BuildFocusOption[];
  expanded: boolean;
  errors: string[];
  uploading: boolean;
  onToggle: () => void;
  onChange: (fields: BlueprintFields) => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
}

const NEEDS_OFFHAND: ReadonlySet<LoadoutType> = new Set<LoadoutType>(['weapon_shield', 'dual_wield']);
const TIERS: readonly RefinementTierKey[] = ['sharpen', 'forge', 'hone', 'augment'];

function weaponOptions(weapons: ReadonlyMap<string, CatalogueWeapon>, hand: Hand, loadout: LoadoutType): CatalogueWeapon[] {
  return [...weapons.values()]
    .filter((w) => canEquipToSlot(w, hand, loadout).canEquip)
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}

function stepTargetText(step: RefinementStep): string {
  if (step.tier === 'sharpen') return '−10% cooldown';
  if (step.tier === 'forge') return '+8% damage';
  return `${step.targetAttribute ? formatAttributeName(step.targetAttribute) : '—'} +${step.magnitude}`;
}

export function BlueprintEditor({ item, weapons, buildFocusOptions, expanded, errors, uploading, onToggle, onChange, onDelete, onUpload }: BlueprintEditorProps): ReactNode {
  const fileRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const f = item.fields;
  const header = blueprintHeader(item, weapons);
  const hasOffhand = NEEDS_OFFHAND.has(f.loadoutType);
  const offhandLabel = f.loadoutType === 'weapon_shield' ? 'Shield' : 'Off hand';
  const lastStage = f.weaponPath[f.weaponPath.length - 1];
  const stepCosts = refinementStepCosts(f.refinementPlan);
  const set = (patch: Partial<BlueprintFields>): void => onChange({ ...f, ...patch });

  const setStage = (index: number, patch: Partial<WeaponStage>): void => {
    const weaponPath = f.weaponPath.map((stage, i) => {
      if (i !== index) return stage;
      const next: WeaponStage = { ...stage, ...patch };
      if (!hasOffhand || !next.offhand) delete next.offhand;
      return next;
    });
    set({ weaponPath });
  };

  const setLoadout = (loadoutType: LoadoutType): void => {
    const keepsOffhand = NEEDS_OFFHAND.has(loadoutType);
    set({
      loadoutType,
      weaponPath: f.weaponPath.map((stage) => (keepsOffhand ? { ...stage } : { main: stage.main })),
      refinementPlan: keepsOffhand ? f.refinementPlan : f.refinementPlan.filter((s) => s.hand === 'main'),
    });
  };

  const setStep = (index: number, patch: Partial<RefinementStep>): void => {
    set({
      refinementPlan: f.refinementPlan.map((step, i) => {
        if (i !== index) return step;
        const next: RefinementStep = { ...step, ...patch };
        if (next.tier === 'sharpen' || next.tier === 'forge') {
          delete next.targetAttribute;
          next.magnitude = 1;
        } else if (!next.targetAttribute) {
          next.targetAttribute = ROBOT_ATTRIBUTES[0];
        }
        return next;
      }),
    });
  };

  const moveStep = (index: number, delta: -1 | 1): void => {
    const plan = [...f.refinementPlan];
    const target = index + delta;
    if (target < 0 || target >= plan.length) return;
    [plan[index], plan[target]] = [plan[target], plan[index]];
    set({ refinementPlan: plan });
  };

  const weaponOfHand = (hand: Hand): string => (hand === 'main' ? lastStage?.main : lastStage?.offhand) ?? '—';

  return (
    <div className="rounded-lg border border-white/10 bg-background">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex w-full min-h-11 items-center gap-3 p-3 text-left ${FOCUS_RING}`}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
        ) : (
          <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded bg-white/10" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-white">{header.title}</span>
          <span className="block text-xs text-secondary">{header.summary}</span>
        </span>
        <span aria-hidden="true" className="text-secondary">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div id={panelId} className="space-y-4 border-t border-white/10 p-3">
          {item.liveRobot && (
            <p className="rounded-md border border-amber-500/30 bg-amber-900/20 p-2 text-sm text-amber-100">
              A robot built from this blueprint is in play. Its name will not change; other changes apply from the next settlement. This blueprint cannot be deleted while the robot exists.
            </p>
          )}
          {errors.length > 0 && (
            <ul className="space-y-1">
              {errors.map((message) => <li key={message}><FieldError>{message}</FieldError></li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="danger" disabled={item.liveRobot !== null} onClick={onDelete} title={item.liveRobot ? 'Disabled while a robot built from it is in play.' : undefined}>
              Delete blueprint
            </ActionButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Robot name" help="Used when this robot is next bought. Renaming does not rename a robot that already exists.">
              {(props) => <input {...props} className={INPUT_CLASS} value={f.robotName} maxLength={50} onChange={(e) => set({ robotName: e.target.value })} />}
            </Field>
            <div className="min-w-0">
              <p className="block text-sm font-medium text-white mb-1">Image</p>
              <div className="flex items-center gap-2">
                {item.imageUrl && <img src={item.imageUrl} alt={`Image of ${f.robotName}`} className="h-11 w-11 rounded object-cover" />}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-label={`Upload image: ${item.slot} ${f.robotName}`}
                  tabIndex={-1}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file);
                    e.target.value = '';
                  }}
                />
                <ActionButton disabled={item.pending || uploading} onClick={() => fileRef.current?.click()}>Upload image</ActionButton>
              </div>
              <p className="mt-1 text-xs text-secondary">512×512 image. Changes apply to the live robot straight away.</p>
            </div>
            <Field label="Build focus" help="How this robot spends attribute upgrades and tuning.">
              {(props) => (
                <select {...props} className={INPUT_CLASS} value={f.buildFocus} onChange={(e) => set({ buildFocus: e.target.value as BlueprintFields['buildFocus'] })}>
                  {buildFocusOptions.map((o) => <option key={o.key} value={o.key}>{o.displayName}</option>)}
                </select>
              )}
            </Field>
            <Field label="Loadout">
              {(props) => (
                <select {...props} className={INPUT_CLASS} value={f.loadoutType} onChange={(e) => setLoadout(e.target.value as LoadoutType)}>
                  {(Object.keys(LOADOUT_LABELS) as LoadoutType[]).map((l) => <option key={l} value={l}>{LOADOUT_LABELS[l]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Stance">
              {(props) => (
                <select {...props} className={INPUT_CLASS} value={f.stance} onChange={(e) => set({ stance: e.target.value as Stance })}>
                  {(Object.keys(STANCE_LABELS) as Stance[]).map((s) => <option key={s} value={s}>{STANCE_LABELS[s]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Yield threshold">
              {(props) => (
                <input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_YIELD_THRESHOLD}
                  className={INPUT_CLASS}
                  value={f.yieldThreshold}
                  onChange={(e) => set({ yieldThreshold: Number(e.target.value) })}
                />
              )}
            </Field>
          </div>

          <div className="min-w-0">
            <p className="block text-sm font-medium text-white mb-1">Weapon path</p>
            <p className="mb-2 text-xs text-secondary">
              Weapons this robot buys, in order. One column per hand: Main hand, and Shield or Off hand when the loadout has one. Both hands may hold different weapons.
            </p>
            <ol className="space-y-2">
              {f.weaponPath.map((stage, index) => (
                <li key={index} className="grid grid-cols-1 md:grid-cols-[4rem_1fr_1fr_minmax(8rem,1fr)_7rem] gap-2 items-center rounded-md border border-white/10 p-2 text-sm">
                  <span className="text-secondary">Stage {index}{index === f.weaponPath.length - 1 ? ' · final' : ''}</span>
                  <select
                    aria-label={`Main hand, stage ${index}`}
                    className={INPUT_CLASS}
                    value={stage.main}
                    onChange={(e) => setStage(index, { main: e.target.value })}
                  >
                    <option value="">—</option>
                    {weaponOptions(weapons, 'main', f.loadoutType).map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
                  </select>
                  {hasOffhand ? (
                    <select
                      aria-label={`${offhandLabel}, stage ${index}`}
                      className={INPUT_CLASS}
                      value={stage.offhand ?? ''}
                      onChange={(e) => setStage(index, { offhand: e.target.value || undefined })}
                    >
                      <option value="">—</option>
                      {weaponOptions(weapons, 'offhand', f.loadoutType).map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
                    </select>
                  ) : (
                    <span className="hidden md:block" />
                  )}
                  <span><span className="md:hidden text-secondary">Range </span>{stageRangeText(stage, f.loadoutType, weapons)}</span>
                  <span><span className="md:hidden text-secondary">Cost </span>{formatCredits(stageCost(f.weaponPath, index, weapons))}</span>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex flex-wrap gap-2">
              <ActionButton
                disabled={f.weaponPath.length >= MAX_WEAPON_STAGES}
                onClick={() => set({ weaponPath: [...f.weaponPath, { ...f.weaponPath[f.weaponPath.length - 1] }] })}
              >
                Add stage
              </ActionButton>
              <ActionButton
                disabled={f.weaponPath.length <= 1}
                onClick={() => set({ weaponPath: f.weaponPath.slice(0, -1) })}
              >
                Remove last stage
              </ActionButton>
            </div>
          </div>

          <div className="min-w-0">
            <p className="block text-sm font-medium text-white mb-1">Refinement plan</p>
            <p className="mb-2 text-xs text-secondary">
              Applied in order to the weapons of the last stage; at most 5 steps per weapon.
            </p>
            {f.refinementPlan.length > 0 && (
              <ol className="space-y-2">
                {f.refinementPlan.map((step, index) => {
                  const label = `${index + 1} ${weaponOfHand(step.hand)} (${HAND_LABELS[step.hand]})`;
                  return (
                    <li key={index} className="grid grid-cols-1 md:grid-cols-[2rem_1fr_8rem_1fr_6rem_7rem_auto] gap-2 items-center rounded-md border border-white/10 p-2 text-sm">
                      <span className="text-secondary">{index + 1}</span>
                      <select
                        aria-label={`Weapon, step ${index + 1}`}
                        className={INPUT_CLASS}
                        value={step.hand}
                        onChange={(e) => setStep(index, { hand: e.target.value as Hand })}
                      >
                        <option value="main">{weaponOfHand('main')} (main)</option>
                        {hasOffhand && <option value="offhand">{weaponOfHand('offhand')} (off)</option>}
                      </select>
                      <select
                        aria-label={`Tier, step ${index + 1}`}
                        className={INPUT_CLASS}
                        value={step.tier}
                        onChange={(e) => setStep(index, { tier: e.target.value as RefinementTierKey })}
                      >
                        {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
                      </select>
                      {step.tier === 'hone' || step.tier === 'augment' ? (
                        <span className="flex gap-2">
                          <select
                            aria-label={`Attribute, step ${index + 1}`}
                            className={INPUT_CLASS}
                            value={step.targetAttribute ?? ''}
                            onChange={(e) => setStep(index, { targetAttribute: e.target.value })}
                          >
                            {ROBOT_ATTRIBUTES.map((a) => <option key={a} value={a}>{formatAttributeName(a)}</option>)}
                          </select>
                          <select
                            aria-label={`Magnitude, step ${index + 1}`}
                            className={`${INPUT_CLASS} w-20`}
                            value={step.magnitude}
                            onChange={(e) => setStep(index, { magnitude: Number(e.target.value) })}
                          >
                            {[1, 2, 3, 4, 5].map((m) => <option key={m} value={m}>+{m}</option>)}
                          </select>
                        </span>
                      ) : (
                        <span>{stepTargetText(step)}</span>
                      )}
                      <span>{formatCredits(stepCosts[index])}</span>
                      <span className="text-secondary">needs Workshop L{REQUIRED_WORKSHOP_LEVELS[step.tier]}</span>
                      <span className="flex gap-1">
                        <IconButton label={`Move up: ${label}`} disabled={index === 0} onClick={() => moveStep(index, -1)}>▲</IconButton>
                        <IconButton label={`Move down: ${label}`} disabled={index === f.refinementPlan.length - 1} onClick={() => moveStep(index, 1)}>▼</IconButton>
                        <IconButton label={`Remove: ${label}`} onClick={() => set({ refinementPlan: f.refinementPlan.filter((_, i) => i !== index) })}>✕</IconButton>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="mt-2">
              <ActionButton
                disabled={f.refinementPlan.length >= MAX_REFINEMENT_STEPS_PER_WEAPON * (hasOffhand ? 2 : 1)}
                onClick={() => set({ refinementPlan: [...f.refinementPlan, { tier: 'sharpen', hand: 'main', magnitude: 1 }] })}
              >
                Add refinement step
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
