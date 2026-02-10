# Product Requirements Document: Battle Results Page

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v1.0  
**Date**: February 9, 2026  
**Author**: AI Assistant  
**Status**: ❌ NOT IMPLEMENTED  
**Owner**: TBD  
**Epic**: Battle System & Player Feedback  
**Priority**: P1 (High Priority - Critical UX Gap)

---

## Version History
- **v1.0 (Feb 9, 2026): Initial PRD created**
  - Documented battle results page requirements
  - Specified prestige and fame display requirements
  - Defined UI mockups and user stories
  - Cross-referenced with PRD_PRESTIGE_AND_FAME.md

---

## Executive Summary

The Battle Results Page provides players with detailed feedback after each battle, showing combat outcomes, rewards earned, and reputation gains. Currently, players receive no post-battle summary, creating a critical UX gap where prestige and fame earnings are invisible.

**Key Goals:**
- Display battle outcome (win/loss/draw)
- Show credits earned from battle
- **Display prestige earned (stable level)**
- **Display fame earned (robot level)**
- Show milestone progress
- Provide links to relevant pages (leaderboards, robot detail)

**Success Criteria**:
- Players can see prestige/fame earned after every battle
- Milestone achievements are celebrated with visual feedback
- Battle results are accessible from battle history
- Page loads in <500ms after battle completion

**Impact**: Closes critical feedback loop for prestige/fame system, increasing player engagement with reputation mechanics.

---

## Background & Context

### Current State

**✅ Implemented:**
- Battle execution and outcome determination
- Credit rewards calculated and awarded
- Prestige/fame calculated and awarded (backend only)
- Battle history page showing past battles

**❌ Missing:**
- Post-battle summary screen
- Prestige/fame display after battles
- Milestone achievement notifications
- Player feedback on reputation gains

### Why This Matters

**Player Experience:**
- **Feedback Loop**: Players need to see reputation gains to understand progression
- **Motivation**: Visible rewards increase engagement with battle system
- **Transparency**: Players should know exactly what they earned
- **Celebration**: Milestone achievements deserve recognition

**System Integration:**
- Prestige/fame system is implemented but invisible to players
- Battle history shows outcomes but not detailed rewards
- Leaderboards exist but players don't see how they earned their rank

---

## User Stories

### User Story 1: View Battle Results
**As a player**, I want to see a summary screen after each battle so I can understand the outcome and rewards.

**Acceptance Criteria:**
- Battle results page displays after battle completion
- Shows winner/loser clearly
- Displays all rewards earned (credits, prestige, fame)
- Provides navigation to next actions

### User Story 2: See Prestige Earned
**As a player**, I want to see how much prestige I earned from a battle so I can track my stable's reputation growth.

**Acceptance Criteria:**
- Prestige earned displayed prominently
- Shows formula: base amount × ELO multiplier
- Displays current total prestige
- Shows progress toward next prestige tier

### User Story 3: See Fame Earned
**As a player**, I want to see how much fame my robot earned so I can track individual robot reputation.

**Acceptance Criteria:**
- Fame earned displayed for each robot
- Shows formula: base amount × ELO multiplier
- Displays robot's current total fame
- Shows progress toward next fame milestone

### User Story 4: Celebrate Milestones
**As a player**, I want to be notified when I reach prestige or fame milestones so I can celebrate achievements.

**Acceptance Criteria:**
- Milestone achievement banner displays if threshold reached
- Shows milestone reward (bonus prestige/fame)
- Provides visual celebration (animation, confetti)
- Links to leaderboard to see new rank

### User Story 5: Access from Battle History
**As a player**, I want to view detailed results for past battles so I can review my performance.

**Acceptance Criteria:**
- Battle history has "View Details" button for each battle
- Clicking opens battle results page
- Shows same information as post-battle screen
- Includes timestamp and battle context

---

## Detailed Requirements

### 1. Page Layout & Structure

#### 1.1 Battle Outcome Section

**Winner/Loser Display:**
- Large banner showing outcome: "VICTORY" / "DEFEAT" / "DRAW"
- Color-coded: Green (victory), Red (defeat), Yellow (draw)
- Robot names and portraits (if available)
- Final HP values for both robots

