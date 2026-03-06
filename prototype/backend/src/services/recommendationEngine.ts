/**
 * Recommendation Engine Service
 * 
 * Generates personalized recommendations for new players based on their strategic choices.
 * Supports 3 roster strategies (1 mighty, 2 average, 3 flimsy) and 4 loadout types.
 */

export interface Recommendation {
  type: 'facility' | 'weapon' | 'attribute' | 'strategy';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  estimatedCost?: number;
}

export interface BudgetAllocation {
  facilities: { min: number; max: number };
  robots: { min: number; max: number };
  weapons: { min: number; max: number };
  attributes: { min: number; max: number };
  reserve: { min: number; max: number };
}

type RosterStrategy = '1_mighty' | '2_average' | '3_flimsy';
type LoadoutType = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
type Stance = 'offensive' | 'defensive' | 'balanced';

export const recommendationEngine = {
  /**
   * Generate facility recommendations based on player choices
   * 
   * @param strategy - Roster strategy (1_mighty, 2_average, 3_flimsy)
   * @param loadoutType - Weapon loadout configuration
   * @param stance - Battle stance preference
   * @returns Array of facility recommendations sorted by priority
   */
  generateFacilityRecommendations(
    strategy: RosterStrategy,
    loadoutType?: LoadoutType,
    stance?: Stance
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Mandatory facilities based on roster strategy
    if (strategy === '2_average' || strategy === '3_flimsy') {
      const level = strategy === '2_average' ? 1 : 2;
      const cost = strategy === '2_average' ? 150000 : 450000;
      
      recommendations.push({
        type: 'facility',
        priority: 'high',
        title: `Roster Expansion${level > 1 ? ` Level ${level}` : ''}`,
        description: 'Required to create additional robots',
        reasoning: `Your ${strategy === '2_average' ? '2 robot' : '3 robot'} strategy requires Roster Expansion${level > 1 ? ` Level ${level}` : ''} facility`,
        estimatedCost: cost
      });
    }
    
    // Weapons Workshop (always recommended)
    recommendations.push({
      type: 'facility',
      priority: 'high',
      title: 'Weapons Workshop',
      description: 'Provides 5-50% discount on weapon purchases',
      reasoning: 'Purchase before buying weapons to save credits. Level 5 saves ₡69K on a ₡275K weapon',
      estimatedCost: 100000
    });
    
    // Training Facility (always recommended)
    recommendations.push({
      type: 'facility',
      priority: 'high',
      title: 'Training Facility',
      description: 'Provides 10-90% discount on attribute upgrades',
      reasoning: 'Essential for all strategies. Saves ₡186K when upgrading attributes 1→10',
      estimatedCost: 150000
    });
    
    // Conditional recommendations based on loadout and stance
    if (loadoutType === 'weapon_shield' && stance === 'defensive') {
      recommendations.push({
        type: 'facility',
        priority: 'medium',
        title: 'Defense Training Academy',
        description: 'Bonuses stack with shields for defensive builds',
        reasoning: 'Your weapon+shield loadout and defensive stance synergize with Defense Training Academy',
        estimatedCost: 200000
      });
    }
    
    if (loadoutType === 'two_handed' && stance === 'offensive') {
      recommendations.push({
        type: 'facility',
        priority: 'medium',
        title: 'Power Training Academy',
        description: 'Enhances damage output for aggressive builds',
        reasoning: 'Your two-handed loadout and offensive stance benefit from Power Training Academy',
        estimatedCost: 200000
      });
    }
    
    // Storage Facility for multi-robot strategies
    if (strategy === '3_flimsy') {
      recommendations.push({
        type: 'facility',
        priority: 'medium',
        title: 'Storage Facility',
        description: 'Increases weapon storage capacity',
        reasoning: 'With 3 robots, you need 3-6 weapons. Storage Facility prevents "storage full" errors',
        estimatedCost: 100000
      });
    }
    
    // Repair Bay for all strategies (lower priority)
    recommendations.push({
      type: 'facility',
      priority: 'low',
      title: 'Repair Bay',
      description: 'Reduces repair costs by 5-55%',
      reasoning: 'Helps manage ongoing repair expenses. More valuable for multi-robot strategies',
      estimatedCost: 150000
    });
    
    // Sort by priority
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  },
  
  /**
   * Generate weapon recommendations based on player choices
   * 
   * @param strategy - Roster strategy
   * @param loadoutType - Weapon loadout configuration
   * @param creditsRemaining - Player's remaining credits
   * @returns Array of weapon recommendations
   */
  generateWeaponRecommendations(
    strategy: RosterStrategy,
    loadoutType?: LoadoutType,
    creditsRemaining?: number
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Budget-appropriate weapons
    if (creditsRemaining && creditsRemaining < 300000) {
      recommendations.push({
        type: 'weapon',
        priority: 'high',
        title: 'Combat Knife',
        description: 'Budget option with high burst damage',
        reasoning: 'Affordable starter weapon at ₡100K. Good for tight budgets',
        estimatedCost: 100000
      });
      
      recommendations.push({
        type: 'weapon',
        priority: 'high',
        title: 'Machine Gun',
        description: 'Affordable, reliable weapon with attribute bonuses',
        reasoning: 'Balanced budget option at ₡150K. Good all-around choice',
        estimatedCost: 150000
      });
    } else {
      recommendations.push({
        type: 'weapon',
        priority: 'high',
        title: 'Laser Rifle',
        description: 'Precise, consistent damage with attribute bonuses',
        reasoning: 'Balanced starter weapon at ₡244K. Good all-around choice',
        estimatedCost: 244000
      });
      
      recommendations.push({
        type: 'weapon',
        priority: 'medium',
        title: 'Machine Gun',
        description: 'Affordable, reliable weapon with attribute bonuses',
        reasoning: 'Budget-friendly option at ₡150K if you want to save credits',
        estimatedCost: 150000
      });
    }
    
    // Loadout-specific recommendations
    if (loadoutType === 'weapon_shield') {
      recommendations.push({
        type: 'weapon',
        priority: 'high',
        title: 'Shield',
        description: 'Required for weapon+shield loadout',
        reasoning: 'Your chosen loadout requires a shield in the offhand slot',
        estimatedCost: 150000
      });
    }
    
    if (loadoutType === 'dual_wield') {
      recommendations.push({
        type: 'weapon',
        priority: 'high',
        title: 'Second One-Handed Weapon',
        description: 'Required for dual-wield loadout',
        reasoning: 'Dual-wield requires two one-handed weapons',
        estimatedCost: 150000
      });
    }
    
    if (loadoutType === 'two_handed') {
      recommendations.push({
        type: 'weapon',
        priority: 'medium',
        title: 'Two-Handed Weapon',
        description: 'High damage weapon for two-handed loadout',
        reasoning: 'Two-handed weapons provide 1.10× damage multiplier and +20% crit bonus',
        estimatedCost: 275000
      });
    }
    
    // Multi-robot strategy recommendations
    if (strategy === '2_average' || strategy === '3_flimsy') {
      const robotCount = strategy === '2_average' ? 2 : 3;
      recommendations.push({
        type: 'weapon',
        priority: 'medium',
        title: `Multiple Weapons (${robotCount} robots)`,
        description: `You'll need ${robotCount}-${robotCount * 2} weapons total`,
        reasoning: 'Each robot needs at least one weapon. Consider weapon sharing and storage capacity',
        estimatedCost: robotCount * 150000
      });
    }
    
    return recommendations;
  },
  
  /**
   * Generate attribute upgrade recommendations based on player choices
   * 
   * @param strategy - Roster strategy
   * @param loadoutType - Weapon loadout configuration
   * @param stance - Battle stance preference
   * @returns Array of attribute recommendations
   */
  generateAttributeRecommendations(
    strategy: RosterStrategy,
    loadoutType?: LoadoutType,
    stance?: Stance
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Strategy-specific attribute focus
    if (strategy === '1_mighty') {
      recommendations.push({
        type: 'attribute',
        priority: 'high',
        title: 'Focus on Single Robot',
        description: 'Concentrate attribute upgrades on your one robot',
        reasoning: 'With 1 mighty robot, you can afford to maximize attributes. Budget ₡1,000K-₡1,200K for upgrades',
        estimatedCost: 1000000
      });
    } else if (strategy === '2_average') {
      recommendations.push({
        type: 'attribute',
        priority: 'high',
        title: 'Balanced Distribution',
        description: 'Split attribute upgrades between your 2 robots',
        reasoning: 'With 2 robots, distribute ₡600K-₡800K across both. Aim for moderate levels (5-7) on key attributes',
        estimatedCost: 700000
      });
    } else if (strategy === '3_flimsy') {
      recommendations.push({
        type: 'attribute',
        priority: 'high',
        title: 'Minimal Upgrades',
        description: 'Keep attribute upgrades minimal across 3 robots',
        reasoning: 'With 3 robots, budget ₡300K-₡500K total. Focus on level 3-5 for critical attributes only',
        estimatedCost: 400000
      });
    }
    
    // Loadout-specific attributes
    if (loadoutType === 'weapon_shield') {
      recommendations.push({
        type: 'attribute',
        priority: 'medium',
        title: 'Armor and Shield Attributes',
        description: 'Prioritize armorPlating and shieldCapacity',
        reasoning: 'Your weapon+shield loadout benefits from defensive attributes. Also consider gyroStabilizer for accuracy',
        estimatedCost: 300000
      });
    }
    
    if (loadoutType === 'two_handed') {
      recommendations.push({
        type: 'attribute',
        priority: 'medium',
        title: 'Power and Critical Attributes',
        description: 'Prioritize combatPower and criticalSystems',
        reasoning: 'Your two-handed loadout benefits from damage-focused attributes. Also consider armorPenetration',
        estimatedCost: 300000
      });
    }
    
    if (loadoutType === 'dual_wield') {
      recommendations.push({
        type: 'attribute',
        priority: 'medium',
        title: 'Speed and Control Attributes',
        description: 'Prioritize servoMotors and controlSystems',
        reasoning: 'Your dual-wield loadout benefits from attack speed and control. Also consider gyroStabilizer',
        estimatedCost: 300000
      });
    }
    
    // Stance-specific attributes
    if (stance === 'offensive') {
      recommendations.push({
        type: 'attribute',
        priority: 'medium',
        title: 'Offensive Attributes',
        description: 'Focus on combatPower, criticalSystems, armorPenetration',
        reasoning: 'Your offensive stance benefits from damage-dealing attributes',
        estimatedCost: 300000
      });
    }
    
    if (stance === 'defensive') {
      recommendations.push({
        type: 'attribute',
        priority: 'medium',
        title: 'Defensive Attributes',
        description: 'Focus on armorPlating, shieldCapacity, evasionSystems',
        reasoning: 'Your defensive stance benefits from survivability attributes',
        estimatedCost: 300000
      });
    }
    
    // General advice
    recommendations.push({
      type: 'attribute',
      priority: 'low',
      title: 'Purchase Training Facility First',
      description: 'Buy Training Facility before upgrading attributes',
      reasoning: 'Training Facility provides 10-90% discount on attribute upgrades. Saves ₡186K when upgrading 1→10',
      estimatedCost: 150000
    });
    
    return recommendations;
  },
  
  /**
   * Calculate recommended budget allocation for a roster strategy
   * 
   * @param strategy - Roster strategy
   * @returns Budget allocation ranges for each category
   */
  calculateBudgetAllocation(strategy: RosterStrategy): BudgetAllocation {
    const allocations: Record<RosterStrategy, BudgetAllocation> = {
      '1_mighty': {
        facilities: { min: 400000, max: 600000 },
        robots: { min: 500000, max: 500000 },
        weapons: { min: 300000, max: 400000 },
        attributes: { min: 1000000, max: 1200000 },
        reserve: { min: 500000, max: 700000 }
      },
      '2_average': {
        facilities: { min: 600000, max: 800000 },
        robots: { min: 1000000, max: 1000000 },
        weapons: { min: 400000, max: 600000 },
        attributes: { min: 600000, max: 800000 },
        reserve: { min: 400000, max: 600000 }
      },
      '3_flimsy': {
        facilities: { min: 700000, max: 900000 },
        robots: { min: 1500000, max: 1500000 },
        weapons: { min: 400000, max: 600000 },
        attributes: { min: 300000, max: 500000 },
        reserve: { min: 400000, max: 600000 }
      }
    };
    
    return allocations[strategy];
  }
};
