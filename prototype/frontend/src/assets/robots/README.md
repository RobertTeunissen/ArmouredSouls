# Robot Portrait Assets

This directory contains robot portrait images for the Armoured Souls game.

## Location

**Correct Path**: `prototype/frontend/src/assets/robots/`

Images in this directory will be bundled by Vite and served with the application.

## Image Specifications

### Format & Naming Convention

All robot portraits should follow this naming pattern:
```
robot-chassis-{chassis-name}-{colorway}.webp
```

### Chassis Types (12 total)

1. `humanoid-standard` - Balanced all-rounder
2. `heavy-tank` - Bulky and slow, high defense
3. `scout-runner` - Light and agile
4. `siege-frame` - Artillery-focused
5. `berserker` - Close combat specialist
6. `defender` - Shield-focused
7. `sniper-platform` - Long-range precision
8. `brawler` - Melee specialist
9. `support-unit` - Team coordination
10. `assault-class` - All-rounder
11. `interceptor` - Fast striker
12. `juggernaut` - Massive and armored

### Colorways (4 per chassis = 48 total images)

- `red` - Red/Black - Aggressive, offensive-focused
- `blue` - Blue/Silver - Defensive, tank-oriented
- `gold` - Gold/Bronze - Prestige, balanced
- `green` - Green/Gray - Utility, support-oriented

### Technical Specifications

- **Format**: WEBP (optimized for web)
- **Size**: 512×512px (master size, scales down automatically)
- **Style**: Industrial sci-fi, hard-surface mech rendering
- **Angle**: 3/4 view (shows depth, recognizable silhouette)
- **Background**: Dark gradient matching UI theme, subtle grid/hazard pattern
- **Lighting**: Consistent rim light from top-right

### Example File Names

```
robot-chassis-humanoid-standard-red.webp
robot-chassis-humanoid-standard-blue.webp
robot-chassis-humanoid-standard-gold.webp
robot-chassis-humanoid-standard-green.webp
robot-chassis-heavy-tank-red.webp
robot-chassis-heavy-tank-blue.webp
robot-chassis-heavy-tank-gold.webp
robot-chassis-heavy-tank-green.webp
... (48 total files)
```

## Usage in Code

The `RobotImage` component automatically constructs the correct file path based on:
- `frameId` (1-12) → maps to chassis name
- `paintJob` ('red', 'blue', 'gold', 'green') → colorway

If an image file doesn't exist, the component displays a placeholder with a robot emoji.

## Creating Assets

When creating robot portraits:

1. Follow the technical specifications above
2. Maintain consistent lighting across all images
3. Use the same background style for all portraits
4. Ensure color palette matches the design system
5. Optimize file size (target <100KB per image)
6. Test at multiple display sizes (64px, 128px, 256px, 512px)

## Color Palette Reference

- **Red/Black**: `#f85149` (Combat Systems red)
- **Blue/Silver**: `#58a6ff` (Defensive Systems blue)
- **Gold/Bronze**: `#d29922` (AI Processing yellow/gold)
- **Green/Gray**: `#3fb950` (Chassis & Mobility green)

## Fallback Behavior

If an image is missing, the system will display:
- A robot emoji (🤖)
- The frame ID number
- An "Edit" button (for owners) to change appearance

This ensures the UI remains functional even without all assets.
