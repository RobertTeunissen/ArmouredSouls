# Robot Portrait Image Generation Guide

## Quick Reference

Generate 48 images total: 12 chassis types × 4 colorways

## AI Image Generation Prompts

Use these prompts with AI image generators (Midjourney, DALL-E, Stable Diffusion, etc.)

### Base Prompt Template

```
Industrial sci-fi combat robot, {CHASSIS_DESCRIPTION}, {COLORWAY_DESCRIPTION}, 
3/4 view angle, hard-surface mechanical design, metallic materials, 
dark gradient background with subtle tech grid pattern, 
rim lighting from top-right, professional game asset, 
high detail, 512x512 resolution, square format
```

### Chassis-Specific Prompts

#### 1. Humanoid Standard (Balanced)
```
Industrial sci-fi combat robot, humanoid bipedal design, balanced proportions, 
medium armor plating, versatile weapon mounts, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 2. Heavy Tank (Bulky, Slow)
```
Industrial sci-fi combat robot, heavy tank chassis, bulky quadruped or tracked design, 
massive armor plating, slow but powerful, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 3. Scout Runner (Light, Agile)
```
Industrial sci-fi combat robot, scout runner chassis, lightweight sleek design, 
minimal armor, long legs for speed, agile proportions, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 4. Siege Frame (Artillery)
```
Industrial sci-fi combat robot, siege artillery frame, heavy weapon platforms, 
stabilizer legs, long-range cannon mounts, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 5. Berserker (Close Combat)
```
Industrial sci-fi combat robot, berserker melee chassis, aggressive stance, 
reinforced fists and arms, close-combat design, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 6. Defender (Shield-Focused)
```
Industrial sci-fi combat robot, defender chassis, heavy frontal armor, 
shield generator mounts, protective stance, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 7. Sniper Platform (Long-Range)
```
Industrial sci-fi combat robot, sniper platform chassis, precision weapon mounts, 
stable tripod or bipod stance, targeting sensors, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 8. Brawler (Melee Specialist)
```
Industrial sci-fi combat robot, brawler melee chassis, powerful hydraulic limbs, 
combat-ready stance, reinforced joints, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 9. Support Unit (Team Coordination)
```
Industrial sci-fi combat robot, support unit chassis, communication arrays, 
sensor packages, auxiliary systems, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 10. Assault Class (All-Rounder)
```
Industrial sci-fi combat robot, assault class chassis, balanced combat design, 
multiple weapon hardpoints, versatile configuration, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

#### 11. Interceptor (Fast Striker)
```
Industrial sci-fi combat robot, interceptor chassis, aerodynamic design, 
high-speed thrusters, lightweight frame, rapid strike configuration, {COLORWAY}, 
3/4 view angle, hard-surface mechanical design, metallic materials, 
dark gradient background with subtle tech grid, rim lighting from top-right, game asset style
```

#### 12. Juggernaut (Massive, Armored)
```
Industrial sci-fi combat robot, juggernaut chassis, massive size, 
extremely heavy armor plating, intimidating presence, {COLORWAY}, 3/4 view angle, 
hard-surface mechanical design, metallic materials, dark gradient background 
with subtle tech grid, rim lighting from top-right, game asset style
```

### Colorway Descriptions

Replace `{COLORWAY}` in prompts above with:

- **Red/Black**: `red and black color scheme, aggressive crimson accents, dark matte black base`
- **Blue/Silver**: `blue and silver color scheme, defensive cobalt blue accents, polished silver base`
- **Gold/Bronze**: `gold and bronze color scheme, prestigious golden accents, bronze metallic base`
- **Green/Gray**: `green and gray color scheme, utility olive green accents, gunmetal gray base`

## Post-Processing Steps

After generating images:

1. **Resize to 512×512px** (if not already)
2. **Convert to WEBP format**
   ```bash
   # Using ImageMagick
   convert input.png -quality 85 output.webp
   
   # Using cwebp
   cwebp -q 85 input.png -o output.webp
   ```
3. **Optimize file size** (target <100KB per image)
4. **Rename following convention**:
   ```
   robot-chassis-{chassis-name}-{colorway}.webp
   ```
5. **Verify consistency**:
   - Same lighting angle across all images
   - Similar background style
   - Consistent level of detail

## Batch Generation Script

```bash
#!/bin/bash
# Example batch conversion script

CHASSIS_TYPES=(
  "humanoid-standard"
  "heavy-tank"
  "scout-runner"
  "siege-frame"
  "berserker"
  "defender"
  "sniper-platform"
  "brawler"
  "support-unit"
  "assault-class"
  "interceptor"
  "juggernaut"
)

COLORWAYS=("red" "blue" "gold" "green")

for chassis in "${CHASSIS_TYPES[@]}"; do
  for color in "${COLORWAYS[@]}"; do
    input="generated/${chassis}-${color}.png"
    output="robot-chassis-${chassis}-${color}.webp"
    
    if [ -f "$input" ]; then
      cwebp -q 85 "$input" -o "$output"
      echo "Converted: $output"
    fi
  done
done
```

## Quality Checklist

Before finalizing images:

- [ ] All 48 images generated (12 chassis × 4 colors)
- [ ] Consistent 512×512px size
- [ ] WEBP format with quality 85
- [ ] File size <100KB each
- [ ] Consistent lighting (top-right rim light)
- [ ] Similar background style (dark gradient + grid)
- [ ] 3/4 view angle maintained
- [ ] Proper naming convention followed
- [ ] Colors match design system palette
- [ ] Industrial sci-fi aesthetic maintained

## Alternative: Placeholder Generation

If you need quick placeholders for testing:

```bash
# Generate colored squares with text (requires ImageMagick)
for chassis in {1..12}; do
  for color in red blue gold green; do
    convert -size 512x512 xc:gray20 \
      -fill "$color" -draw "rectangle 100,100 412,412" \
      -pointsize 40 -fill white -gravity center \
      -annotate +0+0 "Frame $chassis\n$color" \
      "robot-chassis-frame$chassis-$color.webp"
  done
done
```

## Resources

- **Midjourney**: https://midjourney.com
- **DALL-E**: https://openai.com/dall-e-3
- **Stable Diffusion**: https://stability.ai
- **ImageMagick**: https://imagemagick.org
- **cwebp**: https://developers.google.com/speed/webp/docs/cwebp

## Tips for Best Results

1. **Consistency is key** - Use the same base prompt structure for all images
2. **Batch generate** - Generate all colorways of one chassis at once
3. **Iterate on style** - Get one chassis perfect, then apply to others
4. **Test in-game** - Check how images look at different sizes (64px, 128px, 256px)
5. **Get feedback** - Show samples to team before generating all 48

## Example File List

When complete, your directory should contain:

```
robot-chassis-humanoid-standard-red.webp
robot-chassis-humanoid-standard-blue.webp
robot-chassis-humanoid-standard-gold.webp
robot-chassis-humanoid-standard-green.webp
robot-chassis-heavy-tank-red.webp
robot-chassis-heavy-tank-blue.webp
... (48 total files)
```