**Visual Example:**
```
╔═══════════════════════════════════════════════════════════════╗
║                         VICTORY! ✅                           ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   [Robot Portrait]              vs        [Robot Portrait]    ║
║   Your Robot: Thunder                     Opponent: Blitz     ║
║   HP: 45 / 100                            HP: 0 / 100         ║
║   League: Gold Tier 2                     League: Silver Tier 3║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

#### 1.2 Rewards Section

**Credits Earned:**
- Display credits won from battle
- Show base reward and any bonuses
- Example: "₡25,000 (₡20,000 base + ₡5,000 prestige bonus)"

**Prestige Earned (Stable Level):**
- Display prestige earned prominently with ⭐ icon
- Show calculation: base × (1 + ELO / 2000)
- Display current total prestige
- Show progress bar to next tier

**Fame Earned (Robot Level):**
- Display fame earned prominently with ⭐ icon
- Show calculation: base × (1 + ELO / 2000)
- Display robot's current total fame
- Show progress bar to next milestone

**Visual Example:**
```
╔═══════════════════════════════════════════════════════════════╗
║ REWARDS EARNED                                                ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║ Credits:        ₡25,000                                       ║
║   Base reward:  ₡20,000                                       ║
║   Prestige bonus (+10%): ₡5,000                               ║
║                                                               ║
║ Prestige:       +24 ⭐                                        ║
║   Base (Gold):  20 prestige                                   ║
║   ELO bonus:    ×1.2 (ELO 1,645)                              ║
║   Total:        1,274 prestige (Established)                  ║
║   ▓▓░░░░░░░░ 27% to Veteran (1,274 / 5,000)                  ║
║                                                               ║
║ Fame (Thunder): +14 ⭐                                        ║
║   Base (Gold):  12 fame                                       ║
║   ELO bonus:    ×1.2 (ELO 1,645)                              ║
║   Total:        514 fame                                      ║
║   ▓▓▓░░░░░░░ 51% to next milestone (514 / 1,000)             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

#### 1.3 Milestone Achievement Section (Conditional)

**Display if milestone reached:**
- Large celebration banner
- Milestone name and reward
- Visual effects (animation, confetti)
- Link to leaderboard

**Visual Example:**
```
╔═══════════════════════════════════════════════════════════════╗
║                  🎉 MILESTONE ACHIEVED! 🎉                    ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   PRESTIGE MILESTONE: 1,000 PRESTIGE                          ║
║                                                               ║
║   You've reached the "Established" tier!                      ║
║                                                               ║
║   Bonus Reward: +50 prestige                                  ║
║                                                               ║
║   New Total: 1,050 prestige                                   ║
║                                                               ║
║   [View Prestige Leaderboard →]                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

#### 1.4 Battle Statistics Section

**Combat Summary:**
- Damage dealt by each robot
- Damage taken by each robot
- Number of rounds
- Critical hits landed
- Special abilities used

**Visual Example:**
```
╔═══════════════════════════════════════════════════════════════╗
║ BATTLE STATISTICS                                             ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║ Rounds:          5                                            ║
║ Duration:        2 minutes 34 seconds                         ║
║                                                               ║
║ Thunder (You):                                                ║
║   Damage Dealt:  55                                           ║
║   Damage Taken:  55                                           ║
║   Critical Hits: 2                                            ║
║                                                               ║
║ Blitz (Opponent):                                             ║
║   Damage Dealt:  55                                           ║
║   Damage Taken:  100                                          ║
║   Critical Hits: 1                                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

#### 1.5 Action Buttons

**Primary Actions:**
- "Continue" - Return to dashboard
- "View Robot Details" - Go to robot detail page
- "Battle Again" - Queue for another battle (if available)
- "View Leaderboards" - See prestige/fame rankings

**Visual Example:**
```
┌───────────────────────────────────────────────────────────────┐
│ [Continue]  [View Robot Details]  [View Leaderboards]         │
└───────────────────────────────────────────────────────────────┘
```

### 2. Technical Implementation

#### 2.1 Backend Requirements

**API Endpoint**: `GET /api/battles/:battleId/results`

