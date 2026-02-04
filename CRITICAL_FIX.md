# CRITICAL FIX: HTML Entity Encoding Issue

## Your Situation

You've done a hard reset (`git reset --hard`) and the file STILL has HTML entities. This means something on your Mac is modifying the file **AFTER** git checkout.

## What's Happening

Something on your system is converting:
- `&&` → `&amp;&amp;`
- `<` → `&lt;`
- `>` → `&gt;`

This happens AFTER git checks out the correct file.

## Immediate Fix

### Option 1: Use the Fix Script

```bash
cd /Users/robertteunissen/Downloads/ArmouredSouls
./fix_html_entities.sh
```

This script will:
1. Check for HTML entities
2. Fix them automatically
3. Show you what was fixed

### Option 2: Manual Fix

```bash
cd /Users/robertteunissen/Downloads/ArmouredSouls/prototype/frontend/src/pages

# Check what's actually in the file
hexdump -C HallOfRecordsPage.tsx | grep "narrowestVictory"

# If you see HTML entities, fix them:
sed -i '' 's/&amp;/\&/g' HallOfRecordsPage.tsx
sed -i '' 's/&lt;/</g' HallOfRecordsPage.tsx
sed -i '' 's/&gt;/>/g' HallOfRecordsPage.tsx

# Verify the fix
grep -n "narrowestVictory &&" HallOfRecordsPage.tsx
```

## Find the Culprit

Something is modifying your file. Check:

### 1. VS Code Settings

```bash
# Check VS Code settings
cat ~/Library/Application\ Support/Code/User/settings.json | grep -i html
```

Look for and DISABLE:
- `"editor.formatOnSave": true` (temporarily)
- Any HTML beautifier extensions
- Auto-save features

### 2. Other Editors

If using WebStorm, IntelliJ, or other IDEs:
- Check for "HTML entity encoding" settings
- Disable "format on save"
- Disable "optimize imports/code on save"

### 3. File Sync Tools

```bash
# Check if file is in iCloud or Dropbox
ls -l@  /Users/robertteunissen/Downloads/ArmouredSouls/prototype/frontend/src/pages/HallOfRecordsPage.tsx
```

If syncing with iCloud/Dropbox, try:
- Pause sync
- Move project outside synced folder
- Check file attributes: `xattr -l HallOfRecordsPage.tsx`

### 4. Git Hooks

```bash
# Check for git hooks
ls -la /Users/robertteunissen/Downloads/ArmouredSouls/.git/hooks/
cat /Users/robertteunissen/Downloads/ArmouredSouls/.git/hooks/post-checkout 2>/dev/null
```

### 5. Shell Aliases or Functions

```bash
# Check your shell config
grep -i "git\|sed\|checkout" ~/.zshrc ~/.bashrc ~/.bash_profile 2>/dev/null
```

## Nuclear Option: Bypass Git Entirely

If git is somehow corrupted, download directly:

```bash
cd /Users/robertteunissen/Downloads/ArmouredSouls/prototype/frontend/src/pages

# Backup current file
mv HallOfRecordsPage.tsx HallOfRecordsPage.tsx.broken

# Download fresh from GitHub
curl -L https://raw.githubusercontent.com/RobertTeunissen/ArmouredSouls/copilot/rebalancing-battle-formulas/prototype/frontend/src/pages/HallOfRecordsPage.tsx -o HallOfRecordsPage.tsx

# Verify it's correct
grep -c "&&" HallOfRecordsPage.tsx  # Should show 29
grep "&amp;" HallOfRecordsPage.tsx   # Should show nothing

cd ../../..
npm run dev
```

## Test Immediately

After fixing, test IMMEDIATELY before any editor touches the file:

```bash
# Fix the file
./fix_html_entities.sh

# DON'T OPEN IN EDITOR
# Go straight to npm run dev
cd prototype/frontend
npm run dev
```

If this works, then you know an editor is the culprit.

## Still Not Working?

If none of this works, try:

### Fresh Clone in Different Location

```bash
cd ~/Desktop
git clone https://github.com/RobertTeunissen/ArmouredSouls.git ArmouredSouls-fresh
cd ArmouredSouls-fresh
git checkout copilot/rebalancing-battle-formulas

# Check file IMMEDIATELY
grep "&amp;" prototype/frontend/src/pages/HallOfRecordsPage.tsx

cd prototype/frontend
npm install
npm run dev
```

### Check Node/NPM Versions

```bash
node --version  # Should be 18+ or 20+
npm --version   # Should be 9+ or 10+

# If old, update:
# brew install node@20
```

## Report Back

After trying these, let me know:
1. What did the fix script show?
2. Did the file have HTML entities?
3. Did `npm run dev` work after the script?
4. Did you find what was modifying the file?

The issue is definitely on your Mac, not in the repository!
