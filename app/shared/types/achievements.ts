/**
 * Achievement classification shared by the achievement contracts
 * (`AchievementTier`, `AchievementCategory` in backend `config/achievements.ts`).
 */
export type AchievementTier = 'easy' | 'medium' | 'hard' | 'very_hard' | 'secret';
export type AchievementCategory = 'combat' | 'league' | 'economy' | 'prestige' | 'style';
