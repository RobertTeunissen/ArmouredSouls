/**
 * One-off: convert the three-robot AverageBot / ExpertBot generated stables to
 * WimpBot stables, keeping their match results (`generatedStableConversion.ts`).
 *
 *   pnpm exec tsx scripts/convertGeneratedStablesToWimpBot.ts --dry-run
 *   pnpm exec tsx scripts/convertGeneratedStablesToWimpBot.ts
 *
 * The dry run prints every change and writes nothing; the plan is deterministic,
 * so the real run writes exactly what the dry run printed. Run it between
 * cycles, never while a battle job or settlement is running, and take a database
 * backup first. Remove this script and the module once the ACC run is done.
 */
import prisma from '../src/lib/prisma';
import { applyWimpBotConversion, planWimpBotConversion, type ConversionPlan } from '../src/utils/generatedStableConversion';

function printPlan(plan: ConversionPlan): void {
  const out = (line: string): void => void process.stdout.write(`${line}\n`);
  for (const stable of plan.stables) {
    out(`${stable.oldUsername} -> ${stable.newUsername}  (${stable.stableName ?? 'no stable name'}, user ${stable.userId})`);
    for (const robot of stable.robots) {
      const offhand = robot.offhand ? `, offhand ${robot.offhand.from} -> ${robot.offhand.to}` : '';
      out(`  #${robot.robotId} ${robot.oldName} -> ${robot.newName}  [main ${robot.main.from} -> ${robot.main.to}${offhand}]`);
    }
  }
  const robots = plan.stables.reduce((n, s) => n + s.robots.length, 0);
  out(`\n${plan.stables.length} stables, ${robots} robots to convert to WimpBot.`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const plan = await planWimpBotConversion();
  printPlan(plan);
  if (dryRun) {
    process.stdout.write('Dry run: nothing written.\n');
    return;
  }
  const converted = await applyWimpBotConversion(plan);
  process.stdout.write(`Converted ${converted} stables.\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Conversion failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