**Response Format:**
```typescript
interface BattleResultsResponse {
  battle: {
    id: string;
    timestamp: Date;
    outcome: 'WIN' | 'LOSS' | 'DRAW';
    rounds: number;
    duration: number; // seconds
  };
  
  yourRobot: {
    id: string;
    name: string;
    finalHP: number;
    maxHP: number;
    damageDealt: number;
    damageTaken: number;
    criticalHits: number;
  };
  
  opponentRobot: {
    id: string;
    name: string;
    finalHP: number;
    maxHP: number;
    damageDealt: number;
    damageTaken: number;
    criticalHits: number;
  };
  
  rewards: {
    credits: {
      total: number;
      base: number;
      prestigeBonus: number;
    };
    prestige: {
      earned: number;
      base: number;
      eloMultiplier: number;
      newTotal: number;
      tier: string; // "Novice", "Established", etc.
      progressToNextTier: number; // 0-100 percentage
    };
    fame: {
      earned: number;
      base: number;
      eloMultiplier: number;
      newTotal: number;
      progressToNextMilestone: number; // 0-100 percentage
      nextMilestone: number;
    };
  };
  
  milestones?: {
    prestigeMilestone?: {
      threshold: number;
      reward: number;
      tierName: string;
    };
    fameMilestone?: {
      threshold: number;
      reward: number;
    };
  };
}
```

**Calculation Logic:**
- Prestige earned: `base × (1 + winner_elo / 2000)`
- Fame earned: `base × (1 + robot_elo / 2000)`
- Prestige tier: Calculate based on total prestige
- Progress percentages: `(current - tier_min) / (tier_max - tier_min) × 100`

#### 2.2 Frontend Requirements

**Component Structure:**
```
BattleResultsPage.tsx
├── BattleOutcomeBanner.tsx
│   ├── Winner/Loser display
│   └── Robot portraits and stats
├── RewardsSection.tsx
│   ├── CreditsEarned.tsx
│   ├── PrestigeEarned.tsx
│   │   └── ProgressBar.tsx
│   └── FameEarned.tsx
│       └── ProgressBar.tsx
├── MilestoneAchievement.tsx (conditional)
│   └── Celebration animation
├── BattleStatistics.tsx
│   └── Combat summary
└── ActionButtons.tsx
    └── Navigation buttons
```

**State Management:**
```typescript
const [battleResults, setBattleResults] = useState<BattleResultsResponse | null>(null);
const [loading, setLoading] = useState(true);
const [showMilestone, setShowMilestone] = useState(false);
```

**Routing:**
- Route: `/battles/:battleId/results`
- Accessible from: Battle completion, battle history
- Redirect to dashboard after "Continue" clicked

#### 2.3 Animation & Visual Effects

**Milestone Celebration:**
- Confetti animation using canvas or library (e.g., react-confetti)
- Fade-in animation for milestone banner
- Pulse effect on milestone reward

**Progress Bars:**
- Animated fill from 0 to current percentage
- Color-coded by tier/milestone
- Smooth transitions (300ms ease-out)

**Page Transitions:**
- Fade-in on page load
- Slide-up animation for sections
- Stagger animations for multiple elements

### 3. Integration Points

#### 3.1 Battle System Integration

**After Battle Completion:**
1. Battle orchestrator completes battle
2. Awards credits, prestige, fame
3. Checks for milestone achievements
4. Redirects to `/battles/:battleId/results`

**Battle History Integration:**
- Add "View Details" button to each battle in history
- Button links to `/battles/:battleId/results`
- Results page shows historical data (no changes to database)

#### 3.2 Prestige/Fame System Integration

**Milestone Detection:**
- Check if prestige crossed threshold (1,000 / 5,000 / 10,000 / etc.)
- Check if fame crossed threshold (500 / 1,000 / 5,000 / etc.)
- Award bonus prestige/fame if milestone reached
- Display milestone achievement banner

**Leaderboard Links:**
- "View Prestige Leaderboard" button links to `/leaderboards/prestige`
- "View Fame Leaderboard" button links to `/leaderboards/fame`
- Highlight user's new rank if improved

#### 3.3 Dashboard Integration

**Return to Dashboard:**
- "Continue" button returns to `/dashboard`
- Dashboard shows updated prestige/fame values
- Notification system may show milestone achievement

### 4. Design Specifications

#### 4.1 Color Palette

**Outcome Colors:**
- Victory: `#3fb950` (green)
- Defeat: `#f85149` (red)
- Draw: `#d29922` (yellow)

**Reputation Colors:**
- Prestige: `#a371f7` (purple)
- Fame: `#58a6ff` (cyan-blue)

**Progress Bars:**
- Prestige tiers:
  - Novice: `#8b949e` (gray)
  - Established: `#58a6ff` (blue)
  - Veteran: `#a371f7` (purple)
  - Elite: `#d29922` (gold)
  - Champion: `#f85149` (red)
  - Legendary: `#ff6b6b` (bright red)
