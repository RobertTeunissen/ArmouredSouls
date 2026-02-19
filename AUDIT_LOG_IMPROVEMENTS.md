# AUDIT LOG IMPROVEMENTS - ADDRESSING USER CONCERNS

## User Concerns Addressed

### 1. ✅ Event Type "credit_change" is unclear

**Problem:** "credit_change" was used generically for robot purchases and other credit changes.

**Solution Implemented:**
- Created `ROBOT_PURCHASE` event type specifically for robot purchases
- Updated robot creation code to use `logRobotPurchase()` helper
- Added comment to `CREDIT_CHANGE`: "For manual admin adjustments only"

**New Event Structure:**
```typescript
// Before
{
  eventType: 'credit_change',
  payload: { amount: -500000, balance: 2500000, source: 'other' }
}

// After
{
  eventType: 'robot_purchase',
  userId: 60,
  robotId: 152,
  payload: {
    robotName: "BattleBot X",
    cost: 500000,
    balanceBefore: 3000000,
    balanceAfter: 2500000
  }
}
```

**Benefits:**
- Easy to query all robot purchases: `SELECT * WHERE eventType = 'robot_purchase'`
- Clear what happened without parsing generic credit changes
- Robot ID and name included for reference

---

### 2. ⚠️ "yielded" field in payload

**User Question:** "In the payload for League matches there's a 'yielded': false statement. As far as I can see, this is always false. It is not there for Tournament matches?"

**Current Status:**
- The `yielded` field IS included in both League and Tournament battles
- It comes from `battle.robot1Yielded` and `battle.robot2Yielded` in the Battle table
- It CAN be true if a robot yields (surrenders) during battle
- It's a valid field representing battle state

**Analysis:**
- If it's always false in your games, that's because no robots have yielded
- The field is correct to include - it documents a valid battle outcome
- It's consistent across both League and Tournament battles

**Recommendation:** Keep as-is. This is working correctly.

---

### 3. ✅ End-of-cycle balances not stored in audit log

**Problem:** "The balances at the end of the cycle are not stored here, but they are printed in the csv?"

**Solution Implemented:**
- Added `CYCLE_END_BALANCE` event type
- Created `logCycleEndBalance()` helper method
- Updated admin route Step 14 to log each user's balance to AuditLog

**New Events Created:**
```sql
-- One event per user at end of each cycle
INSERT INTO audit_logs (
  cycle_number, 
  event_type, 
  user_id, 
  payload
) VALUES (
  2,
  'cycle_end_balance',
  60,
  '{"username": "player1", "stableName": "player1", "balance": 122113}'
);
```

**Benefits:**
- Historical balance tracking in database
- Can query any user's balance at any cycle
- CSV export can read from audit log instead of just console
- Cycle summary can use these for accurate balance display

**Query Examples:**
```sql
-- Get User 60's balance at end of Cycle 2
SELECT payload->>'balance' 
FROM audit_logs 
WHERE cycle_number = 2 
  AND event_type = 'cycle_end_balance' 
  AND user_id = 60;

-- Get all balances at end of Cycle 2
SELECT 
  user_id,
  payload->>'stableName' as stable,
  payload->>'balance' as balance
FROM audit_logs
WHERE cycle_number = 2 
  AND event_type = 'cycle_end_balance'
ORDER BY user_id;
```

---

### 4. ✅ Log balances at end of each cycle

**User Question:** "Is it not worth here to log the balances at the end of each cycle?"

**Answer:** YES! Implemented in solution #3 above.

**What's Logged:**
- User ID (in column)
- Username
- Stable name
- Balance amount
- Cycle number
- Timestamp

**Where:** Admin route, Step 14 (after all cycle activities complete)

---

### 5. ⚠️ User creation not logged

**User Question:** "I see no mention of users created and which balances they have, to start their audit log?"

**Status:** Not yet implemented - no registration endpoint exists!

**Current Situation:**
- The codebase has NO user registration endpoint (`/api/auth/register`)
- Only login endpoint exists
- Users must be created manually in database or via seed scripts

**Solution Needed:**
1. Create registration endpoint in `routes/auth.ts`
2. Log user creation with `logUserCreated()` helper (already created)
3. Record starting balance (default ₡3,000,000)

**Example Registration Endpoint (To Be Added):**
```typescript
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  // Validate and create user
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 10),
      currency: 3000000, // Starting balance
    }
  });
  
  // Log user creation to audit log
  const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  const currentCycle = cycleMetadata?.totalCycles || 0;
  
  await eventLogger.logUserCreated(
    currentCycle,
    user.id,
    username,
    3000000
  );
  
  // ... return JWT token
});
```

**Benefits When Implemented:**
- Complete audit trail from user creation
- Track starting balance
- Know when each user joined
- Full financial history per user

---

## Summary of Changes

### ✅ Completed
1. Added `ROBOT_PURCHASE` event type
2. Changed robot creation to use specific event type
3. Added `CYCLE_END_BALANCE` event type
4. Log end-of-cycle balances to audit log
5. Created helper methods for new event types

### ⚠️ Needs Implementation
1. User registration endpoint with audit logging
2. Update analytics code reading old "credit_change" events

### 📋 No Action Needed
1. "yielded" field - working correctly

---

## Event Type Reference

### Current Event Types

**Robot Events:**
- `robot_purchase` - Robot bought (new!)
- `robot_repair` - Robot repaired
- `attribute_upgrade` - Attribute upgraded
- `league_change` - Robot moved leagues

**User/Stable Events:**
- `user_created` - User registered (helper exists, endpoint needed)
- `credit_change` - Manual credit adjustments ONLY
- `prestige_change` - Prestige changes
- `passive_income` - Merchandising income
- `operating_costs` - Facility costs
- `cycle_end_balance` - End-of-cycle balance snapshot (new!)

**Battle Events:**
- `battle_complete` - Battle finished (2 per battle, 1 per robot)

**Facility Events:**
- `facility_purchase` - Facility bought
- `facility_upgrade` - Facility upgraded

**Weapon Events:**
- `weapon_purchase` - Weapon bought
- `weapon_sale` - Weapon sold

**Cycle Events:**
- `cycle_start` - Cycle began
- `cycle_complete` - Cycle ended
- `cycle_end_balance` - User balance at cycle end (new!)

---

## Migration Notes

### Old Data
- Existing robot purchases logged as `credit_change` with `source: 'other'`
- End-of-cycle balances only in console logs, not in database
- No user creation events (users created before audit logging)

### New Data
- Robot purchases logged as `robot_purchase` with full details
- End-of-cycle balances stored in audit log
- User creation will be logged when registration endpoint added

### Backward Compatibility
- Analytics code may need updates to handle both old and new event types
- Queries should check for both:
  ```sql
  -- Get all robot purchases
  SELECT * FROM audit_logs 
  WHERE eventType = 'robot_purchase'
     OR (eventType = 'credit_change' AND payload->>'source' = 'other' AND (payload->>'amount')::int < 0);
  ```

---

## Next Steps

1. **Add user registration endpoint** with audit logging
2. **Update analytics routes** to handle new event types
3. **Consider backfill** of old events (optional)
4. **Test cycle execution** to verify end-of-cycle balance logging works

---

**Status:** Phase 1 Complete ✅  
**Remaining:** User registration + analytics updates
