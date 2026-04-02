// Onboarding domain barrel file — re-exports the public API

export {
  initializeTutorialState,
  getTutorialState,
  updateTutorialState,
  completeTutorial,
  skipTutorial,
  advanceStep,
  updatePlayerChoices,
} from './onboardingService';
export type {
  OnboardingChoices,
  TutorialState,
  TutorialStateUpdates,
} from './onboardingService';
