#!/usr/bin/env python3
"""
Fix all test files to use the shared Prisma client singleton
instead of creating their own PrismaClient instances.

This prevents "too many database connections" errors when running tests.
"""
import os
import re
import sys

test_dirs = [
    os.path.join(os.path.dirname(__file__), '..', 'tests'),
    os.path.join(os.path.dirname(__file__), '..', 'tests', 'integration'),
]

SHARED_IMPORT = "import prisma from '../src/lib/prisma';"
SHARED_IMPORT_INTEGRATION = "import prisma from '../../src/lib/prisma';"

fixed_count = 0
skipped = []

for test_dir in test_dirs:
    if not os.path.isdir(test_dir):
        continue
    
    is_integration = 'integration' in test_dir
    shared_import = SHARED_IMPORT_INTEGRATION if is_integration else SHARED_IMPORT
    
    for filename in sorted(os.listdir(test_dir)):
        if not filename.endswith('.ts'):
            continue
        
        filepath = os.path.join(test_dir, filename)
        
        with open(filepath, 'r') as f:
            content = f.read()
        
        if 'new PrismaClient()' not in content:
            continue
        
        lines = content.split('\n')
        new_lines = []
        added_shared_import = False
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Case 1: "const prisma = new PrismaClient();" standalone line
            if re.match(r'^const prisma\s*=\s*new PrismaClient\(\);?\s*$', line):
                # Skip this line, we'll add the shared import elsewhere
                i += 1
                continue
            
            # Case 2: "import { PrismaClient } from '@prisma/client';" - only import
            if re.match(r"^import\s*\{\s*PrismaClient\s*\}\s*from\s*['\"]@prisma/client['\"];?\s*$", line):
                # Replace with shared import
                if not added_shared_import:
                    new_lines.append(shared_import)
                    added_shared_import = True
                i += 1
                continue
            
            # Case 3: "import { PrismaClient, OtherStuff } from '@prisma/client';"
            m = re.match(r"^(import\s*\{)\s*(.*?)\s*(\}\s*from\s*['\"]@prisma/client['\"];?)\s*$", line)
            if m and 'PrismaClient' in m.group(2):
                prefix = m.group(1)
                imports = m.group(2)
                suffix = m.group(3)
                
                # Remove PrismaClient from the import list
                parts = [p.strip() for p in imports.split(',')]
                parts = [p for p in parts if p != 'PrismaClient']
                
                if parts:
                    new_import = f"{prefix} {', '.join(parts)} {suffix}"
                    new_lines.append(new_import)
                
                if not added_shared_import:
                    new_lines.append(shared_import)
                    added_shared_import = True
                
                i += 1
                continue
            
            new_lines.append(line)
            i += 1
        
        # If we removed PrismaClient but never added the shared import
        # (e.g., file didn't have an import from @prisma/client)
        if not added_shared_import:
            # Find the last import line and add after it
            last_import_idx = -1
            for idx, line in enumerate(new_lines):
                if line.startswith('import '):
                    last_import_idx = idx
            
            if last_import_idx >= 0:
                new_lines.insert(last_import_idx + 1, shared_import)
            else:
                new_lines.insert(0, shared_import)
        
        new_content = '\n'.join(new_lines)
        
        with open(filepath, 'w') as f:
            f.write(new_content)
        
        fixed_count += 1
        print(f"  Fixed: {os.path.relpath(filepath, os.path.join(os.path.dirname(__file__), '..'))}")

print(f"\nTotal files fixed: {fixed_count}")
