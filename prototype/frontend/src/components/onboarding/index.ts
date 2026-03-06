/**
 * Onboarding components index
 * Exports all onboarding-related components for easy importing
 */

export { default as OnboardingContainer } from './OnboardingContainer';
export { default as ProgressIndicator } from './ProgressIndicator';
export { default as BudgetTracker } from './BudgetTracker';
export { default as GuidedUIOverlay } from './GuidedUIOverlay';
export { default as RosterStrategyCard } from './RosterStrategyCard';
export { default as StrategyComparison } from './StrategyComparison';
export { default as BudgetAllocationChart } from './BudgetAllocationChart';
export { default as BudgetComparisonTable } from './BudgetComparisonTable';
export { default as FacilityPriorityList } from './FacilityPriorityList';
export { default as FacilityBenefitCards } from './FacilityBenefitCards';
export { default as LoadoutDiagram } from './LoadoutDiagram';
export { default as WeaponRecommendationCard, STARTER_WEAPONS } from './WeaponRecommendationCard';
export { default as LoadoutSelectorEducational } from './LoadoutSelectorEducational';
export { default as BattleTypeCard, BATTLE_TYPE_INFO } from './BattleTypeCard';
export { default as CycleScheduleVisualization, CYCLE_EVENTS } from './CycleScheduleVisualization';
export { default as BattleReadinessEducation, ROBOT_EXAMPLES } from './BattleReadinessEducation';
export { default as SkipTutorialButton } from './SkipTutorialButton';
export { default as ResumeTutorialButton } from './ResumeTutorialButton';

// Step components
export { default as Step1_Welcome } from './steps/Step1_Welcome';

// Re-export types
export type { RosterStrategy, StrategyData } from './RosterStrategyCard';
export type { LoadoutType } from './LoadoutDiagram';
export type { WeaponRecommendation } from './WeaponRecommendationCard';
export type { BattleType, BattleTypeInfo } from './BattleTypeCard';
export type { CycleEvent } from './CycleScheduleVisualization';
export type { RobotHealthExample } from './BattleReadinessEducation';
