/**
 * Display text of the admin Automatons page (Spec #55, task 10.5).
 *
 * Every string here is the approved text of
 * `.kiro/specs/.../55-automaton-stables/review/PLAYER_FACING_TEXT.md` §6 or a
 * label of a backend value. Pure functions only, so the components stay
 * focused on rendering and the formatting is unit-tested.
 */
import type {
  AttributeGroup,
  BlockedReason,
  BuildFocusKey,
  BuildOrderDescriptor,
  CatalogueWeapon,
  GoalDetail,
  GoalType,
  LeagueTier,
  LibraryStrategy,
  LoadoutType,
  NeedAttentionReason,
  PreviewAction,
  PreviewGoal,
  ProfileListItem,
  RefinementTierKey,
  Stance,
  TargetBounds,
  TurnStatus,
  TurnTrigger,
  UpgradeConfirmation,
  UpgradeWarningEntry,
  WeaponStage,
} from '../../../utils/automatonAdminApi';

// ── Labels ───────────────────────────────────────────────────────────

/** The 9 subscribable event types in their approved labels (§6.5 Event order). */
export const EVENT_LABELS: Readonly<Record<string, string>> = {
  league_1v1: '1v1 League',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
  tag_team: 'Tag Team',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
  tournament_1v1: '1v1 Tournament',
  tournament_2v2: '2v2 Tournament',
  tournament_3v3: '3v3 Tournament',
};

/** Facility names as the facilities page shows them (`config/facilities.ts`). */
export const FACILITY_LABELS: Readonly<Record<string, string>> = {
  repair_bay: 'Repair Bay',
  training_facility: 'Training Facility',
  weapons_workshop: 'Weapons Workshop',
  roster_expansion: 'Roster Expansion',
  storage_facility: 'Storage Facility',
  booking_office: 'Booking Office',
  combat_training_academy: 'Combat Training Academy',
  defense_training_academy: 'Defense Training Academy',
  mobility_training_academy: 'Mobility Training Academy',
  ai_training_academy: 'AI Training Academy',
  merchandising_hub: 'Merchandising Hub',
  streaming_studio: 'Streaming Studio',
  tuning_bay: 'Tuning Bay',
};

/** Facility types a Strategy_Builder facility Goal can target (academies are bought by attributes Goals). */
export const BUILDER_FACILITY_TYPES: readonly string[] = [
  'repair_bay',
  'training_facility',
  'weapons_workshop',
  'roster_expansion',
  'storage_facility',
  'booking_office',
  'merchandising_hub',
  'streaming_studio',
  'tuning_bay',
];

export const LOADOUT_LABELS: Readonly<Record<LoadoutType, string>> = {
  single: 'Single',
  weapon_shield: 'Weapon + shield',
  dual_wield: 'Dual wield',
  two_handed: 'Two-handed',
};

export const STANCE_LABELS: Readonly<Record<Stance, string>> = {
  offensive: 'offensive',
  defensive: 'defensive',
  balanced: 'balanced',
};

export const GROUP_LABELS: Readonly<Record<AttributeGroup, string>> = {
  combat: 'Combat',
  defense: 'Defense',
  mobility: 'Mobility',
  ai: 'AI',
};

export const TIER_LABELS: Readonly<Record<RefinementTierKey, string>> = {
  hone: 'Hone',
  augment: 'Augment',
  sharpen: 'Sharpen',
  forge: 'Forge',
};

export const HAND_LABELS = { main: 'main', offhand: 'off' } as const;

/** Build_Focus display names (`review/STRATEGIES.md` §3). */
export const BUILD_FOCUS_NAMES: Readonly<Record<BuildFocusKey, string>> = {
  bruiser: 'Bruiser',
  deadeye: 'Deadeye',
  warden: 'Warden',
  sprinter: 'Sprinter',
  tactician: 'Tactician',
  versatile: 'Versatile',
};

export const GOAL_TYPE_LABELS: Readonly<Record<GoalType, string>> = {
  robots: 'Robots',
  facility: 'Facility',
  attributes: 'Attributes',
  weapons: 'Weapons',
  refine: 'Refine',
};

export function facilityLabel(facilityType: string | undefined): string {
  return facilityType ? FACILITY_LABELS[facilityType] ?? facilityType : 'Facility';
}

export function tierLabel(tier: LeagueTier | null | undefined): string {
  return tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : '—';
}

// ── Numbers ──────────────────────────────────────────────────────────

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/** ₡412,000 / −₡12,400. */
export function formatCredits(value: number): string {
  const rounded = Math.round(value);
  return `${rounded < 0 ? '−' : ''}₡${NUMBER.format(Math.abs(rounded))}`;
}

