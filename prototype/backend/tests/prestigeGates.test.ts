/**
 * Prestige Gates Unit Tests
 * Tests prestige requirement validation for facility upgrades
 */

import { PrismaClient } from '@prisma/client';
import { getFacilityConfig } from '../src/config/facilities';

const prisma = new PrismaClient();

describe('Prestige Gates', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Facility Config Prestige Requirements', () => {
    test('Repair Bay has correct prestige requirements', () => {
      const config = getFacilityConfig('repair_bay');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 0, 1000, 0, 0, 5000, 0, 10000, 0]);
    });

    test('Training Facility has correct prestige requirements', () => {
      const config = getFacilityConfig('training_facility');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 0, 1000, 0, 0, 5000, 0, 10000, 0]);
    });

    test('Weapons Workshop has correct prestige requirements', () => {
      const config = getFacilityConfig('weapons_workshop');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 0, 1500, 0, 0, 5000, 0, 10000, 0]);
    });

    test('Research Lab has correct prestige requirements', () => {
      const config = getFacilityConfig('research_lab');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 0, 2000, 0, 0, 7500, 0, 15000, 0]);
    });

    test('Medical Bay has correct prestige requirements', () => {
      const config = getFacilityConfig('medical_bay');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 0, 2000, 0, 0, 7500, 0, 15000, 0]);
    });

    test('Roster Expansion has correct prestige requirements', () => {
      const config = getFacilityConfig('roster_expansion');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 0, 1000, 0, 0, 5000, 0, 10000]);
    });

    test('Coaching Staff has correct prestige requirements', () => {
      const config = getFacilityConfig('coaching_staff');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 2000, 0, 0, 5000, 0, 0, 10000, 0]);
    });

    test('Booking Office has prestige requirements for all levels', () => {
      const config = getFacilityConfig('booking_office');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([1000, 2500, 5000, 10000, 15000, 20000, 25000, 35000, 45000, 50000]);
    });

    test('Combat Training Academy has correct prestige requirements', () => {
      const config = getFacilityConfig('combat_training_academy');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 2000, 0, 4000, 0, 7000, 0, 10000, 15000]);
    });

    test('Defense Training Academy has correct prestige requirements', () => {
      const config = getFacilityConfig('defense_training_academy');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 2000, 0, 4000, 0, 7000, 0, 10000, 15000]);
    });

    test('Mobility Training Academy has correct prestige requirements', () => {
      const config = getFacilityConfig('mobility_training_academy');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 2000, 0, 4000, 0, 7000, 0, 10000, 15000]);
    });

    test('AI Training Academy has correct prestige requirements', () => {
      const config = getFacilityConfig('ai_training_academy');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 2000, 0, 4000, 0, 7000, 0, 10000, 15000]);
    });

    test('Income Generator has correct prestige requirements', () => {
      const config = getFacilityConfig('income_generator');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 0, 3000, 0, 0, 7500, 0, 15000, 0]);
    });

    test('Storage Facility has no prestige requirements', () => {
      const config = getFacilityConfig('storage_facility');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toBeUndefined();
    });

    test('Streaming Studio has correct prestige requirements', () => {
      const config = getFacilityConfig('streaming_studio');
      expect(config).toBeDefined();
      expect(config?.prestigeRequirements).toEqual([0, 0, 0, 1000, 2500, 5000, 10000, 15000, 25000, 50000]);
    });
  });

  describe('Prestige Requirement Validation Logic', () => {
    test('should identify when prestige requirement exists', () => {
      const config = getFacilityConfig('repair_bay');
      const targetLevel = 4; // Requires 1000 prestige
      const requirement = config?.prestigeRequirements?.[targetLevel - 1];
      
      expect(requirement).toBe(1000);
    });

    test('should identify when no prestige requirement exists', () => {
      const config = getFacilityConfig('repair_bay');
      const targetLevel = 1; // No prestige requirement
      const requirement = config?.prestigeRequirements?.[targetLevel - 1];
      
      expect(requirement).toBe(0);
    });

    test('should handle facilities without prestigeRequirements field', () => {
      const config = getFacilityConfig('storage_facility');
      const targetLevel = 5;
      const requirement = config?.prestigeRequirements?.[targetLevel - 1];
      
      expect(requirement).toBeUndefined();
    });

    test('should correctly validate user has sufficient prestige', () => {
      const userPrestige = 1500;
      const requiredPrestige = 1000;
      
      expect(userPrestige >= requiredPrestige).toBe(true);
    });

    test('should correctly validate user has insufficient prestige', () => {
      const userPrestige = 500;
      const requiredPrestige = 1000;
      
      expect(userPrestige >= requiredPrestige).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle level 1 upgrades (always no prestige requirement)', () => {
      const config = getFacilityConfig('booking_office');
      const targetLevel = 1;
      const requirement = config?.prestigeRequirements?.[targetLevel - 1];
      
      // Booking Office Level 1 requires 1000 prestige (special case)
      expect(requirement).toBe(1000);
    });

    test('should handle max level facilities', () => {
      const config = getFacilityConfig('repair_bay');
      const maxLevel = config?.maxLevel || 0;
      const requirement = config?.prestigeRequirements?.[maxLevel - 1];
      
      // Level 10 has no prestige requirement
      expect(requirement).toBe(0);
    });

    test('should handle roster expansion with 9 levels', () => {
      const config = getFacilityConfig('roster_expansion');
      expect(config?.maxLevel).toBe(9);
      expect(config?.prestigeRequirements?.length).toBe(9);
    });
  });
});
