# Facility Visual Assets for Step 3

This directory contains facility icons and benefit diagrams used in Step 3: Facility Timing and Priority Education.

## Required Facility Icons (64×64px each)

All facility icons should be 64×64 pixels, PNG format with transparency, optimized for web.

### Mandatory Facilities

#### 1. Weapons Workshop
- **Filename**: `facility-weapons-workshop.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Weapons Workshop facility
- **Design Notes**: 
  - Should represent weapon crafting/manufacturing
  - Could include tools, workbench, or weapon silhouettes
  - Use blue/metallic color scheme
  - Should be recognizable at small size

#### 2. Training Facility
- **Filename**: `facility-training-facility.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Training Facility
- **Design Notes**:
  - Should represent training/education
  - Could include training equipment, gym, or skill icons
  - Use green/growth color scheme
  - Should convey improvement/progression

#### 3. Roster Expansion
- **Filename**: `facility-roster-expansion.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Roster Expansion facility
- **Design Notes**:
  - Should represent adding more robots
  - Could show multiple robot silhouettes or expansion arrows
  - Use purple/expansion color scheme
  - Should convey growth/addition

### Recommended Facilities

#### 4. Storage Facility
- **Filename**: `facility-storage-facility.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Storage Facility
- **Design Notes**:
  - Should represent storage/inventory
  - Could include warehouse, boxes, or storage racks
  - Use gray/neutral color scheme
  - Should convey capacity/space

#### 5. Repair Bay
- **Filename**: `facility-repair-bay.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Repair Bay facility
- **Design Notes**:
  - Should represent repair/maintenance
  - Could include tools, wrench, or repair station
  - Use amber/maintenance color scheme
  - Should convey fixing/restoration

### Optional Facilities

#### 6. Defense Training Academy
- **Filename**: `facility-defense-academy.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Defense Training Academy
- **Design Notes**:
  - Should represent defensive training
  - Could include shield, armor, or defensive posture
  - Use blue/defensive color scheme
  - Should convey protection/defense

#### 7. AI Training Academy
- **Filename**: `facility-ai-academy.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for AI Training Academy
- **Design Notes**:
  - Should represent AI/intelligence
  - Could include circuit patterns, brain, or AI symbols
  - Use cyan/tech color scheme
  - Should convey intelligence/computation

#### 8. Power Training Academy
- **Filename**: `facility-power-academy.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Power Training Academy
- **Design Notes**:
  - Should represent power/strength
  - Could include lightning, energy, or power symbols
  - Use red/power color scheme
  - Should convey strength/force