/** "8 Oct, 00:01". */
export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}, ${time}`;
}

/** "8 Oct 2026, 14:02". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}, ${time}`;
}

export function formatSeconds(ms: number | null): string {
  return ms === null ? '—' : `${Math.max(0, Math.round(ms / 1000))} s`;
}

// ── Turn_Trigger labels (§6.2, §6.5 Cycle history) ───────────────────

/** Status bar: Cycle {n} · Prep {n} · Season start. */
export function turnStepLabel(trigger: TurnTrigger, slot: number): string {
  if (trigger === 'preparation') return `Prep ${slot}`;
  if (trigger === 'season_open') return 'Season start';
  return `Cycle ${slot}`;
}

/** Cycle history column: {n} · Prep {n} · Season start. */
export function cycleColumnLabel(trigger: TurnTrigger, slot: number): string {
  return trigger === 'settlement' ? String(slot) : turnStepLabel(trigger, slot);
}

/** Cycle status labels (§6.6): Completed · Skipped (Automatons stopped) · Failed — with the error code. */
export function turnStatusLabel(status: TurnStatus, reason: string | null): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'skipped':
      return reason === 'program_off' || reason === null ? 'Skipped (Automatons stopped)' : `Skipped (${reason})`;
    case 'failed':
      return reason ? `Failed — ${reason}` : 'Failed';
    case 'in_progress':
      return 'In progress';
  }
}

// ── Goal targets and bounds ──────────────────────────────────────────

type GoalLike = Pick<BuildOrderDescriptor, 'type' | 'isMax'> & { label: string };

/** A Goal_Target as shown in a target column: 3 · L3 · Max · final · 8 steps. */
export function targetText(goal: Pick<GoalLike, 'type' | 'isMax'>, target: number): string {
  if (goal.isMax) return 'Max';
  switch (goal.type) {
    case 'facility':
      return `L${target}`;
    case 'weapons':
      return target >= 3 ? 'final' : String(target);
    case 'refine':
      return `${target} steps`;
    default:
      return String(target);
  }
}

/** Allowed range: 1–3 · L0–L6 · Max · 0–3 · 0–10. */
export function boundsText(goal: Pick<GoalLike, 'type' | 'isMax'>, bounds: TargetBounds): string {
  if (goal.isMax) return 'Max';
  if (goal.type === 'facility') return `L${bounds.min}–L${bounds.max}`;
  return bounds.min === bounds.max ? String(bounds.min) : `${bounds.min}–${bounds.max}`;
}

/** A Goal with its target: "Booking Office L3", "Robots → 4", "Attributes → Max", "Refine → 8 steps". */
export function goalWithTarget(goal: GoalLike, target: number): string {
  if (goal.type === 'facility') return `${goal.label} L${target}`;
  return `${goal.label} → ${targetText(goal, target)}`;
}

// ── Build order statuses (§6.6) ──────────────────────────────────────

export const STATUS_LABELS: Readonly<Record<PreviewGoal['status'], string>> = {
  done: 'Done',
  bought: 'Bought',
  saving: 'Saving',
  blocked: 'Blocked',
  waiting: 'Waiting',
};

/** "{facility} L{n} needs {p} prestige (has {q})". */
function prestigeText(detail: GoalDetail, withHeld: boolean): string {
  const facility = facilityLabel(typeof detail.facilityType === 'string' ? detail.facilityType : undefined);
  const required = typeof detail.prestigeRequired === 'number' ? formatNumber(detail.prestigeRequired) : String(detail.prestigeRequired ?? '');
  const held = typeof detail.prestigeHeld === 'number' ? formatNumber(detail.prestigeHeld) : String(detail.prestigeHeld ?? '');
  const base = `${facility} L${detail.level ?? ''} needs ${required} prestige`;
  return withHeld ? `${base} (has ${held})` : base;
}

/** Blocked reasons of §6.6. */
export function blockedReasonText(reason: BlockedReason | undefined, detail: GoalDetail): string {
  switch (reason) {
    case 'prestige_gate':
      return prestigeText(detail, true);
    case 'max_level':
      return 'facility at max level';
    case 'roster_limit':
      return 'roster full';
    case 'no_blueprint':
      return `no blueprint for robot ${detail.slotIndex ?? ''}`.trim();
    case 'awaiting_final_weapon':
      return 'waiting for final weapon';
    case 'storage_limit':
      return 'storage full at Storage Facility L10, nothing to sell';
    case 'name_unavailable':
      return `no free name for robot ${detail.slotIndex ?? ''}`.trim();
    default:
      return '';
  }
}

