/**
 * Battle export (`GET /api/admin/battles/:id/export`): the text for "Copy for
 * analysis" and the complete JSON record for "Download JSON".
 */
import prisma from '../../../lib/prisma';
import { loadBattleDetailBundle } from './battleDetailService';
import { combatEventsOf, loadStoredLog } from './battleLogAccess';
import { buildBattleExportText } from './battleExportText';

export async function exportBattleText(battleId: number): Promise<string> {
  const [{ detail, ledgerEntries }, stored] = await Promise.all([
    loadBattleDetailBundle(battleId),
    loadStoredLog(battleId),
  ]);
  return buildBattleExportText(detail, combatEventsOf(stored.log), ledgerEntries);
}

export interface BattleExportJson {
  exportedAt: string;
  detail: Awaited<ReturnType<typeof loadBattleDetailBundle>>['detail'];
  ledgerEntries: Awaited<ReturnType<typeof loadBattleDetailBundle>>['ledgerEntries'];
  summary: unknown;
  battleLog: Record<string, unknown> | null;
}

export async function exportBattleJson(battleId: number): Promise<BattleExportJson> {
  const [{ detail, ledgerEntries }, stored, summary] = await Promise.all([
    loadBattleDetailBundle(battleId),
    loadStoredLog(battleId),
    prisma.battleSummary.findUnique({ where: { battleId } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    detail,
    ledgerEntries,
    summary,
    battleLog: stored.log,
  };
}
