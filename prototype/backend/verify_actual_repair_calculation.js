// The repair service calculated ₡25,779 with 14% discount
// Let's work backwards to find the pre-discount amount

const actualPaid = 25779;
const discount = 0.14;
const preDiscountAmount = actualPaid / (1 - discount);

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  ACTUAL REPAIR COST CALCULATION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('From terminal log: [RepairService] User 2: Repaired 2 robot(s) for ₡25,779 (14% discount)\n');

console.log('Working backwards:');
console.log(`  Amount paid: ₡${actualPaid.toLocaleString()}`);
console.log(`  Discount: ${discount * 100}%`);
console.log(`  Pre-discount amount: ₡${actualPaid.toLocaleString()} / ${1 - discount} = ₡${Math.round(preDiscountAmount).toLocaleString()}\n`);

console.log('Comparison:');
console.log(`  Battle table total: ₡30,988`);
console.log(`  Pre-discount (calculated): ₡${Math.round(preDiscountAmount).toLocaleString()}`);
console.log(`  Difference: ₡${Math.abs(30988 - Math.round(preDiscountAmount)).toLocaleString()}\n`);

console.log('═══════════════════════════════════════════════════════════');
console.log('  CONCLUSION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('The ₡30,988 shown in Cycle 2 summary represents:');
console.log('  ✅ The repair costs calculated AT THE END OF BATTLES');
console.log('  ✅ Stored in the Battle table (robot1RepairCost + robot2RepairCost)');
console.log('  ✅ Used for cycle snapshot metrics\n');

console.log('The ₡25,779 actually deducted from player1 represents:');
console.log('  ✅ The repair costs calculated by RepairService');
console.log('  ✅ Based on robot HP when repair was triggered');
console.log('  ✅ WITH 14% Repair Bay discount applied');
console.log('  ✅ The ACTUAL amount deducted from currency\n');

console.log('Why the difference?');
console.log('  The RepairService recalculates costs based on CURRENT damage,');
console.log('  not the battle-stored costs. This could differ if:');
console.log('  1. Robots were partially healed between battles');
console.log('  2. Different damage calculation at repair time');
console.log('  3. Rounding differences in the formula\n');

console.log('ANSWER TO YOUR QUESTION:');
console.log('  The CORRECT repair cost is: ₡25,779');
console.log('  This is what was actually deducted from player1\'s credits.');
console.log('  The ₡30,988 is a pre-discount estimate stored during battles.\n');

// Let's calculate what the battle costs would be with discount
const battleCostsWithDiscount = Math.round(30988 * (1 - discount));
console.log(`If we applied 14% discount to battle costs:`);
console.log(`  ₡30,988 × ${1 - discount} = ₡${battleCostsWithDiscount.toLocaleString()}`);
console.log(`  Actual paid: ₡${actualPaid.toLocaleString()}`);
console.log(`  Difference: ₡${Math.abs(battleCostsWithDiscount - actualPaid).toLocaleString()}`);
console.log(`  This ${Math.abs(battleCostsWithDiscount - actualPaid)} credit difference suggests`);
console.log(`  the RepairService calculated slightly different damage amounts.\n`);