/** Facility levels a Goal bought in the preview: "L1 and L2", "L2". */
function boughtLevels(goal: PreviewGoal, actions: readonly PreviewAction[]): string {
  const levels = actions
    .filter((a) => a.goalId === goal.goalId && a.kind === 'facility_upgrade' && typeof a.detail.toLevel === 'number')
    .map((a) => `L${a.detail.toLevel}`);
  if (levels.length <= 1) return levels.join('');
  return `${levels.slice(0, -1).join(', ')} and ${levels[levels.length - 1]}`;
}

/** The detail next to a status: what was bought, what it saves for, why it is blocked. */
export function statusDetailText(goal: PreviewGoal, actions: readonly PreviewAction[]): string {
  const bought = goal.bought.steps > 0
    ? (goal.type === 'facility' && boughtLevels(goal, actions)
      ? `Bought ${goal.label} ${boughtLevels(goal, actions)} for ${formatCredits(goal.bought.cost)}`
      : `Bought ${goal.bought.steps} for ${formatCredits(goal.bought.cost)}`)
    : '';
  switch (goal.status) {
    case 'done':
      return '';
    case 'bought':
      return bought;
    case 'saving': {
      const saving = `needs ${formatCredits(goal.needed ?? 0)}, has ${formatCredits(goal.available ?? 0)}`;
      return bought ? `${bought} · ${saving}` : saving;
    }
    case 'blocked':
      return blockedReasonText(goal.reason, goal.detail);
    case 'waiting':
      return goal.gated ? `will be blocked when reached: ${prestigeText(goal.detail, false)}` : '';
  }
}

/** "Gated further down: goal {n} ({facility} L{l}) … — each needs {p} prestige." or null. */
export function gatedFurtherDownText(goals: readonly PreviewGoal[]): string | null {
  const gated = goals.filter((g) => g.status === 'waiting' && g.gated);
  if (gated.length === 0) return null;
  const parts = gated.map((g) => `goal ${g.position} (${facilityLabel(String(g.detail.facilityType ?? ''))} L${g.detail.level ?? ''})`);
  const prestige = [...new Set(gated.map((g) => (typeof g.detail.prestigeRequired === 'number' ? formatNumber(g.detail.prestigeRequired) : '')))].filter(Boolean);
  return `Gated further down: ${parts.join(', ')} — each needs ${prestige.join(' or ')} prestige.`;
}

/** One line of the "Next cycle" list. */
export function previewActionText(action: PreviewAction, goal: PreviewGoal | undefined): string {
  const name = goal ? goalWithTarget(goal, goal.target) : `Goal ${action.position}`;
  const prefix = `Goal ${action.position} · ${name}`;
  switch (action.kind) {
    case 'facility_upgrade':
      return `Goal ${action.position} · ${facilityLabel(String(action.detail.facilityType ?? ''))} L${action.detail.toLevel ?? ''} for ${formatCredits(action.cost)}`;
    case 'attribute_upgrade':
      return `${prefix}: ${action.detail.levels ?? 0} upgrades for ${formatCredits(action.cost)}`;
    case 'robot_chain':
      return `${prefix}: ${action.detail.robotName ?? `robot ${action.detail.slot ?? ''}`} for ${formatCredits(action.cost)}`;
    case 'weapon_stage':
      return `${prefix}: robot ${action.detail.slot ?? ''} to stage ${action.detail.toStage ?? ''} for ${formatCredits(action.cost)}`;
    case 'weapon_refinement':
      return `${prefix}: ${String(action.detail.tier ?? '')} on robot ${action.detail.slot ?? ''} for ${formatCredits(action.cost)}`;
  }
}

// ── Stables tab ──────────────────────────────────────────────────────

/** Last cycle column: "Bought 1 · saving for Booking Office L2", "Bought 3", "Not active yet". */
export function lastCycleText(item: Pick<ProfileListItem, 'status' | 'lastTurn'>): string {
  if (item.status === 'draft') return 'Not active yet';
  const turn = item.lastTurn;
  if (!turn) return '—';
  if (turn.status !== 'completed') return turnStatusLabel(turn.status, turn.reason);
  const saving = turn.savingGoal && turn.savingGoal.label !== null && turn.savingGoal.target !== null
    ? savingGoalText(turn.savingGoal.label, turn.savingGoal.target)
    : null;
  if (turn.actionCount > 0) return saving ? `Bought ${turn.actionCount} · saving for ${saving}` : `Bought ${turn.actionCount}`;
  return saving ? `Saving for ${saving}` : 'Bought nothing';
}

