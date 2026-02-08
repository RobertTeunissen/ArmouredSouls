# Facility Icons

This directory contains facility icons for the Armoured Souls game.

## Format Specifications

### WebP (Primary Format)
- **Resolution**: 256×256px
- **Quality**: 85-90%
- **Target File Size**: 10-30KB
- **Alpha Channel**: Yes (transparency)
- **Usage**: Modern browsers (Chrome, Firefox, Edge, Safari 14+)

### SVG (Fallback Format)
- **Canvas Size**: 256×256px
- **Target File Size**: < 10KB (SVGO optimized)
- **Usage**: Legacy browsers and when WebP fails to load

## File Naming Convention

- WebP: `facility-{facility-type}-icon.webp`
- SVG: `facility-{facility-type}-icon.svg`

Example:
- `facility-training-facility-icon.webp`
- `facility-training-facility-icon.svg`

## Required Icons (14 facilities)

1. **training_facility** - Training Facility (robot training/exercise equipment)
2. **weapons_workshop** - Weapons Workshop (weapons on workbench/forge)
3. **repair_bay** - Repair Bay (repair tools, wrench, maintenance)
4. **income_generator** - Income Generator (currency, merchandising)
5. **roster_expansion** - Roster Expansion (multiple robot silhouettes/hangar)
6. **storage_facility** - Storage Facility (weapon racks, containers)
7. **combat_training_academy** - Combat Training Academy (weapon targeting)
8. **defense_training_academy** - Defense Training Academy (shield, barrier)
9. **mobility_training_academy** - Mobility Training Academy (robot legs, movement)
10. **ai_training_academy** - AI Training Academy (circuit board, neural network)
11. **research_lab** - Research Lab (computers, analytics, graphs)
12. **medical_bay** - Medical Bay (medical cross, healing beams)
13. **coaching_staff** - Coaching Staff (coach clipboard, tactical board)
14. **booking_office** - Booking Office (trophy, tournament bracket)

## Creating New Icons

### Using AI Generation (Recommended)
1. Use DALL-E, Midjourney, or Stable Diffusion
2. Prompt: "256x256 pixel icon of [facility description], tech/sci-fi style, dark background, transparent PNG"
3. Convert PNG to WebP: `cwebp -q 90 input.png -o facility-{type}-icon.webp`
4. Create SVG version using vector tools or online converters

### Manual Creation
1. Design in vector graphics software (Figma, Inkscape, Illustrator)
2. Export as 256×256px PNG with transparency
3. Convert to WebP using imagemin-webp or cwebp
4. Export as optimized SVG using SVGO

### Optimization Tools
- **WebP**: `cwebp -q 85-90 input.png -o output.webp`
- **SVG**: `svgo --multipass input.svg -o output.svg`

## Current Status

- ✅ Directory structure created
- ✅ FacilityIcon component implemented with WebP/SVG fallback
- ⏳ Icons pending creation (using emoji placeholders)

## Usage in Code

```typescript
import FacilityIcon from '@/components/FacilityIcon';

<FacilityIcon 
  facilityType="training_facility"
  facilityName="Training Facility"
  size="medium"
/>
```

The component automatically:
1. Tries to load WebP version first
2. Falls back to SVG if WebP not supported
3. Falls back to emoji if images missing
