# Design Document: New Player Onboarding

## Overview

The New Player Onboarding system is an interactive tutorial that guides new players through the strategic complexity of Armoured Souls. The system addresses the critical problem of new players making poor resource allocation decisions without understanding the cascading implications of their choices.

The onboarding system uses a 9-step guided flow with strategic decision points, budget visualization, and personalized recommendations. It educates players about the fundamental strategic choice: **How many robots should I build?** This decision affects facility priorities, weapon strategies, budget allocation, and long-term progression.

### Key Features

- **Sequential Tutorial Flow**: 9 steps from welcome to strategy completion
- **Roster Strategy Selection**: Choose between 1, 2, or 3 robots with different playstyles
- **Facility Timing Education**: Learn which facilities to purchase and in what order
- **Budget Allocation Guidance**: Visual breakdowns for ₡3,000,000 starting credits
- **Weapon Loadout Education**: Understand loadout types and attribute bonuses
- **Personalized Recommendations**: Adaptive guidance based on player choices
- **Reset Functionality**: Start over if mistakes are made (with validation)
- **Battle Types Education**: Learn about League, Tag Team, and Tournament battles
- **Cross-Platform Support**: Works on desktop, tablet, and mobile devices

### Design Principles

1. **Education Over Restriction**: Guide players but allow flexibility
2. **Visual Learning**: Use images and charts to explain complex concepts
3. **Personalization**: Adapt recommendations to player's specific choices
4. **Persistence**: Save progress across sessions
5. **Accessibility**: Support keyboard navigation and screen readers
6. **Performance**: Fast loading and responsive interactions

## Architecture

### High-Level Architecture


```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  OnboardingContainer (React Context)                            │
│    ├── TutorialStateProvider (manages current step, choices)    │
│    ├── GuidedUIOverlay (semi-transparent overlay + tooltips)    │
│    └── StepComponents (9 step-specific components)              │
│         ├── Step1_Welcome                                       │
│         ├── Step2_RosterStrategy                                │
│         ├── Step3_FacilityTiming                                │
│         ├── Step4_BudgetAllocation                              │
│         ├── Step5_RobotCreation                                 │
│         ├── Step6_WeaponEducation                               │
│         ├── Step7_WeaponPurchase                                │
│         ├── Step8_BattleReadiness                               │
│         └── Step9_Completion                                    │
├─────────────────────────────────────────────────────────────────┤
│                         API Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  /api/onboarding/*                                              │
│    ├── GET    /state           - Get tutorial state            │
│    ├── POST   /state           - Update tutorial state         │
│    ├── POST   /complete        - Mark tutorial complete        │
│    ├── POST   /skip            - Skip tutorial                 │
│    ├── POST   /reset-account   - Reset account (with validation)│
│    └── GET    /recommendations - Get personalized suggestions  │
├─────────────────────────────────────────────────────────────────┤
│                         Service Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  OnboardingService                                              │
│    ├── getTutorialState()                                       │
│    ├── updateTutorialState()                                    │
│    ├── completeTutorial()                                       │
│    ├── skipTutorial()                                           │
│    └── validateResetEligibility()                               │
│                                                                 │
│  RecommendationEngine                                           │
│    ├── generateFacilityRecommendations()                        │
│    ├── generateWeaponRecommendations()                          │
│    ├── generateAttributeRecommendations()                       │
│    └── calculateBudgetAllocation()                              │
│                                                                 │
│  ResetService                                                   │
│    ├── validateResetConstraints()                               │
│    ├── performAccountReset()                                    │
│    └── logResetEvent()                                          │
├─────────────────────────────────────────────────────────────────┤
│                         Database Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  TutorialState (new table)                                      │
│  User (existing - add onboarding fields)                        │
│  Robot, Facility, WeaponInventory (existing)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy


**Frontend Component Structure:**

```
src/
├── contexts/
│   └── OnboardingContext.tsx          # Tutorial state management
├── components/
│   ├── onboarding/
│   │   ├── OnboardingContainer.tsx    # Main container
│   │   ├── GuidedUIOverlay.tsx        # Overlay + tooltips
│   │   ├── ProgressIndicator.tsx      # Step progress bar
│   │   ├── BudgetTracker.tsx          # Real-time budget display
│   │   ├── steps/
│   │   │   ├── Step1_Welcome.tsx
│   │   │   ├── Step2_RosterStrategy.tsx
│   │   │   ├── Step3_FacilityTiming.tsx
│   │   │   ├── Step4_BudgetAllocation.tsx
│   │   │   ├── Step5_RobotCreation.tsx
│   │   │   ├── Step6_WeaponEducation.tsx
│   │   │   ├── Step7_WeaponPurchase.tsx
│   │   │   ├── Step8_BattleReadiness.tsx
│   │   │   └── Step9_Completion.tsx
│   │   ├── RosterStrategyCard.tsx     # Strategy selection cards
│   │   ├── FacilityPriorityList.tsx   # Facility order display
│   │   ├── BudgetAllocationChart.tsx  # Pie/bar chart
│   │   ├── LoadoutDiagram.tsx         # Weapon loadout visuals
│   │   ├── BattleTypeCard.tsx         # Battle type explanations
│   │   └── ResetAccountModal.tsx      # Reset confirmation
│   └── ...existing components
├── pages/
│   └── OnboardingPage.tsx             # Main onboarding page
└── utils/
    └── onboardingApi.ts               # API client functions
```

**Backend Service Structure:**

```
src/
├── routes/
│   └── onboarding.ts                  # Onboarding API routes
├── services/
│   ├── onboardingService.ts           # Tutorial state management
│   ├── recommendationEngine.ts        # Personalized recommendations
│   └── resetService.ts                # Account reset logic
└── middleware/
    └── onboardingMiddleware.ts        # Tutorial state checks