export function savingGoalText(label: string, target: number): string {
  const isFacility = Object.values(FACILITY_LABELS).includes(label);
  if (isFacility) return `${label} L${target}`;
  if (label === 'Robots') return `Robot ${target}`;
  return `${label} → ${target}`;
}

export function needAttentionText(reasons: readonly NeedAttentionReason[]): string {
  return reasons.length === 0 ? '—' : reasons.map((r) => r.label).join(' · ');
}

// ── Weapon path ──────────────────────────────────────────────────────

/** Damage per second as the arena's range preference weighs it. */
function dps(weapon: Pick<CatalogueWeapon, 'baseDamage' | 'cooldown'>): number {
  return weapon.baseDamage / Math.max(weapon.cooldown, 1);
}

/**
 * Range of one Weapon_Stage (§6.5 Blueprint: range): "{range}", or for two
 * different weapons "{range} ({weapon} has the higher damage per second)", or
 * on a tie "{range} (equal damage per second; the main hand decides)". A
 * shield never sets the range.
 */
export function stageRangeText(stage: WeaponStage, loadout: LoadoutType, weapons: ReadonlyMap<string, CatalogueWeapon>): string {
  const main = weapons.get(stage.main);
  if (!main) return '—';
  const off = loadout === 'dual_wield' && stage.offhand ? weapons.get(stage.offhand) : undefined;
  if (!off || off.name === main.name || off.rangeBand === main.rangeBand) return main.rangeBand;
  const mainDps = dps(main);
  const offDps = dps(off);
  if (mainDps === offDps) return `${main.rangeBand} (equal damage per second; the main hand decides)`;
  const higher = mainDps > offDps ? main : off;
  return `${higher.rangeBand} (${higher.name} has the higher damage per second)`;
}

/** Short range of a stage for blueprint headers. */
export function stageRangeBand(stage: WeaponStage | undefined, loadout: LoadoutType, weapons: ReadonlyMap<string, CatalogueWeapon>): string {
  if (!stage) return '—';
  return stageRangeText(stage, loadout, weapons).split(' ')[0];
}

/**
 * Credits a stage costs: the weapons of hands that change against the
 * previous stage ("A hand that does not change keeps its weapon and costs
 * nothing"). List prices, before the Workshop discount.
 */
export function stageCost(path: readonly WeaponStage[], index: number, weapons: ReadonlyMap<string, CatalogueWeapon>): number {
  const stage = path[index];
  const previous = index > 0 ? path[index - 1] : undefined;
  let cost = 0;
  if (stage.main && stage.main !== previous?.main) cost += weapons.get(stage.main)?.cost ?? 0;
  if (stage.offhand && stage.offhand !== previous?.offhand) cost += weapons.get(stage.offhand)?.cost ?? 0;
  return cost;
}

// ── Validation and strategy messages ─────────────────────────────────

/** "Allowed {min}–{max}" when the target is outside its bounds or not a whole number. */
export function targetError(row: Pick<BuildOrderDescriptor, 'bounds' | 'isMax' | 'type'>, value: number): string | null {
  if (row.isMax) return null;
  if (!Number.isInteger(value) || value < row.bounds.min || value > row.bounds.max) return `Allowed ${boundsText(row, row.bounds)}`;
  return null;
}

/** True when a stable is pinned to a version below the latest. */
export function hasUpgradableStables(strategy: LibraryStrategy): boolean {
  return strategy.versions.some((v) => v.version < strategy.latestVersion && v.profileCount > 0);
}

/** "These stables could not be upgraded to this version yet: {stable} ({error}) · … Fix them in the Editor before you upgrade." */
export function upgradeWarningText(entries: readonly UpgradeWarningEntry[]): string {
  return `These stables could not be upgraded to this version yet: ${entries.map((e) => `${e.stableName} (${e.reason})`).join(' · ')} Fix them in the Editor before you upgrade.`;
}

/** "Upgraded {n} stables to v{v}." plus the stables that were not upgraded. */
export function upgradeResultText(result: UpgradeConfirmation): string {
  const done = `Upgraded ${result.upgraded.length} stables to v${result.toVersion}.`;
  if (result.rejected.length === 0) return done;
  return `${done} Not upgraded: ${result.rejected.map((r) => `${r.stableName} (${r.reason})`).join(' · ')}`;
}
