console.log('\n═══════════════════════════════════════════════════════════');
console.log('  SOLVING THE REPAIR COST MYSTERY');
console.log('═══════════════════════════════════════════════════════════\n');

// Known facts
const actualPaid = 25779;
const discount = 0.14;
const preDiscountAmount = actualPaid / (1 - discount);
const battleStoredTotal = 30988;

console.log('KNOWN FACTS:');
console.log(`  Amount actually paid: ₡${actualPaid.toLocaleString()}`);
console.log(`  Discount: 14%`);
console.log(`  Pre-discount (calculated): ₡${Math.round(preDiscountAmount).toLocaleString()}`);
console.log(`  Battle table total: ₡${battleStoredTotal.toLocaleString()}`);
console.log(`  Difference: ₡${Math.abs(battleStoredTotal - Math.round(preDiscountAmount)).toLocaleString()}\n`);

// Robot stats
const sumOfAttributes = 81;
const baseRepairCost = sumOfAttributes * 100; // ₡8,100
const maxHP = 80;

console.log('ROBOT STATS:');
console.log(`  Sum of attributes: ${sumOfAttributes}`);
console.log(`  Base repair cost: ₡${baseRepairCost.toLocaleString()}`);
console.log(`  Max HP: ${maxHP}\n`);

// Battle damage (what was stored)
console.log('BATTLE #59 STORED COSTS:');
console.log(`  Morning Ride: 5HP remaining, 75HP damage (93.75%), 1.5x multiplier`);
console.log(`    Calculation: ₡8,100 × 0.9375 × 1.5 = ₡${Math.round(8100 * 0.9375 * 1.5).toLocaleString()}`);
console.log(`    Stored: ₡12,316`);
console.log();
console.log(`  Afternoon Ride: 0HP remaining, 80HP damage (100%), 2.0x multiplier`);
console.log(`    Calculation: ₡8,100 × 1.0 × 2.0 = ₡${Math.round(8100 * 1.0 * 2.0).toLocaleString()}`);
console.log(`    Stored: ₡18,672`);
console.log();
console.log(`  Total stored: ₡30,988\n`);

// What RepairService calculated
const targetPreDiscount = Math.round(preDiscountAmount);
console.log('REPAIR SERVICE CALCULATION:');
console.log(`  Target pre-discount: ₡${targetPreDiscount.toLocaleString()}`);
console.log(`  We need to find what damage gives us this amount\n`);

// Try to find the combination
console.log('SEARCHING FOR MATCHING DAMAGE COMBINATIONS:\n');

let found = false;
for (let morningHP = 0; morningHP <= 80; morningHP++) {
  for (let afternoonHP = 0; afternoonHP <= 80; afternoonHP++) {
    const morningDamage = maxHP - morningHP;
    const afternoonDamage = maxHP - afternoonHP;
    
    const morningDamagePercent = (morningDamage / maxHP);
    const afternoonDamagePercent = (afternoonDamage / maxHP);
    
    let morningMultiplier = 1.0;
    if (morningHP === 0) morningMultiplier = 2.0;
    else if (morningHP < maxHP * 0.1) morningMultiplier = 1.5;
    
    let afternoonMultiplier = 1.0;
    if (afternoonHP === 0) afternoonMultiplier = 2.0;
    else if (afternoonHP < maxHP * 0.1) afternoonMultiplier = 1.5;
    
    const morningCost = baseRepairCost * morningDamagePercent * morningMultiplier;
    const afternoonCost = baseRepairCost * afternoonDamagePercent * afternoonMultiplier;
    const total = Math.round(morningCost + afternoonCost);
    
    if (Math.abs(total - targetPreDiscount) <= 2) {
      console.log(`✅ MATCH FOUND!`);
      console.log(`  Morning Ride: ${morningHP}HP remaining (${morningDamage}HP damage, ${(morningDamagePercent * 100).toFixed(2)}%, ${morningMultiplier}x)`);
      console.log(`    Cost: ₡8,100 × ${morningDamagePercent.toFixed(4)} × ${morningMultiplier} = ₡${Math.round(morningCost).toLocaleString()}`);
      console.log(`  Afternoon Ride: ${afternoonHP}HP remaining (${afternoonDamage}HP damage, ${(afternoonDamagePercent * 100).toFixed(2)}%, ${afternoonMultiplier}x)`);
      console.log(`    Cost: ₡8,100 × ${afternoonDamagePercent.toFixed(4)} × ${afternoonMultiplier} = ₡${Math.round(afternoonCost).toLocaleString()}`);
      console.log(`  Total: ₡${total.toLocaleString()}`);
      console.log(`  With 14% discount: ₡${Math.round(total * 0.86).toLocaleString()}`);
      console.log();
      found = true;
    }
  }
}

if (!found) {
  console.log('❌ No exact match found with integer HP values\n');
  console.log('This suggests:');
  console.log('  1. The RepairService uses a different formula');
  console.log('  2. There are rounding differences');
  console.log('  3. The damage was calculated differently\n');
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  CONCLUSION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('The ₡30,988 in Cycle 2 summary is INCORRECT for actual costs.');
console.log('It represents the battle-stored repair costs (pre-discount).\n');

console.log('The CORRECT repair cost is ₡25,779:');
console.log('  - This is what RepairService calculated and deducted');
console.log('  - This includes the 14% Repair Bay discount');
console.log('  - This matches player1\'s actual credit balance\n');

console.log('The ₡1,012 discrepancy (₡30,988 vs ₡29,976 pre-discount) suggests:');
console.log('  - RepairService recalculates damage from current robot HP');
console.log('  - Different rounding or calculation method');
console.log('  - The battle-stored costs are estimates, not final\n');