- Fame: `#58a6ff` (cyan-blue)

#### 4.2 Typography

- Page Title: `text-3xl font-bold` (30px)
- Section Headers: `text-2xl font-semibold` (24px)
- Reward Values: `text-xl font-bold` (20px)
- Body Text: `text-sm` (14px)
- Labels: `text-xs` (12px)

#### 4.3 Spacing

- Page Padding: `container mx-auto px-4 py-8`
- Section Margin: `mb-6` (24px between sections)
- Card Padding: `p-6` (24px)
- Element Spacing: `space-y-4` (16px)

### 5. Accessibility

**Requirements:**
- Keyboard navigation for all buttons
- Screen reader announcements for rewards
- ARIA labels for progress bars
- Color-blind friendly indicators (not color-only)
- Focus states on interactive elements

**Screen Reader Example:**
```
"Battle result: Victory. You earned 25,000 credits, 24 prestige, and 14 fame. 
Your prestige is now 1,274, Established tier. 
Your robot Thunder's fame is now 514."
```

### 6. Testing Requirements

**Unit Tests:**
- Prestige/fame calculation logic
- Progress percentage calculations
- Milestone detection

**Integration Tests:**
- API endpoint returns correct data
- Page loads after battle completion
- Navigation buttons work correctly

**UI Tests:**
- All sections display correctly
- Animations play smoothly
- Responsive design works on all screen sizes

**Edge Cases:**
- Battle with 0 prestige/fame earned (draw)
- Multiple milestones reached in one battle
- Very long robot names
- Missing battle data

---

## Implementation Roadmap

### Phase 1: Core Battle Results (Week 1)

**Tasks:**
1. Create backend API endpoint
2. Implement prestige/fame calculation logic
3. Create BattleResultsPage component
4. Add basic rewards display
5. Integrate with battle system

**Deliverables:**
- Working battle results page
- Prestige/fame display
- Basic navigation

### Phase 2: Milestone System (Week 2)

**Tasks:**
1. Implement milestone detection
2. Create milestone achievement banner
3. Add celebration animations
4. Integrate with leaderboards

**Deliverables:**
- Milestone notifications
- Visual celebrations
- Leaderboard links

### Phase 3: Polish & Enhancement (Week 3)

**Tasks:**
1. Add battle statistics section
2. Implement animations and transitions
3. Add tooltips and help text
4. Integrate with battle history

**Deliverables:**
- Complete battle results page
- Smooth animations
- Battle history integration

---

## Success Metrics

**Must Have:**
- ✅ Battle results page displays after every battle
- ✅ Prestige and fame earned are visible
- ✅ Milestone achievements are celebrated
- ✅ Page loads in <500ms
- ✅ All navigation buttons work correctly

**Should Have:**
- ✅ Animations play smoothly
- ✅ Progress bars show accurate percentages
- ✅ Tooltips explain prestige/fame system
- ✅ Accessible to screen readers

**Nice to Have:**
- ✅ Battle replay functionality
- ✅ Share results on social media
- ✅ Compare with previous battles
- ✅ Export battle statistics

---

## Open Questions

1. **Should battle results be persistent?**
   - Option A: Store in database for historical access
   - Option B: Calculate on-demand from battle data
   - **Recommendation**: Option B (calculate on-demand)

2. **How long should milestone celebration display?**
   - Option A: Auto-dismiss after 5 seconds
   - Option B: Require user to click "Continue"
   - **Recommendation**: Option B (user acknowledgment)

3. **Should we show opponent's prestige/fame earned?**
   - Option A: Yes, for transparency
   - Option B: No, focus on player's rewards
   - **Recommendation**: Option B (player-focused)

4. **Should battle results be shareable?**
   - Option A: Add share buttons for social media
   - Option B: Keep private
   - **Recommendation**: Option A (future enhancement)

---

## Related Documentation

- [PRD_PRESTIGE_AND_FAME.md](../prd_core/PRD_PRESTIGE_AND_FAME.md) - Complete prestige/fame system
- [STABLE_SYSTEM.md](../STABLE_SYSTEM.md) - Prestige earning formulas
- [PRD_DASHBOARD_PAGE.md](PRD_DASHBOARD_PAGE.md) - Dashboard integration
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](../design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md) - Design system

---

**End of Document**
