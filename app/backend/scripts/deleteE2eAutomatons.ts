/**
 * Playwright teardown for the Spec #55 e2e Automaton stables (decision 43).
 *
 *   pnpm exec tsx scripts/deleteE2eAutomatons.ts
 *
 * `admin-automatons.spec.ts` and `automaton-badge.spec.ts` create Automaton
 * stables whose Catalogue_Key starts with `e2e-automaton`. Left behind, their
 * `automaton_profiles` rows (RESTRICT on the user) make integration suites that
 * delete users wholesale fail on the same local database. The `admin-teardown`
 * Playwright project runs this after both specs, so the verification gate
 * passes whichever tier runs first.
 *
 * Deletes, per stable and in one transaction: standings, battle participants and
 * team members of its robots (no FK or RESTRICT keys), the profile, then the
 * user (the rest cascades), as `deleteGeneratedStables` does. Refuses to run
 * unless DATABASE_URL points at this machine, so it can never touch ACC or PRD.
 */
import prisma from '../src/lib/prisma';

const E2E_CATALOGUE_KEY_PREFIX = 'e2e-automaton';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function assertLocalDatabase(url: string | undefined): void {
  if (!url) throw new Error('DATABASE_URL is not set');
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`refusing to delete e2e Automatons on non-local database host "${host}"`);
  }
}

async function deleteE2eAutomatons(): Promise<{ stables: number; drafts: number }> {
  const profiles = await prisma.automatonProfile.findMany({
    where: { catalogueKey: { startsWith: E2E_CATALOGUE_KEY_PREFIX } },
    select: { id: true, catalogueKey: true, userId: true },
  });
  // `startsWith` is a SQL LIKE prefix; re-check the exact prefix in code.
  const own = profiles.filter((p) => p.catalogueKey.startsWith(E2E_CATALOGUE_KEY_PREFIX));

  let stables = 0;
  let drafts = 0;
  for (const profile of own) {
    await prisma.$transaction(async (tx) => {
      if (profile.userId === null) {
        await tx.automatonProfile.delete({ where: { id: profile.id } });
        drafts++;
        return;
      }
      const userId = profile.userId;
      const robotIds = (await tx.robot.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id);
      const teamIds = (await tx.teamBattle.findMany({ where: { stableId: userId }, select: { id: true } })).map((t) => t.id);
      if (robotIds.length > 0) {
        await tx.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
        await tx.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
        await tx.teamBattleMember.deleteMany({ where: { robotId: { in: robotIds } } });
      }
      if (teamIds.length > 0) {
        await tx.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teamIds } } });
      }
      await tx.automatonProfile.delete({ where: { id: profile.id } });
      await tx.user.delete({ where: { id: userId } });
      stables++;
    }, { timeout: 120_000 });
  }
  return { stables, drafts };
}

Promise.resolve()
  .then(() => assertLocalDatabase(process.env.DATABASE_URL))
  .then(deleteE2eAutomatons)
  .then(({ stables, drafts }) => {
    process.stdout.write(`Deleted ${stables} e2e Automaton stables and ${drafts} drafts.\n`);
  })
  .catch((error: unknown) => {
    process.stderr.write(`e2e Automaton cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
