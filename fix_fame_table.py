#!/usr/bin/env python3
"""Script to remove Fame per Win column from Battle Winnings table."""

# Read the file
with open('docs/prd_core/PRD_ECONOMY_SYSTEM.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the table (lines 1097-1104, 0-indexed so 1096-1103)
# Line 1097 (index 1096): table header
# Line 1098 (index 1097): separator
# Lines 1099-1104 (index 1098-1103): data rows

# New table without Fame per Win column
new_table = [
    "| League | Win Reward Range | Prestige per Win |\n",
    "|--------|-----------------|------------------|\n",
    "| Bronze | ₡5,000 - ₡10,000 | +5 |\n",
    "| Silver | ₡10,000 - ₡20,000 | +10 |\n",
    "| Gold | ₡20,000 - ₡40,000 | +20 |\n",
    "| Platinum | ₡40,000 - ₡80,000 | +30 |\n",
    "| Diamond | ₡80,000 - ₡150,000 | +50 |\n",
    "| Champion | ₡150,000 - ₡300,000 | +75 |\n",
]

# Replace lines 1097-1104 (indices 1096-1103)
lines[1096:1104] = new_table

# Add reference note after the table (before line 1105 which becomes 1104 after replacement)
# Insert after line 1104 (new index after replacement)
reference_note = "\n> **For fame earning by league**: See [Fame (Robot-Level Reputation)](#fame-robot-level-reputation) section below.\n\n"
lines.insert(1104, reference_note)

# Write back
with open('docs/prd_core/PRD_ECONOMY_SYSTEM.md', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Successfully removed Fame per Win column and added reference note")
