import path from 'node:path';

import { getConfig } from '../src/config/env';
import prisma from '../src/lib/prisma';
import { collectFinancialIntegrityIssues } from '../src/services/common/financialIntegrityDiagnostics';
import {
  activateRequiredCapture,
  getFinancialRolloutState,
  getMissingRolloutGates,
  markBlockingTestsPassed,
  markDocumentationComplete,
  markReconciliationComplete,
  markSchemaClientGenerationComplete,
  markWriterManifestComplete,
  recordAccCutover,
} from '../src/services/migration/financialRollout';
import { runFinancialRolloutCli } from '../src/services/migration/financialRolloutCli';

async function main(): Promise<void> {
  const exitCode = await runFinancialRolloutCli(process.argv.slice(2), {
    config: getConfig(),
    getRolloutState: getFinancialRolloutState,
    getMissingRolloutGates,
    markSchemaClientGenerationComplete,
    markWriterManifestComplete,
    markBlockingTestsPassed,
    activateRequiredCapture,
    recordAccCutover,
    markReconciliationComplete,
    markDocumentationComplete,
    getCurrentCycle: async (): Promise<number | null> => {
      const cycle = await prisma.cycleMetadata.findUnique({
        where: { id: 1 },
        select: { totalCycles: true },
      });
      return cycle?.totalCycles ?? null;
    },
    collectFinancialIntegrityIssues: (cycleNumber, state) =>
      collectFinancialIntegrityIssues(cycleNumber, state, path.resolve(__dirname, '../..')),
    disconnect: (): Promise<void> => prisma.$disconnect(),
    writeStdout: (message: string): void => process.stdout.write(`${message}\n`),
    writeStderr: (message: string): void => process.stderr.write(`${message}\n`),
  });
  process.exitCode = exitCode;
}

void main();
