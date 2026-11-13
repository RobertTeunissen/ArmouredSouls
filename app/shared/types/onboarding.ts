/**
 * Wire contract for the onboarding tutorial: `GET` and `POST /api/onboarding/state`
 * answer `{ success, data: TutorialState }`; `choices` is stored as given (JSON).
 */

/**
 * Player choices during onboarding (referenced by TutorialState).
 */
export interface OnboardingChoices {
  rosterStrategy?: '1_mighty' | '2_average' | '3_flimsy';
  robotsCreated?: number[];
  weaponsPurchased?: number[];
  facilitiesPurchased?: string[];
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  preferredStance?: 'offensive' | 'defensive' | 'balanced';
  weaponTypesSelected?: string[];
  budgetSpent?: {
    facilities: number;
    robots: number;
    weapons: number;
    attributes: number;
  };
  isReplay?: boolean;
}

/**
 * Tutorial state data structure
 */
export interface TutorialState {
  currentStep: number;
  hasCompletedOnboarding: boolean;
  onboardingSkipped: boolean;
  strategy: string | null;
  choices: OnboardingChoices;
  startedAt: string | null;
  completedAt: string | null;
}
