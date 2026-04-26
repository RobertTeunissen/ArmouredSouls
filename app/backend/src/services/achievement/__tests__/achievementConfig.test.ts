import {
  ACHIEVEMENTS,
  TIER_REWARDS,
  getAchievementById,
  getAchievementsByTriggerType,
  AchievementTier,
} from '../../../config/achievements';

describe('Achievement Config', () => {
  describe('ACHIEVEMENTS array', () => {
    it('should have all entries with unique IDs', () => {
      const ids = ACHIEVEMENTS.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all required fields populated for every entry', () => {
      for (const a of ACHIEVEMENTS) {
        expect(a.id).toBeTruthy();
        expect(a.name).toBeTruthy();
        expect(a.description).toBeTruthy();
        expect(a.reference).toBeTruthy();
        expect(a.category).toBeTruthy();
        expect(a.tier).toBeTruthy();
        expect(a.scope).toBeTruthy();
        expect(typeof a.rewardCredits).toBe('number');
        expect(typeof a.rewardPrestige).toBe('number');
        expect(typeof a.hidden).toBe('boolean');
        expect(a.triggerType).toBeTruthy();
        expect(a.progressType).toBeTruthy();
        expect(a.badgeIconFile).toBeTruthy();
      }
    });

    it('should set hidden=true for secret tier and hidden=false for all other tiers', () => {
      for (const a of ACHIEVEMENTS) {
        if (a.tier === 'secret') {
          expect(a.hidden).toBe(true);
        } else {
          expect(a.hidden).toBe(false);
        }
      }
    });

    it('should match TIER_REWARDS for non-secret tier rewards', () => {
      for (const a of ACHIEVEMENTS) {
        if (a.tier !== 'secret') {
          const expected = TIER_REWARDS[a.tier];
          expect(a.rewardCredits).toBe(expected.credits);
          expect(a.rewardPrestige).toBe(expected.prestige);
        }
      }
    });

    it('should have valid scope for every entry', () => {
      const validScopes = ['user', 'robot'];
      for (const a of ACHIEVEMENTS) {
        expect(validScopes).toContain(a.scope);
      }
    });

    it('should have valid tier for every entry', () => {
      const validTiers: AchievementTier[] = ['easy', 'medium', 'hard', 'very_hard', 'secret'];
      for (const a of ACHIEVEMENTS) {
        expect(validTiers).toContain(a.tier);
      }
    });

    it('should have valid category for every entry', () => {
      const validCategories = ['combat', 'league', 'economy', 'prestige', 'style'];
      for (const a of ACHIEVEMENTS) {
        expect(validCategories).toContain(a.category);
      }
    });

    it('should have valid progressType for every entry', () => {
      const validTypes = ['numeric', 'boolean'];
      for (const a of ACHIEVEMENTS) {
        expect(validTypes).toContain(a.progressType);
      }
    });

    it('should have progressLabel for numeric progress types', () => {
      for (const a of ACHIEVEMENTS) {
        if (a.progressType === 'numeric') {
          expect(a.progressLabel).toBeTruthy();
        }
      }
    });

    it('should have triggerThreshold for numeric progress types with thresholds', () => {
      // Achievements with numeric progress that track cumulative values should have thresholds
      const numericWithThreshold = ACHIEVEMENTS.filter(
        (a) => a.progressType === 'numeric' && a.triggerThreshold !== undefined,
      );
      expect(numericWithThreshold.length).toBeGreaterThan(0);
      for (const a of numericWithThreshold) {
        expect(a.triggerThreshold).toBeGreaterThan(0);
      }
    });
  });

  describe('TIER_REWARDS', () => {
    it('should define rewards for all tiers', () => {
      expect(TIER_REWARDS.easy).toEqual({ credits: 25_000, prestige: 25 });
      expect(TIER_REWARDS.medium).toEqual({ credits: 50_000, prestige: 50 });
      expect(TIER_REWARDS.hard).toEqual({ credits: 100_000, prestige: 100 });
      expect(TIER_REWARDS.very_hard).toEqual({ credits: 250_000, prestige: 250 });
      expect(TIER_REWARDS.secret).toEqual({ credits: 50_000, prestige: 50 });
    });
  });

  describe('getAchievementById', () => {
    it('should return the correct achievement for a valid ID', () => {
      const result = getAchievementById('C1');
      expect(result).toBeDefined();
      expect(result!.name).toBe("I'll Be Back");
    });

    it('should return undefined for an invalid ID', () => {
      expect(getAchievementById('INVALID')).toBeUndefined();
      expect(getAchievementById('')).toBeUndefined();
    });
  });

  describe('getAchievementsByTriggerType', () => {
    it('should return achievements matching the trigger type', () => {
      const winAchievements = getAchievementsByTriggerType('wins');
      expect(winAchievements.length).toBeGreaterThan(0);
      for (const a of winAchievements) {
        expect(a.triggerType).toBe('wins');
      }
    });

    it('should return empty array for unused trigger type', () => {
      // shield_only_win is defined in the type but not used by any achievement
      const result = getAchievementsByTriggerType('shield_only_win');
      expect(result).toEqual([]);
    });
  });
});
