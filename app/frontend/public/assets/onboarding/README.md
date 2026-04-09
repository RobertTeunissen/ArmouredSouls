# Onboarding Visual Assets

This directory contains all visual assets used in the onboarding tutorial system.

## Required Assets for Step 1: Welcome and Strategic Overview

### Game Logo
- **Filename**: `game-logo.png`
- **Dimensions**: Flexible height (displayed at h-24, ~96px)
- **Format**: PNG with transparency
- **Purpose**: Main game branding on welcome screen
- **Location**: Top of welcome screen, centered
- **Design Notes**: Should be the official Armoured Souls logo

### Strategic Overview Illustration
- **Filename**: `strategic-overview.png`
- **Dimensions**: 800×600px (max-w-2xl container)
- **Format**: PNG or JPG
- **Purpose**: Visual representation of the strategic decision-making process
- **Location**: Center of welcome screen, below strategic question section
- **Design Notes**: 
  - Should illustrate the concept of "How many robots should I build?"
  - Could show 3 paths branching from a central decision point
  - Should include visual elements representing:
    - Robots (1, 2, or 3)
    - Facilities
    - Weapons
    - Budget/credits
  - Style should match game's visual aesthetic
  - Should be clear and easy to understand at a glance

## Asset Creation Guidelines

### General Requirements
- All images should be optimized for web (compressed but high quality)
- Use consistent color palette matching the game's design system
- Ensure images work well in both light and dark modes
- Include alt text descriptions for accessibility

### Color Palette Reference
Based on the game's Tailwind configuration:
- Primary Blue: #3B82F6 (blue-600)
- Success Green: #10B981 (green-600)
- Warning Amber: #F59E0B (amber-500)
- Danger Red: #EF4444 (red-500)
- Purple: #8B5CF6 (purple-600)
- Indigo: #6366F1 (indigo-600)

### Fallback Behavior
The Step1_Welcome component includes error handling for missing images:
- If images fail to load, they are hidden (display: none)
- The component remains fully functional without images
- This allows development to proceed while assets are being created

## Asset Status

### Step 1 Assets
- [ ] `game-logo.png` - **PENDING**: Needs to be created/provided
- [ ] `strategic-overview.png` - **PENDING**: Needs to be created/provided

## Future Assets (Other Steps)

Additional assets will be needed for subsequent tutorial steps:
- Step 2: Roster strategy visualizations (roster-1-mighty.png, roster-2-average.png, roster-3-flimsy.png)
- **Step 3: Facility icons and diagrams** - See `facilities/README.md` for detailed specifications
  - 10 facility icons (64×64px each)
  - Optional benefit diagrams for visual learners
- Step 4: Budget allocation charts
- Step 6: Loadout type diagrams
- Step 9: Battle type illustrations and cycle schedule

See the main tasks.md file for complete asset requirements.

## Asset Delivery

When assets are ready:
1. Place files in this directory (`app/frontend/public/assets/onboarding/`)
2. Ensure filenames match exactly as specified
3. Verify images display correctly in both light and dark modes
4. Test on various screen sizes (mobile, tablet, desktop)
5. Update this README to mark assets as complete

## Temporary Placeholders

For development purposes, you can use placeholder images:
- https://via.placeholder.com/800x600?text=Strategic+Overview
- https://via.placeholder.com/400x96?text=Game+Logo

Replace these with final assets before production deployment.
