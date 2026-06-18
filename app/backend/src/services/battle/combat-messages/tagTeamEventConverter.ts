/**
 * Tag Team & Battle Event Converters
 * Handles convertTagTeamEvents (mixed raw + narrative) and
 * convertBattleEvents (convenience wrapper for 1v1 orchestrators).
 */

import { CombatEvent } from '../combatSimulator';
import { NarrativeEvent } from '../../../types/battleLogTypes';
import {
  generateBattleStart,
  generateBattleEnd,
} from './messageGenerators';
import { convertSimulatorEvents } from './eventConverter';
import type { BattleStartEvent, BattleEndEvent } from '../combatMessageGenerator';

// ── Tag Team Event Converter ──────────────────────────────────────────

export interface TagTeamContext {
  team1Name: string;
  team2Name: string;
  battleType: 'tag_team';
  robot3Name?: string; // team1 reserve
  robot4Name?: string; // team2 reserve
  phases: Array<{
    robot1Name: string;
    robot2Name: string;
    robot1Stance: string;
    robot2Stance: string;
    robot1MaxHP: number;
    robot2MaxHP: number;
  }>;
}

/**
 * Convert a tag team battle's mixed event array into fully narrative events.
 * Raw simulator events get processed per-phase; tag_out/tag_in events pass through.
 */
export function convertTagTeamEvents(
  mixedEvents: Array<{ timestamp: number; type: string; [key: string]: unknown }>,
  context: TagTeamContext
): NarrativeEvent[] {
  const narrativeEvents: NarrativeEvent[] = [];
  let currentPhase = 0;
  let phaseEvents: CombatEvent[] = [];

  for (const event of mixedEvents) {
    // Tag events are already narrative - pass through
    if (event.type === 'tag_out' || event.type === 'tag_in') {
      // First, flush any accumulated phase events
      if (phaseEvents.length > 0 && currentPhase < context.phases.length) {
        const phase = context.phases[currentPhase];
        const converted = convertSimulatorEvents(phaseEvents, {
          robot1Name: phase.robot1Name,
          robot2Name: phase.robot2Name,
          robot1Stance: phase.robot1Stance,
          robot2Stance: phase.robot2Stance,
          robot1MaxHP: phase.robot1MaxHP,
          robot2MaxHP: phase.robot2MaxHP,
          robot1ELO: 0,
          robot2ELO: 0,
          leagueType: '',
          battleType: 'tag_team',
          team1Name: context.team1Name,
          team2Name: context.team2Name,
          robot3Name: context.robot3Name,
          robot4Name: context.robot4Name,
          skipBattleStart: currentPhase > 0,
        });
        narrativeEvents.push(...converted);
        phaseEvents = [];
        currentPhase++;
      }
      narrativeEvents.push(event as NarrativeEvent);
      continue;
    }

    // Raw simulator event - accumulate for phase conversion
    phaseEvents.push(event as unknown as CombatEvent);
  }

  // Flush remaining phase events
  if (phaseEvents.length > 0 && currentPhase < context.phases.length) {
    const phase = context.phases[currentPhase];
    const converted = convertSimulatorEvents(phaseEvents, {
      robot1Name: phase.robot1Name,
      robot2Name: phase.robot2Name,
      robot1Stance: phase.robot1Stance,
      robot2Stance: phase.robot2Stance,
      robot1MaxHP: phase.robot1MaxHP,
      robot2MaxHP: phase.robot2MaxHP,
      robot1ELO: 0,
      robot2ELO: 0,
      leagueType: '',
      battleType: 'tag_team',
      team1Name: context.team1Name,
      team2Name: context.team2Name,
      robot3Name: context.robot3Name,
      robot4Name: context.robot4Name,
      skipBattleStart: currentPhase > 0,
    });
    narrativeEvents.push(...converted);
  }

  return narrativeEvents;
}

// ── Generic Battle Event Converter (convenience wrapper) ──────────────

export interface BattleEventData {
  robot1Name: string;
  robot2Name: string;
  robot1ELOBefore: number;
  robot2ELOBefore: number;
  robot1ELOAfter: number;
  robot2ELOAfter: number;
  winnerName: string;
  loserName: string;
  winnerFinalHP: number;
  winnerMaxHP: number;
  loserFinalHP: number;
  robot1DamageDealt: number;
  robot2DamageDealt: number;
  leagueType: string;
  durationSeconds: number;
  robot1Reward?: number;
  robot2Reward?: number;
  robot1Prestige?: number;
  robot2Prestige?: number;
  robot1Fame?: number;
  robot2Fame?: number;
  // Real event conversion fields
  simulatorEvents?: CombatEvent[];
  robot1Stance?: string;
  robot2Stance?: string;
  robot1MaxHP?: number;
  robot2MaxHP?: number;
  battleType?: 'league_1v1' | 'tournament_1v1' | 'tag_team' | 'koth';
}

/**
 * Convert battle data into narrative events.
 * If real simulator events are provided, converts them through the full pipeline.
 * Otherwise falls back to a minimal battle_start + battle_end log (bye matches, etc.).
 */
export function convertBattleEvents(battleData: BattleEventData): NarrativeEvent[] {
  // If real simulator events are provided, convert them
  if (battleData.simulatorEvents && battleData.simulatorEvents.length > 0) {
    return convertSimulatorEvents(battleData.simulatorEvents, {
      robot1Name: battleData.robot1Name,
      robot2Name: battleData.robot2Name,
      robot1Stance: battleData.robot1Stance || 'balanced',
      robot2Stance: battleData.robot2Stance || 'balanced',
      robot1MaxHP: battleData.robot1MaxHP || battleData.winnerMaxHP,
      robot2MaxHP: battleData.robot2MaxHP || battleData.winnerMaxHP,
      robot1ELO: battleData.robot1ELOBefore,
      robot2ELO: battleData.robot2ELOBefore,
      leagueType: battleData.leagueType,
      battleType: battleData.battleType,
    });
  }

  // Fallback: generate minimal log without real events (bye matches, etc.)
  const log: NarrativeEvent[] = [];
  log.push({
    timestamp: 0.0,
    type: 'battle_start',
    message: generateBattleStart({
      robot1Name: battleData.robot1Name,
      robot2Name: battleData.robot2Name,
      robot1ELO: battleData.robot1ELOBefore,
      robot2ELO: battleData.robot2ELOBefore,
      leagueType: battleData.leagueType,
      battleType: battleData.battleType,
    } as BattleStartEvent & { battleType?: 'league_1v1' | 'tournament_1v1' | 'tag_team' | 'koth' }),
  });

  log.push({
    timestamp: battleData.durationSeconds,
    type: 'battle_end',
    message: generateBattleEnd({
      winnerName: battleData.winnerName,
      loserName: battleData.loserName,
      winnerHP: battleData.winnerFinalHP,
      winnerMaxHP: battleData.winnerMaxHP,
      reason: 'destruction',
    } as BattleEndEvent),
  });

  return log;
}
