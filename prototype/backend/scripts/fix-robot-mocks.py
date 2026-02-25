#!/usr/bin/env python3
"""
Fix Robot mock objects in test files to include missing fields:
- totalTagTeamBattles, totalTagTeamWins, totalTagTeamLosses, totalTagTeamDraws
- timesTaggedIn, timesTaggedOut
- imageUrl
"""
import re
import os
import sys

# Fields to add after specific existing fields
MISSING_FIELDS = {
    'totalTagTeamBattles': '0',
    'totalTagTeamWins': '0',
    'totalTagTeamLosses': '0',
    'totalTagTeamDraws': '0',
    'timesTaggedIn': '0',
    'timesTaggedOut': '0',
    'imageUrl': 'null',
}

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Check if file has Robot mock objects (look for patterns like kills: 0, or totalBattles:)
    if 'createMockRobot' not in content and 'Robot' not in content:
        return False
    
    changed = False
    
    for field, default_val in MISSING_FIELDS.items():
        if field not in content:
            # Try to add after 'kills' field (which comes just before league fields)
            # or after 'cyclesInCurrentLeague' for tag team fields
            if field.startswith('totalTagTeam') or field.startswith('times'):
                # Add after cyclesInCurrentLeague or after fame/titles
                patterns = [
                    # After titles line
                    (r'(titles:\s*(?:null|\'[^\']*\'|"[^"]*"|[^,\n]*),?\n)', 
                     f'\\1  {field}: {default_val},\n'),
                ]
            elif field == 'imageUrl':
                # Add after offhandWeaponId or stance
                patterns = [
                    (r'(offhandWeaponId:\s*(?:null|\d+)[^,\n]*,?\n)',
                     f'\\1  {field}: {default_val},\n'),
                ]
            else:
                continue
            
            for pattern, replacement in patterns:
                new_content = re.sub(pattern, replacement, content, count=0)
                if new_content != content:
                    content = new_content
                    changed = True
                    break
    
    if changed:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    test_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tests')
    fixed = 0
    for root, dirs, files in os.walk(test_dir):
        for fname in files:
            if fname.endswith('.test.ts') or fname.endswith('.property.test.ts'):
                filepath = os.path.join(root, fname)
                if fix_file(filepath):
                    print(f'Fixed: {filepath}')
                    fixed += 1
    print(f'\nTotal files fixed: {fixed}')

if __name__ == '__main__':
    main()
