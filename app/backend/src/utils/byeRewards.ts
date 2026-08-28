/**
 * Bye_Reward_Calculator — the single declaration of what a Bye_Event pays.
 *
 * A bye is what a subscribed robot gets when the schedule has nothing for it to
 * fight. Before Spec #49 five orchestrators answered that question four
 * different ways, disagreeing by up to eighteen-fold. This module is the only
 * declaration of the amounts, for all nine modes.
 *
 * The unifying rule is the Participation_Floor: a bye pays the participation
 * floor of the mode it occurred in, at that mode's own scale, and nothing else.
 * Credits only — never prestige, fame or streaming revenue.
 *
 * Backend-only by decision (Spec #49). The shared-formula rule in
 * .kiro/steering/coding-standards.md applies to formulas the Frontend also
 * evaluates; the Frontend reads persisted `battle_participants.credits`
 * (Spec #50) and never computes a bye reward.
 *
 * MOVE THIS TO app/shared/utils/ if a Frontend surface ever needs to *predict* a
 * bye reward before the bye resolves. That move must also relocate
 * getParticipationReward and calculateTournamentParticipationReward, because
 * this module must never restate either formula.
 *
 * @module utils/byeRewards
 */

import { StandingsMode } from '../../generated/prisma';
import { getParticipationReward } from './economyFormulas';
import { calculateTournamentParticipationReward } from './tournamentRewards';

// ─── Mode identifiers ────────────────────────────────────────────────────────

/** The six modes whose bye pays a fraction of a tier base. */
export type TierScaledByeMode =
  | 'league_1v1'
  | 'tag_team'
  | 'league_2v2'
  | 'league_3v3'
  | 'koth'
  | 'grand_melee';

/** The three modes whose bye pays a flat round loss reward. */
export type TournamentByeMode = 'tournament_1v1' | 'tournament_2v2' | 'tournament_3v3';

/** All nine modes that can produce a Bye_Event. */
export type ByeMode = TierScaledByeMode | TournamentByeMode;

// ─── The Bye_Mode_Table ──────────────────────────────────────────────────────

/** How the real side of a Bye_Event is resolved from the queued match. */
export type ByeEntitySource = 'robot' | 'team' | 'tournament_participant';

export interface ByeModeSpec {
  /** Which Participation_Floor arm this mode reads. */
  floor: 'tier_scaled' | 'tournament_round_loss';
  /** Robots on the real side. The only multiplier applied to the floor. */
  teamSize: 1 | 2 | 3;
  /** LP delta a bye in this mode applies. Unchanged from pre-Spec #49 behaviour. */
  lpDelta: number;
  /** How the writer resolves the real participants. */
  entitySource: ByeEntitySource;
  /** Standing to write, or null for modes where a bye touches no Standing. */
  standingMode: StandingsMode | null;
  /** Whether `robots.elo` moves. False wherever there is no opponent to rate against. */
  updatesElo: boolean;
}

/**
 * Bye_Mode_Table — exhaustive by construction.
 *
 * A tenth member of `ByeMode` fails to compile here until its bye reward is
 * declared. Same construct `EVENT_SCHEDULE_SCOPES` uses in
 * `services/scheduling/eventScheduleScope.ts` for the same reason.
 */
