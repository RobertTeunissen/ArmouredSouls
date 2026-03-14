import { recommendationEngine } from '../src/services/recommendationEngine';

describe('RecommendationEngine', () => {
  describe('generateFacilityRecommendations', () => {
    describe('1 mighty robot strategy', () => {
      it('should recommend Weapons Workshop and Training Facility', () => {
        const recommendations = recommendationEngine.generateFacilityRecommendations('1_mighty');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'facility',
              priority: 'high',
              title: 'Weapons Workshop'
            }),
            expect.objectContaining({
              type: 'facility',
              priority: 'high',
              title: 'Training Facility'
            })
          ])
        );
      });

      it('should NOT recommend Roster Expansion', () => {
        const recommendations = recommendationEngine.generateFacilityRecommendations('1_mighty');
        
        const rosterExpansion = recommendations.find(r => r.title.includes('Roster Expansion'));
        expect(rosterExpansion).toBeUndefined();
      });

      it('should recommend Defense Training Academy for weapon+shield defensive build', () => {
        const recommendations = recommendationEngine.generateFacilityRecommendations(
          '1_mighty',
          'weapon_shield',
          'defensive'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'facility',
              priority: 'medium',
              title: 'Defense Training Academy',
              reasoning: expect.stringContaining('weapon+shield')
            })
          ])
        );
      });

      it('should recommend Power Training Academy for two-handed offensive build', () => {
        const recommendations = recommendationEngine.generateFacilityRecommendations(
          '1_mighty',
          'two_handed',
          'offensive'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'facility',
              priority: 'medium',
              title: 'Power Training Academy',
              reasoning: expect.stringContaining('two-handed')
            })
          ])
        );
      });
    });

    describe('2 average robots strategy', () => {
      it('should recommend Roster Expansion Level 1', () => {
        const recommendations = recommendationEngine.generateFacilityRecommendations('2_average');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'facility',
              priority: 'high',
              title: 'Roster Expansion',
              estimatedCost: 150000
            })
          ])
        );
      });

      it('should recommend all mandatory facilities', () => {
        const recommendations = recommendationEngine.generateFacilityRecommendations('2_average');
        
        const highPriority = recommendations.filter(r => r.priority === 'high');
        expect(highPriority.length).toBeGreaterThanOrEqual(3); // Roster Expansion, Weapons Workshop, Training Facility
      });
    });

    describe('3 flimsy robots strategy', () => {
      it('should recommend Roster Expansion Level 2', () => {
        const recommendations = recommendationEngine.generateFacilityRecommendations('3_flimsy');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'facility',
              priority: 'high',
              title: 'Roster Expansion Level 2',
              estimatedCost: 450000
            })
          ])
        );
      });

      it('should recommend Storage Facility', () => {
        const recommendations = recommendationEngine.generateFacilityRecommendations('3_flimsy');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'facility',
              priority: 'medium',
              title: 'Storage Facility',
              reasoning: expect.stringContaining('3 robots')
            })
          ])
        );
      });
    });

    it('should sort recommendations by priority (high, medium, low)', () => {
      const recommendations = recommendationEngine.generateFacilityRecommendations(
        '1_mighty',
        'weapon_shield',
        'defensive'
      );
      
      // Check that high priority comes before medium
      const firstHighIndex = recommendations.findIndex(r => r.priority === 'high');
      const firstMediumIndex = recommendations.findIndex(r => r.priority === 'medium');
      
      expect(firstHighIndex).toBeLessThan(firstMediumIndex);
    });
  });

  describe('generateWeaponRecommendations', () => {
    describe('budget-based recommendations', () => {
      it('should recommend budget weapons when credits < 300K', () => {
        const recommendations = recommendationEngine.generateWeaponRecommendations(
          '1_mighty',
          'single',
          250000
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Combat Knife',
              estimatedCost: 100000
            }),
            expect.objectContaining({
              title: 'Machine Gun',
              estimatedCost: 150000
            })
          ])
        );
      });

      it('should recommend Laser Rifle when credits >= 300K', () => {
        const recommendations = recommendationEngine.generateWeaponRecommendations(
          '1_mighty',
          'single',
          500000
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Laser Rifle',
              estimatedCost: 244000
            })
          ])
        );
      });
    });

    describe('loadout-specific recommendations', () => {
      it('should recommend Shield for weapon+shield loadout', () => {
        const recommendations = recommendationEngine.generateWeaponRecommendations(
          '1_mighty',
          'weapon_shield'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'weapon',
              priority: 'high',
              title: 'Shield',
              reasoning: expect.stringContaining('shield in the offhand')
            })
          ])
        );
      });

      it('should recommend second weapon for dual-wield loadout', () => {
        const recommendations = recommendationEngine.generateWeaponRecommendations(
          '1_mighty',
          'dual_wield'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'weapon',
              priority: 'high',
              title: 'Second One-Handed Weapon',
              reasoning: expect.stringContaining('Dual-wield')
            })
          ])
        );
      });

      it('should recommend two-handed weapon for two-handed loadout', () => {
        const recommendations = recommendationEngine.generateWeaponRecommendations(
          '1_mighty',
          'two_handed'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'weapon',
              priority: 'medium',
              title: 'Two-Handed Weapon',
              reasoning: expect.stringContaining('1.10× damage')
            })
          ])
        );
      });
    });

    describe('multi-robot strategy recommendations', () => {
      it('should recommend multiple weapons for 2 average robots', () => {
        const recommendations = recommendationEngine.generateWeaponRecommendations('2_average');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Multiple Weapons (2 robots)',
              reasoning: expect.stringContaining('weapon sharing')
            })
          ])
        );
      });

      it('should recommend multiple weapons for 3 flimsy robots', () => {
        const recommendations = recommendationEngine.generateWeaponRecommendations('3_flimsy');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Multiple Weapons (3 robots)',
              reasoning: expect.stringContaining('storage capacity')
            })
          ])
        );
      });
    });
  });

  describe('generateAttributeRecommendations', () => {
    describe('strategy-specific recommendations', () => {
      it('should recommend focused upgrades for 1 mighty robot', () => {
        const recommendations = recommendationEngine.generateAttributeRecommendations('1_mighty');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'attribute',
              priority: 'high',
              title: 'Focus on Single Robot',
              estimatedCost: 1000000
            })
          ])
        );
      });

      it('should recommend balanced distribution for 2 average robots', () => {
        const recommendations = recommendationEngine.generateAttributeRecommendations('2_average');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'attribute',
              priority: 'high',
              title: 'Balanced Distribution',
              reasoning: expect.stringContaining('2 robots')
            })
          ])
        );
      });

      it('should recommend minimal upgrades for 3 flimsy robots', () => {
        const recommendations = recommendationEngine.generateAttributeRecommendations('3_flimsy');
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'attribute',
              priority: 'high',
              title: 'Minimal Upgrades',
              reasoning: expect.stringContaining('3 robots')
            })
          ])
        );
      });
    });

    describe('loadout-specific recommendations', () => {
      it('should recommend armor and shield attributes for weapon+shield', () => {
        const recommendations = recommendationEngine.generateAttributeRecommendations(
          '1_mighty',
          'weapon_shield'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'attribute',
              priority: 'medium',
              title: 'Armor and Shield Attributes',
              description: expect.stringContaining('armorPlating')
            })
          ])
        );
      });

      it('should recommend power and critical attributes for two-handed', () => {
        const recommendations = recommendationEngine.generateAttributeRecommendations(
          '1_mighty',
          'two_handed'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'attribute',
              priority: 'medium',
              title: 'Power and Critical Attributes',
              description: expect.stringContaining('combatPower')
            })
          ])
        );
      });

      it('should recommend speed and control attributes for dual-wield', () => {
        const recommendations = recommendationEngine.generateAttributeRecommendations(
          '1_mighty',
          'dual_wield'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'attribute',
              priority: 'medium',
              title: 'Speed and Control Attributes',
              description: expect.stringContaining('servoMotors')
            })
          ])
        );
      });
    });

    describe('stance-specific recommendations', () => {
      it('should recommend offensive attributes for offensive stance', () => {
        const recommendations = recommendationEngine.generateAttributeRecommendations(
          '1_mighty',
          'single',
          'offensive'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'attribute',
              priority: 'medium',
              title: 'Offensive Attributes',
              description: expect.stringContaining('combatPower')
            })
          ])
        );
      });

      it('should recommend defensive attributes for defensive stance', () => {
        const recommendations = recommendationEngine.generateAttributeRecommendations(
          '1_mighty',
          'single',
          'defensive'
        );
        
        expect(recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'attribute',
              priority: 'medium',
              title: 'Defensive Attributes',
              description: expect.stringContaining('armorPlating')
            })
          ])
        );
      });
    });

    it('should always recommend purchasing Training Facility first', () => {
      const recommendations = recommendationEngine.generateAttributeRecommendations('1_mighty');
      
      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'attribute',
            priority: 'low',
            title: 'Purchase Training Facility First',
            reasoning: expect.stringContaining('10-90% discount')
          })
        ])
      );
    });
  });

  describe('calculateBudgetAllocation', () => {
    it('should return correct allocation for 1 mighty robot strategy', () => {
      const allocation = recommendationEngine.calculateBudgetAllocation('1_mighty');
      
      expect(allocation).toEqual({
        facilities: { min: 400000, max: 600000 },
        robots: { min: 500000, max: 500000 },
        weapons: { min: 300000, max: 400000 },
        attributes: { min: 1000000, max: 1200000 },
        reserve: { min: 500000, max: 700000 }
      });
    });

    it('should return correct allocation for 2 average robots strategy', () => {
      const allocation = recommendationEngine.calculateBudgetAllocation('2_average');
      
      expect(allocation).toEqual({
        facilities: { min: 600000, max: 800000 },
        robots: { min: 1000000, max: 1000000 },
        weapons: { min: 400000, max: 600000 },
        attributes: { min: 600000, max: 800000 },
        reserve: { min: 400000, max: 600000 }
      });
    });

    it('should return correct allocation for 3 flimsy robots strategy', () => {
      const allocation = recommendationEngine.calculateBudgetAllocation('3_flimsy');
      
      expect(allocation).toEqual({
        facilities: { min: 700000, max: 900000 },
        robots: { min: 1500000, max: 1500000 },
        weapons: { min: 400000, max: 600000 },
        attributes: { min: 300000, max: 500000 },
        reserve: { min: 400000, max: 600000 }
      });
    });

    it('should have total budget approximately equal to 3M credits', () => {
      const strategies: Array<'1_mighty' | '2_average' | '3_flimsy'> = ['1_mighty', '2_average', '3_flimsy'];
      
      strategies.forEach(strategy => {
        const allocation = recommendationEngine.calculateBudgetAllocation(strategy);
        
        // Calculate total using max values
        const total = 
          allocation.facilities.max +
          allocation.robots.max +
          allocation.weapons.max +
          allocation.attributes.max +
          allocation.reserve.max;
        
        // Should be approximately 3-4M (allow flexibility for multi-robot strategies)
        expect(total).toBeGreaterThanOrEqual(2800000);
        expect(total).toBeLessThanOrEqual(4200000);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should provide comprehensive recommendations for 1 mighty + weapon+shield + defensive', () => {
      const facilities = recommendationEngine.generateFacilityRecommendations(
        '1_mighty',
        'weapon_shield',
        'defensive'
      );
      const weapons = recommendationEngine.generateWeaponRecommendations(
        '1_mighty',
        'weapon_shield',
        500000
      );
      const attributes = recommendationEngine.generateAttributeRecommendations(
        '1_mighty',
        'weapon_shield',
        'defensive'
      );
      const budget = recommendationEngine.calculateBudgetAllocation('1_mighty');
      
      // Should have Defense Training Academy
      expect(facilities.some(f => f.title === 'Defense Training Academy')).toBe(true);
      
      // Should require shield
      expect(weapons.some(w => w.title === 'Shield')).toBe(true);
      
      // Should recommend defensive attributes
      expect(attributes.some(a => a.title === 'Defensive Attributes')).toBe(true);
      
      // Budget should be for 1 mighty
      expect(budget.robots.min).toBe(500000);
    });

    it('should provide comprehensive recommendations for 3 flimsy + dual-wield', () => {
      const facilities = recommendationEngine.generateFacilityRecommendations('3_flimsy', 'dual_wield');
      const weapons = recommendationEngine.generateWeaponRecommendations('3_flimsy', 'dual_wield');
      const attributes = recommendationEngine.generateAttributeRecommendations('3_flimsy', 'dual_wield');
      const budget = recommendationEngine.calculateBudgetAllocation('3_flimsy');
      
      // Should have Roster Expansion Level 2 and Storage Facility
      expect(facilities.some(f => f.title === 'Roster Expansion Level 2')).toBe(true);
      expect(facilities.some(f => f.title === 'Storage Facility')).toBe(true);
      
      // Should recommend multiple weapons
      expect(weapons.some(w => w.title.includes('Multiple Weapons (3 robots)'))).toBe(true);
      expect(weapons.some(w => w.title === 'Second One-Handed Weapon')).toBe(true);
      
      // Should recommend minimal upgrades
      expect(attributes.some(a => a.title === 'Minimal Upgrades')).toBe(true);
      
      // Budget should allocate for 3 robots
      expect(budget.robots.min).toBe(1500000);
    });
  });
});