#### 9. Merchandising Hub
- **Filename**: `facility-merchandising-hub.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Merchandising Hub
- **Design Notes**:
  - Should represent merchandise/sales
  - Could include shop, products, or commerce symbols
  - Use green/money color scheme
  - Should convey passive income

#### 10. Streaming Studio
- **Filename**: `facility-streaming-studio.png`
- **Dimensions**: 64×64px
- **Format**: PNG with transparency
- **Purpose**: Icon for Streaming Studio
- **Design Notes**:
  - Should represent streaming/broadcasting
  - Could include camera, broadcast symbols, or streaming icons
  - Use purple/entertainment color scheme
  - Should convey broadcasting/content creation

## Facility Benefit Diagrams

### Savings Comparison Diagram
- **Filename**: `facility-savings-comparison.png`
- **Dimensions**: 800×400px
- **Format**: PNG or SVG
- **Purpose**: Visual comparison of costs with/without discount facilities
- **Design Notes**:
  - Show side-by-side comparison
  - Left side: Without facility (higher cost, red)
  - Right side: With facility (lower cost, green)
  - Include specific credit amounts (₡275K → ₡206K)
  - Use arrows or visual indicators to show savings
  - Should be clear and easy to understand

### Facility Priority Flow Diagram
- **Filename**: `facility-priority-flow.png`
- **Dimensions**: 1000×600px
- **Format**: PNG or SVG
- **Purpose**: Visual flowchart showing facility purchase order
- **Design Notes**:
  - Show numbered sequence (1 → 2 → 3 → 4)
  - Include facility icons in sequence
  - Use color coding for priority levels:
    - Red: Mandatory
    - Blue: Recommended
    - Gray: Optional
  - Include brief labels for each facility
  - Should guide eye through correct purchase order

### ROI Timeline Diagram
- **Filename**: `facility-roi-timeline.png`
- **Dimensions**: 800×300px
- **Format**: PNG or SVG
- **Purpose**: Visual timeline showing when facilities pay for themselves
- **Design Notes**:
  - Horizontal timeline (0-90 days)
  - Show break-even points for each facility
  - Weapons Workshop: ~30 days
  - Training Facility: ~45 days
  - Repair Bay: ~60 days
  - Use color-coded bars or markers
  - Should convey investment payback period

## Color Palette Reference

Use these colors to match the game's design system:

- **Primary Blue**: #3B82F6 (blue-600) - Technology, workshops
- **Success Green**: #10B981 (green-600) - Training, growth, savings
- **Warning Amber**: #F59E0B (amber-500) - Maintenance, repairs
- **Danger Red**: #EF4444 (red-500) - Mandatory, critical
- **Purple**: #8B5CF6 (purple-600) - Expansion, entertainment
- **Indigo**: #6366F1 (indigo-600) - AI, intelligence
- **Gray**: #6B7280 (gray-500) - Storage, neutral

## Design Guidelines

### Icon Design
- **Style**: Flat design with subtle gradients
- **Consistency**: All icons should share similar visual style
- **Clarity**: Icons must be recognizable at 64×64px
- **Contrast**: Ensure good contrast for dark mode UI
- **Simplicity**: Avoid excessive detail that won't show at small size

### Diagram Design
- **Readability**: Text should be legible at intended display size
- **Hierarchy**: Use size and color to establish visual hierarchy
- **Spacing**: Adequate whitespace between elements
- **Consistency**: Match existing onboarding visual style
- **Accessibility**: Ensure sufficient color contrast (WCAG AA)

## Fallback Behavior

The FacilityIcon component includes fallback behavior:
- If icon image fails to load, displays facility name as text
- Component remains functional without images
- This allows development to proceed while assets are being created

## Asset Status

### Facility Icons (64×64px)
- [ ] `facility-weapons-workshop.png` - **PENDING**
- [ ] `facility-training-facility.png` - **PENDING**
- [ ] `facility-roster-expansion.png` - **PENDING**
- [ ] `facility-storage-facility.png` - **PENDING**
- [ ] `facility-repair-bay.png` - **PENDING**
- [ ] `facility-defense-academy.png` - **PENDING**
- [ ] `facility-ai-academy.png` - **PENDING**
- [ ] `facility-power-academy.png` - **PENDING**
- [ ] `facility-merchandising-hub.png` - **PENDING**
- [ ] `facility-streaming-studio.png` - **PENDING**

### Benefit Diagrams
- [ ] `facility-savings-comparison.png` - **PENDING** (Optional - text examples sufficient)
- [ ] `facility-priority-flow.png` - **PENDING** (Optional - FacilityPriorityList provides this)
- [ ] `facility-roi-timeline.png` - **PENDING** (Optional - text examples sufficient)

## Implementation Notes

### Current Implementation
The Step3_FacilityTiming component currently uses:
- **FacilityPriorityList**: Displays facilities in priority order with text descriptions
- **FacilityBenefitCards**: Shows detailed savings examples with text and numbers
- **FacilityIcon**: Component that displays facility icons (with text fallback)

### Icon Integration
Facility icons are displayed via the FacilityIcon component:
```tsx
<FacilityIcon 
  facilityType="weapons_workshop" 
  facilityName="Weapons Workshop" 
  size="medium" 
/>
```

The component looks for images at:
`/assets/onboarding/facilities/facility-{facilityType}.png`

### Priority
**High Priority**: Facility icons (10 icons)
- These are displayed throughout the onboarding
- Enhance visual recognition and learning
- Relatively small file size impact

**Low Priority**: Benefit diagrams (3 diagrams)
- Current text-based examples are clear and effective
- Diagrams would be nice-to-have enhancements
- Can be added in future iteration

## Temporary Placeholders

For development purposes, the FacilityIcon component uses text fallback when images are missing. This is intentional and allows the onboarding to function fully without images.

## Asset Delivery

When assets are ready:
1. Place icon files in this directory (`prototype/frontend/public/assets/onboarding/facilities/`)
2. Ensure filenames match exactly as specified (lowercase, hyphens, .png extension)
3. Verify icons display correctly in both light and dark modes
4. Test at various screen sizes (mobile, tablet, desktop)
5. Optimize file sizes (use tools like TinyPNG or ImageOptim)
6. Update this README to mark assets as complete

## Questions or Issues

If you have questions about asset requirements or need clarification on design specifications, please refer to:
- Design system: `docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md`
- Component implementation: `prototype/frontend/src/components/onboarding/`
- Requirements: `.kiro/specs/new-player-onboarding/requirements.md`
