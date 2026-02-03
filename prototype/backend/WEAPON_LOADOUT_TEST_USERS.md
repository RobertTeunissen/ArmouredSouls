# Weapon Loadout Test Users

This document describes the 14 weapon loadout test users created for testing the weapon economy system.

## Overview

- **Total Users**: 14
- **Robots per User**: 10 (140 robots total)
- **Password**: `testpass123`
- **Currency**: ₡1,000,000 per user
- **All Robot Attributes**: Set to 5.00 (instead of default 1.00)
- **HP**: 75 (calculated: 50 + 5.00 × 5)
- **Shield**: 10 (calculated: 5.00 × 2)
- **ELO**: 1200
- **League**: Bronze (bronze_1)

## User List

### Single Loadout (4 users)
These users test single weapon configurations:

1. **loadout_machine_pistol_single**
   - Weapon: Machine Pistol
   - Loadout Type: `single`
   - Robot Names: "MP Single Bot 1" through "MP Single Bot 10"

2. **loadout_laser_pistol_single**
   - Weapon: Laser Pistol
   - Loadout Type: `single`
   - Robot Names: "LP Single Bot 1" through "LP Single Bot 10"

3. **loadout_combat_knife_single**
   - Weapon: Combat Knife
   - Loadout Type: `single`
   - Robot Names: "CK Single Bot 1" through "CK Single Bot 10"

4. **loadout_machine_gun_single**
   - Weapon: Machine Gun
   - Loadout Type: `single`
   - Robot Names: "MG Single Bot 1" through "MG Single Bot 10"

### Weapon + Shield (4 users)
These users test weapon + shield combinations:

5. **loadout_machine_pistol_shield**
   - Main Weapon: Machine Pistol
   - Offhand: Light Shield
   - Loadout Type: `weapon_shield`
   - Robot Names: "MP + Shield Bot 1" through "MP + Shield Bot 10"

6. **loadout_laser_pistol_shield**
   - Main Weapon: Laser Pistol
   - Offhand: Light Shield
   - Loadout Type: `weapon_shield`
   - Robot Names: "LP + Shield Bot 1" through "LP + Shield Bot 10"

7. **loadout_combat_knife_shield**
   - Main Weapon: Combat Knife
   - Offhand: Light Shield
   - Loadout Type: `weapon_shield`
   - Robot Names: "CK + Shield Bot 1" through "CK + Shield Bot 10"

8. **loadout_machine_gun_shield**
   - Main Weapon: Machine Gun
   - Offhand: Light Shield
   - Loadout Type: `weapon_shield`
   - Robot Names: "MG + Shield Bot 1" through "MG + Shield Bot 10"

### Dual-Wield (4 users)
These users test dual-wielding configurations:

9. **loadout_machine_pistol_dual**
   - Main Weapon: Machine Pistol
   - Offhand: Machine Pistol
   - Loadout Type: `dual_wield`
   - Robot Names: "MP Dual Bot 1" through "MP Dual Bot 10"

10. **loadout_laser_pistol_dual**
    - Main Weapon: Laser Pistol
    - Offhand: Laser Pistol
    - Loadout Type: `dual_wield`
    - Robot Names: "LP Dual Bot 1" through "LP Dual Bot 10"

11. **loadout_combat_knife_dual**
    - Main Weapon: Combat Knife
    - Offhand: Combat Knife
    - Loadout Type: `dual_wield`
    - Robot Names: "CK Dual Bot 1" through "CK Dual Bot 10"

12. **loadout_machine_gun_dual**
    - Main Weapon: Machine Gun
    - Offhand: Machine Gun
    - Loadout Type: `dual_wield`
    - Robot Names: "MG Dual Bot 1" through "MG Dual Bot 10"

### Two-Handed (2 users)
These users test two-handed weapon configurations:

13. **loadout_shotgun_two_handed**
    - Weapon: Shotgun
    - Loadout Type: `two_handed`
    - Robot Names: "Shotgun 2H Bot 1" through "Shotgun 2H Bot 10"

14. **loadout_assault_rifle_two_handed**
    - Weapon: Assault Rifle
    - Loadout Type: `two_handed`
    - Robot Names: "Assault Rifle 2H Bot 1" through "Assault Rifle 2H Bot 10"

## Testing Instructions

### Login
```
Username: loadout_machine_pistol_single (or any other loadout user)
Password: testpass123
```

### Comparing Loadouts
These users are specifically designed to test weapon balance by having:
- Identical base attributes (all set to 5.00)
- Different weapon configurations
- Same starting conditions (HP, Shield, ELO, Currency)

This allows for fair comparison between different loadout types and weapon choices.

### Use Cases
1. **Balance Testing**: Compare performance of different weapons with identical robot stats
2. **Loadout Testing**: Verify that single, weapon+shield, dual-wield, and two-handed loadouts work correctly
3. **Economy Testing**: Test weapon purchase and repair costs with realistic robot stats
4. **Battle Simulation**: Run battles between different loadout types to test combat effectiveness

## Weapon Specifications

| Weapon | Type | Base Damage | Cooldown | Cost |
|--------|------|-------------|----------|------|
| Machine Pistol | Ballistic | 8 | 2 | ₡75,000 |
| Laser Pistol | Energy | 12 | 3 | ₡75,000 |
| Combat Knife | Melee | 9 | 2 | ₡90,000 |
| Machine Gun | Ballistic | 10 | 2 | ₡120,000 |
| Light Shield | Shield | 0 | 0 | ₡50,000 |
| Shotgun | Ballistic | 32 | 4 | ₡325,000 |
| Assault Rifle | Ballistic | 18 | 3 | ₡150,000 |

## Database Query Examples

### Get all loadout test users
```typescript
const loadoutUsers = await prisma.user.findMany({
  where: { username: { startsWith: 'loadout_' } }
});
```

### Get robots for a specific loadout user
```typescript
const robots = await prisma.robot.findMany({
  where: { 
    user: { username: 'loadout_machine_pistol_dual' }
  },
  include: {
    mainWeapon: { include: { weapon: true } },
    offhandWeapon: { include: { weapon: true } }
  }
});
```

### Count robots by loadout type
```typescript
const counts = await prisma.robot.groupBy({
  by: ['loadoutType'],
  where: {
    user: { username: { startsWith: 'loadout_' } }
  },
  _count: true
});
```

## Notes

- All robots have Roster Expansion facility at max level (9)
- All robots start in Bronze League (bronze_1)
- All robots have balanced stance
- All robots have yield threshold set to 10%
- Robot names are abbreviated to fit within the 50-character database limit
  - MP = Machine Pistol
  - LP = Laser Pistol
  - CK = Combat Knife
  - MG = Machine Gun
  - 2H = Two-Handed