```

## Data Models

### Database Schema Decision: Add Columns to User Table

**Decision**: Add onboarding fields directly to the existing `User` table rather than creating a separate `TutorialState` table.

**Rationale**:
1. **Simplicity**: Onboarding state is 1-to-1 with User, no need for separate table
2. **Query Performance**: Avoids JOIN operations when checking onboarding status
3. **Data Size**: Tutorial state data is small (< 1KB per user), won't bloat User table
4. **Access Pattern**: Onboarding status is frequently checked alongside user data
5. **Existing Pattern**: User table already contains user-specific state (currency, prestige, etc.)

**When a separate table WOULD be justified**:
- If tutorial state was large (>10KB per user)
- If we needed to store multiple tutorial attempts per user
- If we needed complex querying on tutorial state independent of users
- If tutorial state had its own lifecycle separate from users

### User Model Updates (Existing Table)

Add to existing User model in `app/backend/prisma/schema.prisma`:

```prisma
model User {
  // ... existing fields ...
  
  // ===== ONBOARDING TRACKING =====
  hasCompletedOnboarding Boolean  @default(false) @map("has_completed_onboarding")
  onboardingSkipped      Boolean  @default(false) @map("onboarding_skipped")
  onboardingStep         Int      @default(1) @map("onboarding_step") // Current step (1-9)
  onboardingStrategy     String?  @map("onboarding_strategy") @db.VarChar(20) // "1_mighty", "2_average", "3_flimsy"
  onboardingChoices      Json     @default("{}") @map("onboarding_choices") // Player choices during onboarding
  onboardingStartedAt    DateTime? @map("onboarding_started_at")
  onboardingCompletedAt  DateTime? @map("onboarding_completed_at")
  
  // ... existing relations ...
}
```

**Migration Impact**: This adds 7 columns to the User table. All existing users will have `hasCompletedOnboarding = false` by default, which will be updated to `true` during deployment migration.

**onboardingChoices JSON Structure:**

```typescript
interface OnboardingChoices {
  rosterStrategy: '1_mighty' | '2_average' | '3_flimsy';
  robotsCreated: number[];                    // Robot IDs created during onboarding
  weaponsPurchased: number[];                 // Weapon inventory IDs
  facilitiesPurchased: string[];              // Facility types purchased
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  preferredStance?: 'offensive' | 'defensive' | 'balanced';
  weaponTypesSelected?: string[];             // Energy, Ballistic, Melee, Shield
  budgetSpent: {
    facilities: number;
    robots: number;
    weapons: number;
    attributes: number;
  };
}
```

### ResetLog (New Database Table)

Track account resets for analytics:

```prisma
model ResetLog {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  
  // State before reset
  robotsDeleted      Int      @map("robots_deleted")
  weaponsDeleted     Int      @map("weapons_deleted")
  facilitiesDeleted  Int      @map("facilities_deleted")
  creditsBeforeReset Int      @map("credits_before_reset")
  
  // Reason (optional)
  reason    String?  @db.Text
  
  // Timestamp
  resetAt   DateTime @default(now()) @map("reset_at")
  
  @@index([userId])
  @@index([resetAt])
  @@map("reset_logs")
}
```

## Existing Component Reuse Analysis

**Critical Question**: Did you run a check to see whether you can reuse already existing functions/components?

**Answer**: Yes. Analysis of `app/frontend/src/components/` reveals the following reusable components:

### Components to Reuse (Existing)

1. **ConfirmationModal.tsx** → Use for reset account confirmation
   - Already handles confirmation dialogs with custom text
   - Reuse for "Are you sure you want to reset?" modal

2. **Toast.tsx** → Use for success/error notifications
   - Already implemented toast notification system
   - Reuse for "Tutorial completed!", "Account reset", error messages

3. **LoadoutSelector.tsx** → Use in Step 6 (Weapon Education)
   - Already implements loadout type selection UI
   - Reuse for teaching loadout types during onboarding

4. **StanceSelector.tsx** → Use in Step 6 (Weapon Education)
   - Already implements stance selection UI
   - Reuse for teaching battle stances during onboarding

5. **FacilityIcon.tsx** → Use in Step 3 (Facility Timing)
   - Already renders facility icons
   - Reuse for displaying facility recommendations

6. **FacilityROICalculator.tsx** → Use in Step 3 (Facility Timing)
   - Already calculates facility ROI
   - Reuse for showing facility value propositions

7. **HPBar.tsx** → Use in Step 8 (Battle Readiness)
   - Already renders HP bars
   - Reuse for showing robot health status

8. **BattleReadinessBadge.tsx** → Use in Step 8 (Battle Readiness)
   - Already displays battle readiness status
   - Reuse for showing if robot is ready to fight

9. **WeaponSlot.tsx** → Use in Step 7 (Weapon Purchase)
   - Already renders weapon slots
   - Reuse for showing equipped weapons

10. **FinancialSummary.tsx** → Adapt for budget tracker
    - Already displays credit information
    - Adapt for real-time budget tracking during onboarding

11. **TabNavigation.tsx** → Use for step navigation
    - Already implements tab-based navigation
    - Adapt for step-by-step progression indicator

12. **ComparisonBar.tsx** → Use in Step 4 (Budget Allocation)
    - Already renders comparison bars
    - Reuse for showing budget allocation vs recommendations

### Components to Create (New)

1. **OnboardingContainer.tsx** → Main onboarding orchestrator
2. **GuidedUIOverlay.tsx** → Semi-transparent overlay with tooltips
3. **ProgressIndicator.tsx** → Step progress bar (1/9, 2/9, etc.)
4. **BudgetTracker.tsx** → Real-time budget display (adapt FinancialSummary)
5. **RosterStrategyCard.tsx** → Strategy selection cards (1/2/3 robots)
6. **BudgetAllocationChart.tsx** → Pie/bar chart for budget visualization
7. **ResetAccountModal.tsx** → Account reset with validation (extend ConfirmationModal)
8. **Step1_Welcome.tsx** through **Step9_Completion.tsx** → Step-specific components

### Utility Functions to Reuse

Based on existing patterns in the codebase:

1. **API client functions** → Extend existing API service pattern
2. **Credit formatting** → Use existing credit formatting utilities
3. **Error handling** → Use existing error handling patterns
4. **Authentication** → Use existing auth context and protected routes

### Design System Consistency

All new components will follow existing design patterns:
- Use Tailwind CSS classes consistent with existing components
- Follow existing color scheme and spacing
- Match existing button styles and form inputs
- Use existing font sizes and typography
- Maintain existing accessibility patterns (ARIA labels, keyboard navigation)

## Components and Interfaces

### Frontend Components

#### OnboardingContainer

Main container that orchestrates the tutorial flow.


```typescript
interface OnboardingContainerProps {
  userId: number;
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingContainer: React.FC<OnboardingContainerProps> = ({
  userId,
  onComplete,
  onSkip
}) => {
  const { tutorialState, updateStep, completeStep } = useOnboarding();
  
  // Render current step component
  const renderStep = () => {
    switch (tutorialState.currentStep) {
      case 1: return <Step1_Welcome onNext={completeStep} />;
      case 2: return <Step2_RosterStrategy onNext={completeStep} />;
      // ... other steps
      case 9: return <Step9_Completion onComplete={onComplete} />;
    }
  };
  
  return (
    <div className="onboarding-container">
      <ProgressIndicator current={tutorialState.currentStep} total={9} />
      <BudgetTracker />
      {renderStep()}
      <button onClick={onSkip}>Skip Tutorial</button>
    </div>
  );
};
```

#### GuidedUIOverlay

Provides visual guidance with overlays and tooltips.

```typescript
interface GuidedUIOverlayProps {
  targetSelector: string;           // CSS selector for target element
  tooltipContent: React.ReactNode;  // Tooltip content
  position: 'top' | 'bottom' | 'left' | 'right';
  onNext?: () => void;
  onPrevious?: () => void;
  showNext: boolean;
  showPrevious: boolean;
}

const GuidedUIOverlay: React.FC<GuidedUIOverlayProps> = ({
  targetSelector,
  tooltipContent,
  position,
  onNext,
  onPrevious,
  showNext,
  showPrevious
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  useEffect(() => {
    const element = document.querySelector(targetSelector);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
      element.classList.add('onboarding-highlight');
    }
    
    return () => {
      element?.classList.remove('onboarding-highlight');
    };
  }, [targetSelector]);
  
  return (
    <>
      {/* Semi-transparent overlay */}
      <div className="onboarding-overlay" />
      
      {/* Highlighted target cutout */}
      {targetRect && (
        <div 
          className="onboarding-highlight-cutout"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height
          }}
        />
      )}
      
      {/* Tooltip */}
      {targetRect && (
        <Tooltip
          targetRect={targetRect}
          position={position}
          content={tooltipContent}
          onNext={onNext}
          onPrevious={onPrevious}
          showNext={showNext}
          showPrevious={showPrevious}
        />
      )}
    </>
  );
};
```

#### RosterStrategyCard

Displays roster strategy options with visual representations.

```typescript
interface RosterStrategyCardProps {
  strategy: '1_mighty' | '2_average' | '3_flimsy';
  selected: boolean;
  onSelect: (strategy: string) => void;
}

