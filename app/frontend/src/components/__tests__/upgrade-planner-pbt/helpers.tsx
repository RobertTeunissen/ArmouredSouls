import { render } from '@testing-library/react';
import UpgradePlanner from '../../UpgradePlanner';

export interface RobotOverrides {
  combatPower?: number;
  targetingSystems?: number;
  armorPlating?: number;
}

export interface RenderOptions {
  robot?: RobotOverrides;
  currentCredits?: number;
  trainingLevel?: number;
  workshopLevel?: number;
  academyLevels?: {
    combat_training_academy?: number;
    defense_training_academy?: number;
    mobility_training_academy?: number;
    ai_training_academy?: number;
  };
}

const DEFAULT_ATTRIBUTE_LEVEL = 10;

export function createRobot(overrides: RobotOverrides = {}): Record<string, number> {
  return {
    id: 1,
    combatPower: overrides.combatPower ?? DEFAULT_ATTRIBUTE_LEVEL,
    targetingSystems: overrides.targetingSystems ?? DEFAULT_ATTRIBUTE_LEVEL,
    armorPlating: overrides.armorPlating ?? DEFAULT_ATTRIBUTE_LEVEL,
    criticalSystems: DEFAULT_ATTRIBUTE_LEVEL,
    penetration: DEFAULT_ATTRIBUTE_LEVEL,
    weaponControl: DEFAULT_ATTRIBUTE_LEVEL,
    attackSpeed: DEFAULT_ATTRIBUTE_LEVEL,
    shieldCapacity: DEFAULT_ATTRIBUTE_LEVEL,
    evasionThrusters: DEFAULT_ATTRIBUTE_LEVEL,
    damageDampeners: DEFAULT_ATTRIBUTE_LEVEL,
    counterProtocols: DEFAULT_ATTRIBUTE_LEVEL,
    hullIntegrity: DEFAULT_ATTRIBUTE_LEVEL,
    servoMotors: DEFAULT_ATTRIBUTE_LEVEL,
    gyroStabilizers: DEFAULT_ATTRIBUTE_LEVEL,
    hydraulicSystems: DEFAULT_ATTRIBUTE_LEVEL,
    powerCore: DEFAULT_ATTRIBUTE_LEVEL,
    combatAlgorithms: DEFAULT_ATTRIBUTE_LEVEL,
    threatAnalysis: DEFAULT_ATTRIBUTE_LEVEL,
    adaptiveAI: DEFAULT_ATTRIBUTE_LEVEL,
    logicCores: DEFAULT_ATTRIBUTE_LEVEL,
    syncProtocols: DEFAULT_ATTRIBUTE_LEVEL,
    supportSystems: DEFAULT_ATTRIBUTE_LEVEL,
    formationTactics: DEFAULT_ATTRIBUTE_LEVEL,
  };
}

const DEFAULT_ACADEMY_LEVELS = {
  combat_training_academy: 8,
  defense_training_academy: 5,
  mobility_training_academy: 5,
  ai_training_academy: 5,
};

export function renderUpgradePlanner(options: RenderOptions = {}): ReturnType<typeof render> {
  const robot = createRobot(options.robot);
  const academyLevels = { ...DEFAULT_ACADEMY_LEVELS, ...options.academyLevels };

  return render(
    <UpgradePlanner
      robot={robot}
      currentCredits={options.currentCredits ?? 500000}
      trainingLevel={options.trainingLevel ?? 0}
      academyLevels={academyLevels}
      workshopLevel={options.workshopLevel ?? 0}
      onCommit={async () => {}}
      onNavigateToFacilities={() => {}}
    />
  );
}

/** Academy level → attribute cap mapping */
export const ACADEMY_CAP_MAP: Record<number, number> = {
  0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
  5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50,
};

/** Extract numeric cost from the total cost display element */
export function getTotalCost(container: HTMLElement): number {
  const text = container.querySelector('[class*="text-warning"][class*="text-2xl"]')?.textContent || '0';
  return parseInt(text.replace(/[^0-9]/g, '')) || 0;
}

/** Get all + buttons in the planner */
export function getPlusButtons(container: HTMLElement): HTMLButtonElement[] {
  const allButtons = container.querySelectorAll('button');
  return Array.from(allButtons).filter(btn => btn.textContent?.includes('+')) as HTMLButtonElement[];
}

/** Get all - buttons in the planner */
export function getMinusButtons(container: HTMLElement): HTMLButtonElement[] {
  const allButtons = container.querySelectorAll('button');
  return Array.from(allButtons).filter(
    btn => btn.textContent?.includes('−') || btn.textContent?.includes('-')
  ) as HTMLButtonElement[];
}