export const BYE_MODE_SPECS: Record<ByeMode, ByeModeSpec> = {
  league_1v1: {
    floor: 'tier_scaled',
    teamSize: 1,
    lpDelta: 3,
    entitySource: 'robot',
    standingMode: 'league_1v1',
    updatesElo: true,
  },
  tag_team: {
    floor: 'tier_scaled',
    teamSize: 2,
    lpDelta: 3,
    entitySource: 'team',
    standingMode: 'tag_team',
    updatesElo: true,
  },
  league_2v2: {
    floor: 'tier_scaled',
    teamSize: 2,
    lpDelta: 3,
    entitySource: 'team',
    standingMode: 'league_2v2',
    updatesElo: true,
  },
  league_3v3: {
    floor: 'tier_scaled',
    teamSize: 3,
    lpDelta: 3,
    entitySource: 'team',
    standingMode: 'league_3v3',
    updatesElo: true,
  },
  // A Placement_Mode bye produces no placement, so crediting a finishing
  // position for a match that never ran would read as a win the robot did not
  // earn. No LP, no Standing write, no ELO — by not calling, not by zeroes.
  koth: {
    floor: 'tier_scaled',
    teamSize: 1,
    lpDelta: 0,
    entitySource: 'robot',
    standingMode: null,
    updatesElo: false,
  },
  grand_melee: {
    floor: 'tier_scaled',
    teamSize: 1,
    lpDelta: 0,
    entitySource: 'robot',
    standingMode: null,
    updatesElo: false,
  },
  // Tournament byes leave Standing untouched, as they always have. The bye pays
  // what a loss pays for that round; advancement is the rest of the reward.
  tournament_1v1: {
    floor: 'tournament_round_loss',
    teamSize: 1,
    lpDelta: 0,
    entitySource: 'tournament_participant',
    standingMode: null,
    updatesElo: false,
  },
  tournament_2v2: {
    floor: 'tournament_round_loss',
    teamSize: 2,
    lpDelta: 0,
    entitySource: 'tournament_participant',
    standingMode: null,
    updatesElo: false,
  },
  tournament_3v3: {
    floor: 'tournament_round_loss',
    teamSize: 3,
    lpDelta: 0,
    entitySource: 'tournament_participant',
    standingMode: null,
    updatesElo: false,
  },
};

/** Every mode identifier, for iteration in callers and tests. */
export const BYE_MODES = Object.keys(BYE_MODE_SPECS) as ByeMode[];

/** The six Tier_Scaled_Modes, for iteration. */
export const TIER_SCALED_BYE_MODES = BYE_MODES.filter(
  (m): m is TierScaledByeMode => BYE_MODE_SPECS[m].floor === 'tier_scaled',
);

/** The three Tournament_Modes, for iteration. */
export const TOURNAMENT_BYE_MODES = BYE_MODES.filter(
  (m): m is TournamentByeMode => BYE_MODE_SPECS[m].floor === 'tournament_round_loss',
);

// ─── Input and output ────────────────────────────────────────────────────────

/**
 * Discriminated so a Tournament_Mode bye cannot be constructed without round
 * context, and a Tier_Scaled_Mode bye cannot be constructed without a tier.
 */
export type ByeRewardInput =
  | { mode: TierScaledByeMode; tier: string }
  | {
      mode: TournamentByeMode;
      totalParticipants: number;
      currentRound: number;
      maxRounds: number;
    };

export interface ByeReward {
  /** Total credits paid to the stable. Always > 0. */
  credits: number;
  /** Always 0 — a bye earns no prestige, in any mode. */
  prestige: 0;
  /** Always 0 — a bye earns no fame, in any mode. */
  fame: 0;
  /** Always 0 — preserved by the isByeMatch guard in battlePostCombat. */
  streamingRevenue: 0;
  /** LP delta to apply. 0 for Placement_Modes and Tournament_Modes. */
  lpDelta: number;
  /** Robots on the real side. The × factor is already folded into `credits`. */
  teamSize: 1 | 2 | 3;
  /** Per-robot floor before the teamSize factor — for logs and assertions. */
  perRobotCredits: number;
}

/**
 * Resolve what a Bye_Event pays.
 *
 * Neither floor formula is restated here: the tier-scaled arm calls
 * `getParticipationReward` and the tournament arm calls
 * `calculateTournamentParticipationReward`, so a bye and a loss cannot drift
 * apart.
 */
export function resolveByeReward(input: ByeRewardInput): ByeReward {
  const spec = BYE_MODE_SPECS[input.mode];

  const perRobotCredits =
    spec.floor === 'tier_scaled'
      ? getParticipationReward((input as { tier: string }).tier)
      : calculateTournamentParticipationReward(
          (input as { totalParticipants: number }).totalParticipants,
          (input as { currentRound: number }).currentRound,
          (input as { maxRounds: number }).maxRounds,
        );

  return {
    credits: perRobotCredits * spec.teamSize,
    prestige: 0,
    fame: 0,
    streamingRevenue: 0,
    lpDelta: spec.lpDelta,
    teamSize: spec.teamSize,
    perRobotCredits,
  };
}