const RosterStrategyCard: React.FC<RosterStrategyCardProps> = ({
  strategy,
  selected,
  onSelect
}) => {
  const strategyData = {
    '1_mighty': {
      name: '1 Mighty Robot',
      description: 'Maximum power concentration, simplest management',
      robotCount: 1,
      battlesPerDay: '~2.2',
      powerLevel: 'Highest',
      complexity: 'Simplest',
      facilityInvestment: 'Lowest',
      advantages: [
        'Maximum power concentration',
        'Simplest management',
        'Lowest facility costs',
        'Fastest attribute progression'
      ],
      disadvantages: [
        'Single point of failure',
        'Fewer battles per day',
        'Limited strategic flexibility',
        'High repair costs if you lose'
      ],
      budgetBreakdown: {
        facilities: '₡400K-₡600K',
        robots: '₡500K',
        weapons: '₡300K-₡400K',
        attributes: '₡1,000K-₡1,200K',
        reserve: '₡500K-₡700K'
      }
    },
    // ... similar for 2_average and 3_flimsy
  };
  
  const data = strategyData[strategy];
  
  return (
    <div 
      className={`roster-strategy-card ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(strategy)}
    >
      <img src={`/assets/onboarding/roster-${strategy}.png`} alt={data.name} />
      <h3>{data.name}</h3>
      <p>{data.description}</p>
      
      <div className="strategy-stats">
        <div>Battles/Day: {data.battlesPerDay}</div>
        <div>Power: {data.powerLevel}</div>
        <div>Complexity: {data.complexity}</div>
      </div>
      
      <div className="strategy-details">
        <h4>Advantages</h4>
        <ul>
          {data.advantages.map((adv, i) => <li key={i}>{adv}</li>)}
        </ul>
        
        <h4>Disadvantages</h4>
        <ul>
          {data.disadvantages.map((dis, i) => <li key={i}>{dis}</li>)}
        </ul>
      </div>
      
      <BudgetBreakdownMini breakdown={data.budgetBreakdown} />
    </div>
  );
};
```

#### BudgetAllocationChart

Visual representation of budget allocation.


```typescript
interface BudgetAllocationChartProps {
  strategy: '1_mighty' | '2_average' | '3_flimsy';
  currentSpending: {
    facilities: number;
    robots: number;
    weapons: number;
    attributes: number;
  };
}

const BudgetAllocationChart: React.FC<BudgetAllocationChartProps> = ({
  strategy,
  currentSpending
}) => {
  const recommendations = {
    '1_mighty': {
      facilities: { min: 400000, max: 600000, color: '#3B82F6' },
      robots: { min: 500000, max: 500000, color: '#10B981' },
      weapons: { min: 300000, max: 400000, color: '#EF4444' },
      attributes: { min: 1000000, max: 1200000, color: '#F59E0B' },
      reserve: { min: 500000, max: 700000, color: '#6B7280' }
    },
    // ... similar for other strategies
  };
  
  const recommended = recommendations[strategy];
  const total = 3000000;
  
  return (
    <div className="budget-allocation-chart">
      <h3>Recommended Budget Allocation</h3>
      
      {/* Pie chart or bar chart */}
      <div className="chart-container">
        {/* Use chart library like recharts or chart.js */}
        <PieChart data={recommended} />
      </div>
      
      {/* Comparison table */}
      <table className="budget-comparison">
        <thead>
          <tr>
            <th>Category</th>
            <th>Recommended</th>
            <th>Your Spending</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Facilities</td>
            <td>₡{formatCredits(recommended.facilities.min)}-₡{formatCredits(recommended.facilities.max)}</td>
            <td>₡{formatCredits(currentSpending.facilities)}</td>
            <td>{getStatusBadge(currentSpending.facilities, recommended.facilities)}</td>
          </tr>
          {/* ... other rows */}
        </tbody>
      </table>
      
      {/* Real-time budget tracker */}
      <div className="budget-tracker">
        <div>Starting Budget: ₡3,000,000</div>
        <div>Spent: ₡{formatCredits(getTotalSpent(currentSpending))}</div>
        <div>Remaining: ₡{formatCredits(total - getTotalSpent(currentSpending))}</div>
      </div>
    </div>
  );
};
```

### Backend Services

#### OnboardingService

Manages tutorial state and progression.

```typescript
// services/onboardingService.ts

interface TutorialStateData {
  currentStep: number;
  completionStatus: 'in_progress' | 'completed' | 'skipped';
  rosterStrategy?: string;
  playerChoices: PlayerChoices;
}

export const onboardingService = {
  /**
   * Initialize tutorial state for new user
   */
  async initializeTutorialState(userId: number): Promise<TutorialState> {
    return await prisma.tutorialState.create({
      data: {
        userId,
        currentStep: 1,
        completionStatus: 'in_progress',
        playerChoices: {}
      }
    });
  },
  
  /**
   * Get tutorial state for user
   */
  async getTutorialState(userId: number): Promise<TutorialState | null> {
    return await prisma.tutorialState.findUnique({
      where: { userId }
    });
  },
  
  /**
   * Update tutorial state
   */
  async updateTutorialState(
    userId: number,
    updates: Partial<TutorialStateData>
  ): Promise<TutorialState> {
    return await prisma.tutorialState.update({
      where: { userId },
      data: {
        ...updates,
        lastActivityAt: new Date()
      }
    });
  },
  
  /**
   * Complete tutorial
   */
  async completeTutorial(userId: number): Promise<void> {
    await prisma.$transaction([
      prisma.tutorialState.update({
        where: { userId },
        data: {
          completionStatus: 'completed',
          completedAt: new Date()
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          hasCompletedOnboarding: true
        }
      })
    ]);
  },
  
  /**
   * Skip tutorial
   */
  async skipTutorial(userId: number): Promise<void> {
    await prisma.$transaction([
      prisma.tutorialState.update({
        where: { userId },
        data: {
          completionStatus: 'skipped',
          skippedAt: new Date()
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          hasCompletedOnboarding: true,
          onboardingSkipped: true
        }
      })
    ]);
  },
  
  /**
   * Advance to next step
   */
  async advanceStep(userId: number): Promise<TutorialState> {
    const state = await this.getTutorialState(userId);
    if (!state) throw new Error('Tutorial state not found');
    
    return await this.updateTutorialState(userId, {
      currentStep: Math.min(state.currentStep + 1, 9)
    });
  },
  
  /**
   * Update player choices
   */
  async updatePlayerChoices(
    userId: number,
    choices: Partial<PlayerChoices>
  ): Promise<TutorialState> {
    const state = await this.getTutorialState(userId);
    if (!state) throw new Error('Tutorial state not found');
    
    const currentChoices = state.playerChoices as PlayerChoices;
    const updatedChoices = { ...currentChoices, ...choices };
    
    return await this.updateTutorialState(userId, {
      playerChoices: updatedChoices
    });
  }
};
```

#### RecommendationEngine

Generates personalized recommendations based on player choices.


```typescript
// services/recommendationEngine.ts

interface Recommendation {
  type: 'facility' | 'weapon' | 'attribute' | 'strategy';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  estimatedCost?: number;
}

export const recommendationEngine = {
  /**
   * Generate facility recommendations based on player choices
   */
  generateFacilityRecommendations(
    rosterStrategy: string,
    loadoutType?: string,
    stance?: string
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Mandatory facilities based on roster strategy
    if (rosterStrategy === '2_average' || rosterStrategy === '3_flimsy') {
      recommendations.push({
        type: 'facility',
        priority: 'high',
        title: 'Roster Expansion',
        description: 'Required to create additional robots',
        reasoning: `Your ${rosterStrategy === '2_average' ? '2 robot' : '3 robot'} strategy requires Roster Expansion facility`,
        estimatedCost: rosterStrategy === '2_average' ? 150000 : 450000
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
    if (rosterStrategy === '3_flimsy') {
      recommendations.push({
        type: 'facility',
        priority: 'medium',
        title: 'Storage Facility',
        description: 'Increases weapon storage capacity',
        reasoning: 'With 3 robots, you need 3-6 weapons. Storage Facility prevents "storage full" errors',
        estimatedCost: 100000
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  },
  
  /**
   * Generate weapon recommendations
   */
  generateWeaponRecommendations(
    rosterStrategy: string,
    loadoutType?: string,
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
    } else {
      recommendations.push({
        type: 'weapon',
        priority: 'high',
        title: 'Laser Rifle',
        description: 'Precise, consistent damage with attribute bonuses',
        reasoning: 'Balanced starter weapon at ₡244K. Good all-around choice',
        estimatedCost: 244000
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
    
    return recommendations;
  },
  
  /**
   * Generate attribute upgrade recommendations
   */
  generateAttributeRecommendations(
    rosterStrategy: string,
    loadoutType?: string,
    stance?: string
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Strategy-specific attribute focus
    if (rosterStrategy === '1_mighty') {
      recommendations.push({
        type: 'attribute',
        priority: 'high',
        title: 'Focus on Single Robot',
        description: 'Concentrate attribute upgrades on your one robot',
        reasoning: 'With 1 mighty robot strategy, invest heavily in your single robot\'s attributes',
        estimatedCost: 1000000
      });
    }
    
    // Loadout-specific attributes
    if (loadoutType === 'weapon_shield') {
      recommendations.push({
        type: 'attribute',
        priority: 'medium',
        title: 'Armor and Shield Attributes',
        description: 'Prioritize armorPlating and shieldCapacity',
        reasoning: 'Your weapon+shield loadout benefits from defensive attributes',
        estimatedCost: 300000
      });
    }
    
    if (loadoutType === 'two_handed') {
      recommendations.push({
        type: 'attribute',
        priority: 'medium',
        title: 'Power and Critical Attributes',
        description: 'Prioritize combatPower and criticalSystems',
        reasoning: 'Your two-handed loadout benefits from damage-focused attributes',
        estimatedCost: 300000
      });
    }
    
    return recommendations;
  },
  
  /**
   * Calculate recommended budget allocation
   */
  calculateBudgetAllocation(rosterStrategy: string): {
    facilities: { min: number; max: number };
    robots: { min: number; max: number };
    weapons: { min: number; max: number };
    attributes: { min: number; max: number };
    reserve: { min: number; max: number };
  } {
    const allocations = {
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
    
    return allocations[rosterStrategy as keyof typeof allocations];
  }
};
```

#### ResetService

Handles account reset functionality with validation.


```typescript
// services/resetService.ts

interface ResetValidationResult {
  canReset: boolean;
  blockers: string[];
}

export const resetService = {
  /**
   * Validate if user can reset their account
   */
  async validateResetEligibility(userId: number): Promise<ResetValidationResult> {
    const blockers: string[] = [];
    
    // Check for scheduled matches
    const scheduledMatches = await prisma.scheduledMatch.count({
      where: {
        OR: [
          { robot1: { userId } },
          { robot2: { userId } }
        ],
        status: 'scheduled'
      }
    });
    
    if (scheduledMatches > 0) {
      blockers.push('You have scheduled battles. Removing robots would create conflicts.');
    }
    
    // Check for active tournament participation
    const activeTournaments = await prisma.tournamentMatch.count({
      where: {
        OR: [
          { robot1: { userId } },
          { robot2: { userId } }
        ],
        status: { in: ['pending', 'scheduled'] }
      }
    });
    
    if (activeTournaments > 0) {
      blockers.push('You are participating in an active tournament.');
    }
    
    // Check for pending battle results
    const pendingBattles = await prisma.battle.count({
      where: {
        OR: [
          { robot1: { userId } },
          { robot2: { userId } }
        ],
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      }
    });
    
    if (pendingBattles > 0) {
      blockers.push('You have recent battle results being processed.');
    }
    
    // Check for active facility construction/upgrades
    // (This would require a facility upgrade queue system if implemented)
    
    return {
      canReset: blockers.length === 0,
      blockers
    };
  },
  
  /**
   * Perform account reset
   */
  async performAccountReset(userId: number, reason?: string): Promise<void> {
    // Validate eligibility first
    const validation = await this.validateResetEligibility(userId);
    if (!validation.canReset) {
      throw new Error(`Cannot reset account: ${validation.blockers.join(', ')}`);
    }
    
    // Get current state for logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        robots: true,
        weaponInventory: true,
        facilities: true
      }
    });
    
    if (!user) throw new Error('User not found');
    
    // Perform reset in transaction
    await prisma.$transaction(async (tx) => {
      // Log reset event
      await tx.resetLog.create({
        data: {
          userId,
          robotsDeleted: user.robots.length,
          weaponsDeleted: user.weaponInventory.length,
          facilitiesDeleted: user.facilities.length,
          creditsBeforeReset: user.currency,
          reason
        }
      });
      
      // Delete all robots (cascades to battles, scheduled matches, etc.)
      await tx.robot.deleteMany({
        where: { userId }
      });
      
      // Delete all weapon inventory
      await tx.weaponInventory.deleteMany({
        where: { userId }
      });
      
      // Delete all facilities
      await tx.facility.deleteMany({
        where: { userId }
      });
      
      // Reset user credits
      await tx.user.update({
        where: { id: userId },
        data: {
          currency: 3000000,
          hasCompletedOnboarding: false,
          onboardingSkipped: false
        }
      });
      
      // Reset tutorial state
      await tx.tutorialState.upsert({
        where: { userId },
        create: {
          userId,
          currentStep: 1,
          completionStatus: 'in_progress',
          playerChoices: {}
        },
        update: {
          currentStep: 1,
          completionStatus: 'in_progress',
          rosterStrategy: null,
          playerChoices: {},
          completedAt: null,
          skippedAt: null
        }
      });
    });
  },
  
  /**
   * Get reset history for user
   */
  async getResetHistory(userId: number): Promise<ResetLog[]> {
    return await prisma.resetLog.findMany({
      where: { userId },
      orderBy: { resetAt: 'desc' }
    });
  }
};
```

### API Endpoints

#### Onboarding Routes

```typescript
// routes/onboarding.ts

import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { onboardingService } from '../services/onboardingService';
import { recommendationEngine } from '../services/recommendationEngine';
import { resetService } from '../services/resetService';

const router = express.Router();

/**
 * GET /api/onboarding/state
 * Get current tutorial state for authenticated user
 */
router.get('/state', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    let state = await onboardingService.getTutorialState(userId);
    
    // Initialize if doesn't exist
    if (!state) {
      state = await onboardingService.initializeTutorialState(userId);
    }
    
    res.json({
      success: true,
      data: state
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get tutorial state' }
    });
  }
});

/**
 * POST /api/onboarding/state
 * Update tutorial state
 */
router.post('/state', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { currentStep, rosterStrategy, playerChoices } = req.body;
    
    const state = await onboardingService.updateTutorialState(userId, {
      currentStep,
      rosterStrategy,
      playerChoices
    });
    
    res.json({
      success: true,
      data: state
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update tutorial state' }
    });
  }
});

/**
 * POST /api/onboarding/complete
 * Mark tutorial as completed
 */
router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    await onboardingService.completeTutorial(userId);
    
    res.json({
      success: true,
      message: 'Tutorial completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to complete tutorial' }
    });
  }
});

/**
 * POST /api/onboarding/skip
 * Skip tutorial
 */
router.post('/skip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    await onboardingService.skipTutorial(userId);
    
    res.json({
      success: true,
      message: 'Tutorial skipped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to skip tutorial' }
    });
  }
});

/**
 * GET /api/onboarding/recommendations
 * Get personalized recommendations
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const state = await onboardingService.getTutorialState(userId);
    
    if (!state) {
      return res.status(404).json({
        success: false,
        error: { message: 'Tutorial state not found' }
      });
    }
    
    const choices = state.playerChoices as any;
    
    const recommendations = {
      facilities: recommendationEngine.generateFacilityRecommendations(
        choices.rosterStrategy,
        choices.loadoutType,
        choices.preferredStance
      ),
      weapons: recommendationEngine.generateWeaponRecommendations(
        choices.rosterStrategy,
        choices.loadoutType
      ),
      attributes: recommendationEngine.generateAttributeRecommendations(
        choices.rosterStrategy,
        choices.loadoutType,
        choices.preferredStance
      )
    };
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate recommendations' }
    });
  }
});

/**
 * POST /api/onboarding/reset-account
 * Reset account to starting state
 */
router.post('/reset-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { reason, confirmation } = req.body;
    
    // Require confirmation text
    if (confirmation !== 'RESET' && confirmation !== 'START OVER') {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid confirmation text' }
      });
    }
    
    // Validate eligibility
    const validation = await resetService.validateResetEligibility(userId);
    if (!validation.canReset) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Cannot reset account',
          blockers: validation.blockers
        }
      });
    }
    
    // Perform reset
    await resetService.performAccountReset(userId, reason);
    
    res.json({
      success: true,
      message: 'Account reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to reset account' }
    });
  }
});

/**
 * GET /api/onboarding/reset-eligibility
 * Check if user can reset account
 */
router.get('/reset-eligibility', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const validation = await resetService.validateResetEligibility(userId);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Failed to check reset eligibility' }
    });
  }
});

export default router;
```

## Error Handling

### Frontend Error Handling


**Error Scenarios:**

1. **Tutorial State Not Found**: Initialize new state automatically
2. **Network Errors**: Show retry button with error message
3. **Invalid Step Transition**: Prevent navigation, show warning
4. **Reset Blocked**: Display specific blockers to user
5. **Session Timeout**: Redirect to login, preserve tutorial state

**Error Display Component:**

```typescript
const OnboardingError: React.FC<{ error: Error; onRetry: () => void }> = ({
  error,
  onRetry
}) => {
  return (
    <div className="onboarding-error">
      <h3>Something went wrong</h3>
      <p>{error.message}</p>
      <button onClick={onRetry}>Try Again</button>
    </div>
  );
};
```

### Backend Error Handling

**Error Response Format:**

```typescript
{
  success: false,
  error: {
    code: 'ONBOARDING_ERROR_CODE',
    message: 'User-friendly error message',
    details?: any  // Optional, development only
  }
}
```

**Error Codes:**

- `TUTORIAL_STATE_NOT_FOUND`: Tutorial state doesn't exist
- `INVALID_STEP_TRANSITION`: Attempted to skip steps
- `RESET_BLOCKED`: Account reset not allowed
- `SCHEDULED_MATCHES_EXIST`: Cannot reset with scheduled battles
- `TOURNAMENT_ACTIVE`: Cannot reset during tournament
- `INVALID_CONFIRMATION`: Reset confirmation text incorrect

## Testing Strategy

### Unit Tests

**Frontend Component Tests:**

- OnboardingContainer renders correct step
- GuidedUIOverlay positions tooltip correctly
- RosterStrategyCard selection updates state
- BudgetAllocationChart displays correct data
- ResetAccountModal validates confirmation text

**Backend Service Tests:**

- onboardingService.initializeTutorialState creates state
- onboardingService.advanceStep increments step correctly
- recommendationEngine generates correct recommendations
- resetService.validateResetEligibility checks all constraints
- resetService.performAccountReset deletes data correctly

### Integration Tests

**Tutorial Flow Tests:**

- Complete full tutorial flow from step 1 to 9
- Skip tutorial and verify state
- Resume tutorial after logout
- Reset account and restart tutorial

**Recommendation Tests:**

- Generate recommendations for 1 mighty robot strategy
- Generate recommendations for weapon+shield loadout
- Generate recommendations for defensive stance
- Verify recommendations adapt to player choices

**Reset Tests:**

- Reset account with no scheduled matches
- Attempt reset with scheduled matches (should fail)
- Attempt reset during tournament (should fail)
- Verify all data deleted after reset
- Verify credits reset to ₡3,000,000

### Property-Based Tests

Property tests will be defined after prework analysis in the Correctness Properties section.

## Image Specifications for Designers

**Critical Question**: For the image specifications, also explain where you expect those files (which folder).

**Answer**: All onboarding images will be stored in a dedicated folder structure within the frontend public assets directory.

### File Organization Structure

```
app/frontend/public/assets/onboarding/
├── strategies/
│   ├── roster-1-mighty.png
│   ├── roster-2-average.png
│   └── roster-3-flimsy.png
├── loadouts/
│   ├── loadout-single.png
│   ├── loadout-weapon-shield.png
│   ├── loadout-two-handed.png
│   └── loadout-dual-wield.png
├── facilities/
│   ├── facility-roster-expansion.png
│   ├── facility-weapons-workshop.png
│   ├── facility-training-facility.png
│   ├── facility-storage-facility.png
│   ├── facility-repair-bay.png
│   ├── facility-defense-academy.png
│   └── facility-power-academy.png
├── battles/
│   ├── battle-league.png
│   ├── battle-tag-team.png
│   └── battle-tournament.png
├── charts/
│   ├── budget-chart-1-mighty.png
│   ├── budget-chart-2-average.png
│   └── budget-chart-3-flimsy.png
└── diagrams/
    ├── attribute-bonus-stacking.png
    └── cycle-schedule.png
```

### Naming Conventions

- **Lowercase with hyphens**: `roster-1-mighty.png` (not `Roster_1_Mighty.png`)
- **Descriptive names**: Clearly indicate what the image shows
- **Consistent prefixes**: Group related images with common prefixes
- **PNG format**: Use PNG for diagrams and illustrations (supports transparency)
- **Optimized file sizes**: Target < 100KB per image for fast loading

### Usage in Code

```typescript
// Import images in React components
import roster1Mighty from '/assets/onboarding/strategies/roster-1-mighty.png';
import loadoutSingle from '/assets/onboarding/loadouts/loadout-single.png';

// Or use public path directly
<img src="/assets/onboarding/strategies/roster-1-mighty.png" alt="1 Mighty Robot Strategy" />
```

### Responsive Image Strategy

For mobile optimization, consider providing multiple sizes:

```
app/frontend/public/assets/onboarding/
├── strategies/
│   ├── roster-1-mighty.png          (400×300px - desktop)
│   ├── roster-1-mighty@2x.png       (800×600px - retina)
│   └── roster-1-mighty-mobile.png   (300×225px - mobile)
```

Usage with responsive images:

```typescript
<img 
  src="/assets/onboarding/strategies/roster-1-mighty.png"
  srcSet="/assets/onboarding/strategies/roster-1-mighty@2x.png 2x,
          /assets/onboarding/strategies/roster-1-mighty-mobile.png 300w"
  sizes="(max-width: 768px) 300px, 400px"
  alt="1 Mighty Robot Strategy"
/>
```

### Image Specifications for Designers

### Roster Strategy Images

**File Names:**
- `roster-1-mighty.png`
- `roster-2-average.png`
- `roster-3-flimsy.png`

**Dimensions:** 400×300px

**Content:**
- Visual representation of robot count (1, 2, or 3 robots)
- Robots should appear proportionally sized (1 mighty = large, 3 flimsy = small)
- Clean, simple design matching game aesthetic
- Transparent or solid background

### Loadout Diagrams

**File Names:**
- `loadout-single.png`
- `loadout-weapon-shield.png`
- `loadout-two-handed.png`
- `loadout-dual-wield.png`

**Dimensions:** 300×200px

**Content:**
- Schematic showing weapon configuration
- Main weapon slot and offhand weapon slot clearly labeled
- Visual indicators for bonuses (+10% Gyro, etc.)
- Consistent style across all diagrams

### Facility Icons

**File Names:**
- `facility-roster-expansion.png`
- `facility-weapons-workshop.png`
- `facility-training-facility.png`
- `facility-storage-facility.png`
- `facility-repair-bay.png`
- `facility-defense-academy.png`
- `facility-power-academy.png`

**Dimensions:** 64×64px

**Content:**
- Icon representing facility function
- Consistent style with existing facility icons
- Clear, recognizable at small size

### Battle Type Illustrations

**File Names:**
- `battle-league.png`
- `battle-tag-team.png`
- `battle-tournament.png`

**Dimensions:** 600×400px

**Content:**
- Scene depicting battle type
- League: 1v1 combat
- Tag Team: 2v2 with tag-in mechanic
- Tournament: Bracket-style competition
- Action-oriented, engaging visuals

### Budget Allocation Charts

**File Names:**
- `budget-chart-1-mighty.png`
- `budget-chart-2-average.png`
- `budget-chart-3-flimsy.png`

**Dimensions:** 400×400px

**Content:**
- Pie chart or bar chart showing credit distribution
- Color-coded categories (facilities, robots, weapons, attributes, reserve)
- Percentages and credit amounts labeled
- Clean, readable design

### Attribute Bonus Visualization

**File Name:** `attribute-bonus-stacking.png`

**Dimensions:** 500×300px

**Content:**
- Diagram showing how weapon bonuses add to robot attributes
- Example: Robot attribute (10) + Weapon bonus (+5) = Effective attribute (15)
- Visual representation of stacking
- Clear labels and arrows

### Cycle Schedule Timeline

**File Name:** `cycle-schedule.png`

**Dimensions:** 800×200px

**Content:**
- Timeline showing daily cycle events
- League cycle (8 PM UTC)
- Tag Team cycle (12 PM UTC)
- Tournament cycle (varies)
- Settlement cycle (11 PM UTC)
- Time markers and labels

## Navigation Flow Recommendations

### Current Navigation Issues

Based on onboarding flow, the following navigation issues may exist:

1. **Facility Page Accessibility**: Facilities are critical early decisions but may not be prominent
2. **Weapon Shop Visibility**: Players need easy access after learning about weapons
3. **Robot Management**: Should be central after robot creation
4. **Battle Results**: Players need to find battle history easily

### Proposed Navigation Structure

**Primary Navigation (Desktop):**

```
┌─────────────────────────────────────────────────────────────┐
│  Logo  │  Dashboard  │  My Robots  │  Facilities  │  Shop  │
│        │             │             │              │         │
│        │  Battles    │  Leagues    │  Profile     │  Admin │
└─────────────────────────────────────────────────────────────┘
```

**Mobile Navigation (Bottom Bar):**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      Content Area                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Dashboard│ Robots   │ Facilities│ Shop    │ More     │
│    🏠    │   🤖     │    🏭    │   🛒    │   ⋯      │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Grouped Navigation:**

- **My Stable**: Dashboard, Robots, Facilities
- **Competition**: Battles, Leagues, Tournaments, Tag Teams
- **Economy**: Shop, Finances, Repairs
- **Community**: Leaderboards, Hall of Records, Profile

### Navigation Changes Required

1. **Promote Facilities**: Move from secondary to primary navigation
2. **Consolidate Shop**: Single "Shop" entry with tabs for weapons, facilities, etc.
3. **Battle Hub**: Group all battle-related pages (history, results, scheduled)
4. **Quick Actions**: Add quick action buttons on dashboard for common tasks

### Migration Strategy

1. **Phase 1**: Add new navigation structure alongside existing
2. **Phase 2**: A/B test with new players from onboarding
3. **Phase 3**: Migrate existing players with announcement
4. **Phase 4**: Remove old navigation structure

## Mobile Responsiveness

### Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Mobile Adaptations

**Tooltip Positioning:**
- Use full-width tooltips on mobile
- Position above or below target (never left/right)
- Ensure tooltips don't cover target element

**Touch Targets:**
- Minimum 44×44px for all interactive elements
- Increase spacing between buttons
- Use larger fonts (minimum 14px)

**Overlay Behavior:**
- Disable horizontal scrolling during tutorial
- Use viewport-relative positioning
- Test on iOS Safari and Android Chrome

**Image Optimization:**
- Serve smaller images on mobile (< 100KB)
- Use responsive images with srcset
- Lazy load images below the fold

## Accessibility

### Keyboard Navigation

**Supported Keys:**
- **Tab**: Navigate between interactive elements
- **Enter**: Activate buttons, advance steps
- **Escape**: Close overlays, skip tutorial
- **Arrow Keys**: Navigate between strategy cards

### Screen Reader Support

**ARIA Labels:**
- All interactive elements have aria-label
- Step changes announced with aria-live regions
- Progress indicator has aria-valuenow, aria-valuemin, aria-valuemax

**Focus Management:**
- Focus moves to tooltip when step changes
- Focus returns to trigger element when overlay closes
- Focus trap within modal dialogs

### Contrast Requirements

**WCAG 2.1 AA Compliance:**
- Text contrast ratio: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- Interactive elements: 3:1 minimum

**Color Coding:**
- Don't rely solely on color to convey information
- Use icons, labels, and patterns in addition to color

## Performance Optimization

### Loading Strategy

**Preload Tutorial Content:**
- Load tutorial assets during registration
- Cache tutorial images in browser storage
- Prefetch next step content

**Lazy Loading:**
- Load step components on demand
- Defer non-critical images
- Use code splitting for step components

### API Optimization

**Batch Requests:**
- Fetch tutorial state and user data in single request
- Update tutorial state with debouncing (500ms)
- Cache recommendations for 5 minutes

### Rendering Performance

**Optimization Techniques:**
- Use React.memo for step components
- Memoize recommendation calculations
- Virtualize long lists (facility priorities, weapon recommendations)
- Optimize re-renders with useCallback and useMemo

### Performance Targets

- **Initial Load**: < 2 seconds
- **Step Transition**: < 100ms
- **Tooltip Render**: < 50ms
- **API Response**: < 500ms

Now I'll use the prework tool to analyze the acceptance criteria before writing the Correctness Properties section.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Sequential Step Enforcement

*For any* tutorial state with current step N (where 1 ≤ N < 9), attempting to navigate to step N+2 or higher should be blocked, and only step N+1 should be accessible after completing step N.

**Validates: Requirements 2.1, 2.3**

### Property 2: Tutorial State Persistence Across Sessions

*For any* user with incomplete tutorial state, logging out and logging back in should resume the tutorial at the same step with all player choices preserved.

**Validates: Requirements 1.3, 20.1, 20.3**

### Property 3: Completed Tutorial Suppression

*For any* user with completionStatus = 'completed' or 'skipped', the onboarding system should not display tutorial prompts or overlays.

**Validates: Requirements 1.5, 20.5**

### Property 4: Previous Step Review Access

*For any* completed step N (where N < currentStep), the user should be able to view step N in read-only mode without affecting currentStep.

**Validates: Requirements 2.5**

### Property 5: Roster Strategy Persistence

*For any* tutorial state where rosterStrategy has been set, the value should remain unchanged throughout the tutorial unless explicitly modified by the user, and all subsequent guidance should reference this strategy.

**Validates: Requirements 2.6, 2.7**

### Property 6: Insufficient Credits Blocking

*For any* purchase attempt where user.currency < purchaseCost, the transaction should be blocked and an error message should be displayed.

**Validates: Requirements 3.1**

### Property 7: Low Reserve Warning Threshold

*For any* transaction that would result in user.currency < 50000, an advisory warning should be displayed (but transaction should not be blocked).

**Validates: Requirements 3.3**

### Property 8: Critical Budget Warning Threshold

*For any* user with currency < 600000, a warning against additional spending should be displayed.

**Validates: Requirements 3.6**

### Property 9: Facility Purchase Blocking Before Strategy

*For any* facility purchase attempt when currentStep < 4 (before budget allocation step), the purchase should be blocked with an explanation message.

**Validates: Requirements 3.5, 23.1**

### Property 10: Strategy-Specific Budget Recommendations

*For any* roster strategy selection ('1_mighty', '2_average', '3_flimsy'), the displayed budget allocation should match the predefined ranges for that strategy (facilities, robots, weapons, attributes, reserve).

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 11: Strategy Card Completeness

*For any* roster strategy card displayed, it should contain all required fields: name, description, robot count, battles per day, power level, complexity, facility investment, advantages list, disadvantages list, and budget breakdown.

**Validates: Requirements 4.2**

### Property 12: Personalized Facility Recommendations

*For any* combination of (rosterStrategy, loadoutType, stance), the recommendation engine should generate contextually appropriate facility recommendations with correct priority levels.

**Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6**

### Property 13: Repair Cost Formula Accuracy

*For any* robot with attributes, the calculated repair cost should equal (sum_of_all_attributes × 100) × damage_percentage, where damage_percentage = damageTaken / maxHP.

**Validates: Requirements 12.2**

### Property 14: Reset Eligibility Validation

*For any* user, account reset should only be allowed if ALL of the following conditions are true: no scheduled matches exist, no active tournament participation, no pending battle results, and no active facility construction.

**Validates: Requirements 14.5, 14.6, 14.7, 14.8**

### Property 15: Reset Confirmation Text Validation

*For any* reset confirmation attempt, the reset should only proceed if the confirmation text exactly matches "RESET" or "START OVER" (case-sensitive).

**Validates: Requirements 14.10**

### Property 16: Complete Reset Data Deletion

*For any* successful account reset, the following should occur atomically: all robots deleted, all weapon inventory deleted, all facilities deleted, credits reset to 3000000, tutorial state reset to step 1 with completionStatus = 'in_progress'.

**Validates: Requirements 14.11**

### Property 17: Post-Reset Tutorial Restart

*For any* user who completes account reset, their currentStep should be 1 and they should be redirected to the onboarding page.

**Validates: Requirements 14.12**

### Property 18: Budget Tracker Real-Time Accuracy

*For any* spending action during onboarding, the budget tracker should immediately reflect: starting budget (3000000), total spent (sum of all purchases), and remaining (3000000 - total spent).

**Validates: Requirements 19.4, 19.5**

### Property 19: Strategy Selection Storage

*For any* roster strategy selection, the choice should be immediately stored in tutorialState.rosterStrategy and tutorialState.playerChoices, and subsequent API calls should reflect this choice.

**Validates: Requirements 4.7**

### Property 20: Battle Readiness Validation

*For any* robot, battle readiness should be true if and only if: currentHP > 0 AND (mainWeaponId IS NOT NULL OR offhandWeaponId IS NOT NULL).

**Validates: Requirements 23.4**

### Property 21: Skip Tutorial State Update

*For any* user who skips the tutorial, their tutorialState should be updated with: completionStatus = 'skipped', skippedAt = current timestamp, and user.hasCompletedOnboarding = true, user.onboardingSkipped = true.

**Validates: Requirements 22.4, 22.6**

### Property 22: Resume Tutorial Reset

*For any* user who resumes a skipped tutorial, their tutorialState should be reset to: currentStep = 1, completionStatus = 'in_progress', skippedAt = null.

**Validates: Requirements 22.7**

### Property 23: Analytics Event Logging

*For any* step completion, skip action, or reset action, an analytics event should be logged with: userId, eventType, timestamp, and relevant metadata (step number, reason, etc.).

**Validates: Requirements 26.1, 26.2, 26.3, 26.13**

### Property 24: Localization Fallback

*For any* requested language that is not available, the system should fallback to English content while maintaining the same structure and functionality.

**Validates: Requirements 27.7**

### Property 25: Performance Target Compliance

*For any* step transition, the new step content should render within 100ms, and API responses should complete within 500ms.

**Validates: Requirements 28.3, 28.4**

### Property 26: Weapon Recommendation Adaptation

*For any* loadout type selection, the weapon recommendations should include weapons compatible with that loadout (e.g., shield for weapon_shield, two one-handed weapons for dual_wield).

**Validates: Requirements 10.11, 10.12**

### Property 27: Attribute Recommendation Synergy

*For any* combination of (loadoutType, stance), the attribute recommendations should prioritize attributes that synergize with the chosen loadout and stance (e.g., armor/shield for weapon_shield + defensive).

**Validates: Requirements 13.3, 13.4**

### Property 28: Facility ROI Calculation Accuracy

*For any* facility with discount benefits (Weapons Workshop, Training Facility, Repair Bay), the displayed ROI calculation should accurately reflect: facility cost, discount percentage, and break-even point based on expected usage.

**Validates: Requirements 18.2, 18.3, 18.6, 18.7**

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, UI component rendering, API endpoint responses, and edge cases
- **Property tests**: Verify universal properties across all inputs (tutorial states, user choices, budget calculations)

### Unit Testing Focus

Unit tests should cover:

- **Component Rendering**: Each step component renders correctly with required elements
- **UI Interactions**: Button clicks, form submissions, navigation work as expected
- **API Integration**: Endpoints return correct response formats
- **Error Handling**: Error states display appropriate messages
- **Edge Cases**: Empty states, boundary values, invalid inputs

**Example Unit Tests:**

```typescript
describe('OnboardingContainer', () => {
  it('should render step 1 on initial load', () => {
    const { getByText } = render(<OnboardingContainer userId={1} />);
    expect(getByText('Welcome to Armoured Souls')).toBeInTheDocument();
  });
  
  it('should display skip button', () => {
    const { getByText } = render(<OnboardingContainer userId={1} />);
    expect(getByText('Skip Tutorial')).toBeInTheDocument();
  });
});

describe('RosterStrategyCard', () => {
  it('should display all required strategy information', () => {
    const { getByText } = render(
      <RosterStrategyCard strategy="1_mighty" selected={false} onSelect={jest.fn()} />
    );
    expect(getByText('1 Mighty Robot')).toBeInTheDocument();
    expect(getByText(/Maximum power concentration/)).toBeInTheDocument();
  });
});

describe('ResetService', () => {
  it('should block reset when scheduled matches exist', async () => {
    // Create user with scheduled match
    const user = await createTestUser();
    await createScheduledMatch(user.id);
    
    const validation = await resetService.validateResetEligibility(user.id);
    expect(validation.canReset).toBe(false);
    expect(validation.blockers).toContain('You have scheduled battles');
  });
});
```

### Property-Based Testing Focus

Property tests should verify universal behaviors across randomized inputs:

- **Tutorial State Transitions**: Sequential step enforcement
- **Budget Calculations**: Accurate tracking and warnings
- **Recommendation Engine**: Contextually appropriate suggestions
- **Reset Validation**: Constraint checking
- **Persistence**: State survives logout/login cycles

**Property Test Configuration:**
- Minimum 100 iterations per property test
- Use fast-check library for TypeScript
- Tag each test with feature name and property number

**Example Property Tests:**

```typescript
import fc from 'fast-check';

describe('Property 1: Sequential Step Enforcement', () => {
  it('should block access to steps beyond current + 1', () => {
    /**
     * Feature: new-player-onboarding, Property 1: Sequential Step Enforcement
     * For any tutorial state with current step N (where 1 ≤ N < 9), 
     * attempting to navigate to step N+2 or higher should be blocked
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 7 }), // currentStep
        fc.integer({ min: 2, max: 9 }), // attemptedStep offset
        async (currentStep, offset) => {
          const attemptedStep = currentStep + offset;
          if (attemptedStep > currentStep + 1) {
            const result = await onboardingService.updateTutorialState(userId, {
              currentStep: attemptedStep
            });
            // Should either fail or not update to attemptedStep
            expect(result.currentStep).toBeLessThanOrEqual(currentStep + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 13: Repair Cost Formula Accuracy', () => {
  it('should calculate repair cost correctly for any robot', () => {
    /**
     * Feature: new-player-onboarding, Property 13: Repair Cost Formula Accuracy
     * For any robot with attributes, repair cost = (sum_of_attributes × 100) × damage_percentage
     */
    fc.assert(
      fc.property(
        fc.record({
          // Generate random attribute values (1.00 - 50.00)
          combatPower: fc.float({ min: 1, max: 50 }),
          targetingSystems: fc.float({ min: 1, max: 50 }),
          // ... all 23 attributes
          damageTaken: fc.integer({ min: 0, max: 500 }),
          maxHP: fc.integer({ min: 100, max: 500 })
        }),
        (robotData) => {
          const sumOfAttributes = Object.values(robotData)
            .filter((v, i) => i < 23) // First 23 are attributes
            .reduce((sum, val) => sum + val, 0);
          
          const damagePercentage = robotData.damageTaken / robotData.maxHP;
          const expectedCost = Math.floor(sumOfAttributes * 100 * damagePercentage);
          
          const calculatedCost = calculateRepairCost(robotData);
          expect(calculatedCost).toBe(expectedCost);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 14: Reset Eligibility Validation', () => {
  it('should only allow reset when all constraints are met', () => {
    /**
     * Feature: new-player-onboarding, Property 14: Reset Eligibility Validation
     * For any user, reset allowed only if: no scheduled matches, no tournaments, 
     * no pending battles, no facility construction
     */
    fc.assert(
      fc.property(
        fc.record({
          hasScheduledMatches: fc.boolean(),
          hasActiveTournaments: fc.boolean(),
          hasPendingBattles: fc.boolean(),
          hasFacilityConstruction: fc.boolean()
        }),
        async (constraints) => {
          const user = await createTestUserWithConstraints(constraints);
          const validation = await resetService.validateResetEligibility(user.id);
          
          const shouldAllow = !constraints.hasScheduledMatches &&
                            !constraints.hasActiveTournaments &&
                            !constraints.hasPendingBattles &&
                            !constraints.hasFacilityConstruction;
          
          expect(validation.canReset).toBe(shouldAllow);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests should verify end-to-end flows:

- Complete tutorial flow from step 1 to 9
- Skip tutorial and verify state
- Reset account and restart tutorial
- Recommendation engine with real database data
- Budget tracking across multiple purchases

### Test Coverage Requirements

- **Minimum 80% code coverage** for general onboarding code
- **Minimum 90% code coverage** for critical functionality:
  - Reset validation and execution
  - Budget calculations and warnings
  - Recommendation engine
  - Tutorial state persistence


## Deployment Considerations

### Existing Player Migration Strategy

**Critical Question**: What do we do with players already in the database who have configured robots and spent credits?

**Answer**: All existing players will be marked as having completed onboarding during deployment.

**Migration Script:**

```sql
-- Mark all existing users as having completed onboarding
-- Run this BEFORE deploying the onboarding feature
UPDATE users 
SET 
  has_completed_onboarding = TRUE,
  onboarding_step = 9,
  onboarding_started_at = created_at,
  onboarding_completed_at = created_at
WHERE created_at < '2026-03-15 00:00:00';  -- Deployment timestamp

-- Log migration for audit
INSERT INTO audit_logs (cycle_number, event_type, event_timestamp, sequence_number, payload)
VALUES (
  (SELECT COALESCE(MAX(total_cycles), 0) FROM cycle_metadata),
  'onboarding_migration_existing_users',
  NOW(),
  (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM audit_logs WHERE cycle_number = (SELECT COALESCE(MAX(total_cycles), 0) FROM cycle_metadata)),
  jsonb_build_object(
    'users_migrated', (SELECT COUNT(*) FROM users WHERE created_at < '2026-03-15 00:00:00'),
    'migration_timestamp', NOW()
  )
);
```

**Existing Player Experience:**

1. **No Tutorial Prompts**: Existing players will never see the onboarding tutorial
2. **Optional Tutorial Access**: Add "View Tutorial" link in user settings/help menu
   - Opens tutorial in read-only mode
   - Cannot modify account or make purchases
   - Allows existing players to learn about features they may have missed
3. **No Account Reset**: Existing players cannot use the reset functionality (only available during onboarding)

**Distinguishing New vs Existing Players:**

```typescript
// Backend service
export const isNewPlayer = (user: User): boolean => {
  return !user.hasCompletedOnboarding && user.onboardingStep < 9;
};

export const shouldShowOnboarding = (user: User): boolean => {
  // Show onboarding if:
  // 1. User hasn't completed it
  // 2. User hasn't skipped it
  // 3. User has no robots (safety check)
  return !user.hasCompletedOnboarding && 
         !user.onboardingSkipped && 
         user.onboardingStep < 9;
};

// Frontend routing
if (shouldShowOnboarding(user)) {
  navigate('/onboarding');
} else {
  navigate('/dashboard');
}
```

**Edge Cases:**

- **User registered but never logged in**: Will see onboarding on first login
- **User registered, logged in once, then returned months later**: Will resume onboarding at saved step
- **User skipped onboarding**: Will not see it again unless they manually access "View Tutorial"

### Database Migration

**New Tables to Create:**

1. **tutorial_states**: Tracks onboarding progress
2. **reset_logs**: Audit trail for account resets

**Existing Tables to Modify:**

1. **users**: Add `hasCompletedOnboarding` and `onboardingSkipped` boolean fields

**Migration Script:**

```sql
-- Add onboarding fields to users table
ALTER TABLE users 
ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT FALSE,
ADD COLUMN onboarding_skipped BOOLEAN DEFAULT FALSE;

-- Create tutorial_states table
CREATE TABLE tutorial_states (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1 NOT NULL,
  completion_status VARCHAR(20) DEFAULT 'in_progress' NOT NULL,
  roster_strategy VARCHAR(20),
  player_choices JSONB DEFAULT '{}' NOT NULL,
  started_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_activity_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP,
  skipped_at TIMESTAMP
);

CREATE INDEX idx_tutorial_states_user_id ON tutorial_states(user_id);
CREATE INDEX idx_tutorial_states_completion_status ON tutorial_states(completion_status);

-- Create reset_logs table
CREATE TABLE reset_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  robots_deleted INTEGER NOT NULL,
  weapons_deleted INTEGER NOT NULL,
  facilities_deleted INTEGER NOT NULL,
  credits_before_reset INTEGER NOT NULL,
  reason TEXT,
  reset_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_reset_logs_user_id ON reset_logs(user_id);
CREATE INDEX idx_reset_logs_reset_at ON reset_logs(reset_at);
```

### Rollout Strategy

**Phase 1: Backend Deployment (Week 1)**
- Deploy database migrations
- Deploy onboarding API endpoints
- Deploy recommendation engine service
- Deploy reset service
- Test API endpoints in ACC environment

**Phase 2: Frontend Deployment (Week 2)**
- Deploy onboarding components
- Deploy guided UI overlay system
- Deploy budget tracker
- Test complete flow in ACC environment

**Phase 3: Gradual Rollout (Week 3)**
- Enable for 10% of new registrations
- Monitor analytics and error rates
- Gather user feedback
- Fix any issues discovered

**Phase 4: Full Rollout (Week 4)**
- Enable for 100% of new registrations
- Monitor completion rates
- Track skip rates
- Analyze recommendation effectiveness

### Feature Flags

Use feature flags to control rollout:

```typescript
const FEATURE_FLAGS = {
  ONBOARDING_ENABLED: process.env.ONBOARDING_ENABLED === 'true',
  ONBOARDING_RESET_ENABLED: process.env.ONBOARDING_RESET_ENABLED === 'true',
  ONBOARDING_RECOMMENDATIONS_ENABLED: process.env.ONBOARDING_RECOMMENDATIONS_ENABLED === 'true'
};
```

### Monitoring and Alerts

**Key Metrics to Monitor:**

- Tutorial completion rate (target: >70%)
- Tutorial skip rate (target: <20%)
- Average time to complete tutorial (target: 10-15 minutes)
- Reset usage rate (track for abuse)
- Error rates on onboarding endpoints (target: <1%)
- API response times (target: <500ms)

**Alerts to Configure:**

- Alert if completion rate drops below 60%
- Alert if skip rate exceeds 30%
- Alert if error rate exceeds 5%
- Alert if API response time exceeds 1 second
- Alert if reset rate exceeds 10% of new users

### Backward Compatibility

**Existing Users:**

- Existing users (registered before onboarding deployment) should NOT see tutorial
- Set `hasCompletedOnboarding = true` for all existing users during migration
- Provide optional "View Tutorial" link in settings for existing users

**Migration Script for Existing Users:**

```sql
-- Mark all existing users as having completed onboarding
UPDATE users 
SET has_completed_onboarding = TRUE 
WHERE created_at < '2026-03-15';  -- Deployment date
```

## Security Considerations

### Authentication and Authorization

- All onboarding API endpoints require authentication
- Tutorial state can only be accessed/modified by the owning user
- Reset functionality requires additional confirmation to prevent accidental use
- Rate limit reset endpoint to prevent abuse (max 3 resets per day per user)

### Input Validation

- Validate all user inputs (strategy selection, confirmation text, etc.)
- Sanitize player choices JSON before storing
- Validate step numbers are within valid range (1-9)
- Validate roster strategy is one of: '1_mighty', '2_average', '3_flimsy'

### Data Privacy

- Tutorial state contains no sensitive personal information
- Reset logs store only game-related data (robots, weapons, facilities counts)
- Analytics events should not include PII
- Comply with GDPR for EU users (tutorial state is user data)

### SQL Injection Prevention

- Use Prisma parameterized queries for all database operations
- Never construct raw SQL with user input
- Validate all inputs before database operations

## Localization Strategy

### Supported Languages (Initial)

- English (en) - Default
- Spanish (es)
- French (fr)
- German (de)

### Translation Files Structure

```
src/
├── locales/
│   ├── en/
│   │   ├── onboarding.json
│   │   ├── strategies.json
│   │   ├── facilities.json
│   │   └── weapons.json
│   ├── es/
│   │   └── ... (same structure)
│   ├── fr/
│   │   └── ... (same structure)
│   └── de/
│       └── ... (same structure)
```

### Translation Keys

```json
{
  "onboarding": {
    "step1": {
      "title": "Welcome to Armoured Souls",
      "description": "Let's get you started with your first robot stable"
    },
    "step2": {
      "title": "Choose Your Strategy",
      "description": "How many robots will you build?"
    },
    "strategies": {
      "1_mighty": {
        "name": "1 Mighty Robot",
        "description": "Maximum power concentration, simplest management"
      }
    }
  }
}
```

### Localization Implementation

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: require('./locales/en/onboarding.json') },
      es: { translation: require('./locales/es/onboarding.json') },
      fr: { translation: require('./locales/fr/onboarding.json') },
      de: { translation: require('./locales/de/onboarding.json') }
    },
    lng: navigator.language.split('-')[0], // Detect browser language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });
```

## Analytics and Tracking

### Events to Track

**Tutorial Progress Events:**
- `onboarding_started`: User begins tutorial
- `onboarding_step_completed`: User completes a step (include step number)
- `onboarding_completed`: User finishes tutorial
- `onboarding_skipped`: User skips tutorial
- `onboarding_resumed`: User resumes skipped tutorial

**Strategic Choice Events:**
- `roster_strategy_selected`: User chooses strategy (include strategy type)
- `loadout_type_selected`: User chooses loadout (include loadout type)
- `stance_selected`: User chooses stance (include stance type)

**Action Events:**
- `robot_created_during_onboarding`: User creates robot
- `weapon_purchased_during_onboarding`: User purchases weapon
- `facility_purchased_during_onboarding`: User purchases facility

**Reset Events:**
- `reset_attempted`: User attempts reset (include eligibility result)
- `reset_completed`: User completes reset
- `reset_blocked`: Reset blocked by constraints (include blockers)

**Error Events:**
- `onboarding_error`: Error during tutorial (include error type)
- `api_error`: API call fails (include endpoint and error)

### Analytics Implementation

```typescript
// utils/analytics.ts

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // Send to analytics service (e.g., Google Analytics, Mixpanel)
  if (window.gtag) {
    window.gtag('event', eventName, properties);
  }
  
  // Also log to backend for server-side analytics
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: eventName,
      properties,
      timestamp: new Date().toISOString()
    })
  });
};

// Usage
trackEvent('roster_strategy_selected', {
  strategy: '1_mighty',
  step: 2,
  timeSpent: 45 // seconds
});
```

### Analytics Dashboard

Create dashboard to monitor:
- Completion funnel (% completing each step)
- Drop-off points (where users abandon tutorial)
- Strategy distribution (1 vs 2 vs 3 robots)
- Average time per step
- Skip rate by step
- Reset frequency and reasons

## Documentation Updates Required

**Critical Question**: I see nothing about the creation/updating of documentation.

**Answer**: Comprehensive documentation updates are required across multiple areas.

### PRD Documents to Update

1. **docs/prd_core/PRD_ECONOMY_SYSTEM.md**
   - Add section on onboarding budget allocation
   - Document starting credits (₡3,000,000) and recommended spending
   - Add reset functionality impact on economy

2. **docs/prd_core/PRD_ROBOT_ATTRIBUTES.md**
   - Add section on attribute education during onboarding
   - Document how weapon bonuses are taught to new players
   - Reference onboarding recommendations for attribute priorities

3. **docs/prd_core/PRD_WEAPONS_LOADOUT.md**
   - Add section on loadout education during onboarding
   - Document how loadout types are explained to new players
   - Reference Step 6 (Weapon Education) content

4. **docs/prd_pages/PRD_FACILITIES_PAGE.md**
   - Add section on facility recommendations during onboarding
   - Document facility priority education
   - Reference Step 3 (Facility Timing) content

5. **docs/prd_pages/PRD_DASHBOARD_PAGE.md**
   - Add section on onboarding entry point
   - Document how dashboard detects new players
   - Add "Resume Tutorial" functionality for incomplete onboarding

### New Documentation to Create

#### 1. Feature Documentation

**File**: `docs/features/ONBOARDING_SYSTEM.md`

**Content**:
- Overview of onboarding system
- 9-step tutorial flow description
- Roster strategy explanations
- Budget allocation guidance
- Reset functionality details
- Analytics and tracking
- Troubleshooting guide

**Location**: `docs/features/` (create directory if doesn't exist)

#### 2. API Documentation

**File**: `docs/api/ONBOARDING_ENDPOINTS.md`

**Content**:
```markdown
# Onboarding API Endpoints

## GET /api/onboarding/state
Get current tutorial state for authenticated user

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "onboardingStep": 3,
    "hasCompletedOnboarding": false,
    "onboardingStrategy": "1_mighty",
    "onboardingChoices": { ... }
  }
}
```

## POST /api/onboarding/state
Update tutorial state

[... full API documentation ...]
```

**Location**: `docs/api/` (create directory if doesn't exist)

#### 3. Developer Guide

**File**: `docs/guides/EXTENDING_ONBOARDING.md`

**Content**:
- How to add new tutorial steps
- How to modify recommendation engine
- How to add new roster strategies
- How to customize budget allocations
- Testing onboarding changes
- Debugging onboarding issues

**Location**: `docs/guides/`

#### 4. User Guide

**File**: `docs/user-guides/NEW_PLAYER_GUIDE.md`

**Content**:
- What to expect during onboarding
- Roster strategy comparison
- Budget allocation tips
- Facility purchase priorities
- Weapon selection guidance
- When to use account reset
- FAQ for new players

**Location**: `docs/user-guides/` (create directory if doesn't exist)

### Documentation Updates in Code

#### 1. README Updates

**File**: `app/frontend/README.md`

Add section:
```markdown
## Onboarding System

The onboarding system guides new players through their first decisions.

### Running Onboarding Locally
1. Create a new user account
2. Login - you'll be redirected to `/onboarding`
3. Follow the 9-step tutorial

### Testing Onboarding
```bash
npm run test:onboarding
```

### Skipping Onboarding in Development
Set `SKIP_ONBOARDING=true` in `.env.local`
```

**File**: `app/backend/README.md`

Add section:
```markdown
## Onboarding API

New endpoints for tutorial state management:
- `GET /api/onboarding/state` - Get tutorial state
- `POST /api/onboarding/state` - Update tutorial state
- `POST /api/onboarding/complete` - Mark tutorial complete
- `POST /api/onboarding/skip` - Skip tutorial
- `POST /api/onboarding/reset-account` - Reset account

See `docs/api/ONBOARDING_ENDPOINTS.md` for full documentation.
```

#### 2. Inline Code Documentation

All new services and components must include JSDoc comments:

```typescript
/**
 * Generates personalized facility recommendations based on player choices
 * 
 * @param rosterStrategy - Player's chosen roster strategy (1_mighty, 2_average, 3_flimsy)
 * @param loadoutType - Optional loadout type selection
 * @param stance - Optional battle stance selection
 * @returns Array of facility recommendations with priority levels
 * 
 * @example
 * const recommendations = generateFacilityRecommendations('1_mighty', 'two_handed', 'offensive');
 * // Returns: [{ type: 'facility', priority: 'high', title: 'Weapons Workshop', ... }]
 */
export function generateFacilityRecommendations(
  rosterStrategy: string,
  loadoutType?: string,
  stance?: string
): Recommendation[] {
  // Implementation
}
```

### Database Schema Documentation

**File**: `docs/prd_core/DATABASE_SCHEMA.md`

Add section:
```markdown
## Onboarding Fields (User Table)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| has_completed_onboarding | BOOLEAN | false | Whether user completed tutorial |
| onboarding_skipped | BOOLEAN | false | Whether user skipped tutorial |
| onboarding_step | INTEGER | 1 | Current tutorial step (1-9) |
| onboarding_strategy | VARCHAR(20) | NULL | Chosen roster strategy |
| onboarding_choices | JSONB | {} | Player choices during tutorial |
| onboarding_started_at | TIMESTAMP | NULL | When tutorial started |
| onboarding_completed_at | TIMESTAMP | NULL | When tutorial completed |

## Reset Logs Table

[... schema documentation ...]
```

### Deployment Documentation

**File**: `docs/guides/DEPLOYMENT.md`

Add section:
```markdown
## Deploying Onboarding Feature

### Pre-Deployment Checklist
- [ ] Run migration to add onboarding fields to User table
- [ ] Mark existing users as having completed onboarding
- [ ] Upload onboarding images to public assets
- [ ] Test onboarding flow in ACC environment
- [ ] Verify analytics tracking is configured

### Migration Steps
1. Run database migration: `npx prisma migrate deploy`
2. Run existing user migration script (see ONBOARDING_SYSTEM.md)
3. Deploy backend with onboarding API endpoints
4. Deploy frontend with onboarding components
5. Verify feature flag is enabled: `ONBOARDING_ENABLED=true`

### Rollback Procedure
If issues occur:
1. Set feature flag: `ONBOARDING_ENABLED=false`
2. Revert database migration if necessary
3. Investigate issues in logs
4. Fix and redeploy
```

### Documentation Maintenance

**Ongoing Requirements**:
- Update documentation when onboarding flow changes
- Keep API documentation in sync with code
- Update screenshots/images when UI changes
- Maintain FAQ based on user questions
- Document any new edge cases discovered

### Documentation Checklist

Before deployment:
- [ ] All PRD documents updated
- [ ] New feature documentation created
- [ ] API documentation complete
- [ ] Developer guide written
- [ ] User guide written
- [ ] README files updated
- [ ] Inline code documentation added
- [ ] Database schema documented
- [ ] Deployment guide updated
- [ ] All documentation reviewed for accuracy

## Future Enhancements

### Phase 2 Features (Post-Launch)

1. **Interactive Tutorial Battles**: Simulated battles during onboarding to demonstrate combat
2. **Video Tutorials**: Short video clips explaining complex concepts
3. **Tooltips on Demand**: Hover tooltips on any game element after onboarding
4. **Advanced Strategy Guide**: In-depth guide for experienced players
5. **Community Tips**: Show tips from successful players
6. **Onboarding Achievements**: Badges for completing tutorial milestones

### Phase 3 Features (Long-term)

1. **AI-Powered Recommendations**: Machine learning to improve recommendations
2. **Personalized Learning Paths**: Adapt tutorial based on player behavior
3. **Voice-Over Narration**: Audio guidance for accessibility
4. **Gamified Tutorial**: Turn tutorial into mini-game with rewards
5. **Social Onboarding**: Invite friends to complete tutorial together
6. **Tutorial Replay System**: Rewatch specific sections without resetting

## Open Questions and Decisions Needed

### Design Decisions

1. **Navigation Redesign Scope**: Should we redesign navigation as part of this feature or as separate project?
   - **Recommendation**: Separate project, but document navigation issues discovered during onboarding design

2. **Image Asset Creation**: Who will create the 9+ image assets required?
   - **Recommendation**: Contract with game artist or use AI generation with manual refinement

3. **Tutorial Length**: Is 9 steps too long? Should we consolidate?
   - **Recommendation**: Start with 9 steps, monitor completion rates, consolidate if drop-off is high

4. **Reset Frequency Limit**: Should we limit how often users can reset?
   - **Recommendation**: Yes, max 3 resets per day to prevent abuse

5. **Existing User Access**: Should existing users be able to view tutorial?
   - **Recommendation**: Yes, provide "View Tutorial" option in settings (read-only mode)

### Technical Decisions

1. **Chart Library**: Which library for budget allocation charts?
   - **Options**: recharts, chart.js, victory
   - **Recommendation**: recharts (React-native, good TypeScript support)

2. **Overlay Implementation**: Custom overlay or use library?
   - **Options**: Custom, react-joyride, intro.js
   - **Recommendation**: Custom (more control over styling and behavior)

3. **State Management**: Context API or Redux for tutorial state?
   - **Recommendation**: Context API (simpler, sufficient for this feature)

4. **Image Format**: PNG, WebP, or SVG for tutorial images?
   - **Recommendation**: WebP for photos/screenshots, SVG for diagrams/icons

## Summary

This design document provides a comprehensive blueprint for implementing the New Player Onboarding feature. The system uses a 9-step guided tutorial flow with personalized recommendations, budget visualization, and account reset functionality.

**Key Design Highlights:**

- **Modular Architecture**: Separate components for each step, reusable overlay system
- **Personalization Engine**: Recommendations adapt to player's specific choices
- **State Persistence**: Tutorial progress saved across sessions
- **Reset Validation**: Comprehensive constraint checking before allowing reset
- **Cross-Platform Support**: Responsive design for desktop, tablet, and mobile
- **Accessibility**: Keyboard navigation, screen reader support, WCAG 2.1 AA compliance
- **Performance**: Optimized loading, caching, and rendering
- **Analytics**: Comprehensive event tracking for optimization

**Implementation Priorities:**

1. **Phase 1**: Core tutorial flow (steps 1-9) with basic UI
2. **Phase 2**: Personalization engine and recommendations
3. **Phase 3**: Reset functionality with validation
4. **Phase 4**: Polish, accessibility, and performance optimization

**Success Metrics:**

- Tutorial completion rate > 70%
- Tutorial skip rate < 20%
- Average completion time: 10-15 minutes
- Player retention after onboarding > 60% (7-day)
- Positive feedback on tutorial helpfulness

The design addresses all 28 requirements from the requirements document and provides a solid foundation for implementation.

