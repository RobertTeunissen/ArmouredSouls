# Image Assets - Phase 1 (Placeholders + Generation Scripts)

This folder contains the initial asset directory structure and SVG placeholder assets created to implement Phase 1 of the PRD: docs/PRD_IMAGE_SYSTEM.md.

PRD: https://github.com/RobertTeunissen/ArmouredSouls/blob/main/docs/PRD_IMAGE_SYSTEM.md

Purpose:
- Provide lightweight SVG placeholder icons and art that developers can import immediately.
- Provide scripts and prompt templates to generate AI WEBP assets (robots, weapons, facilities).
- Provide conversion scripts to convert SVG/PNG sources to optimized WEBP files for production.

What was added in this commit (Phase 1):
- brand/logo_icon.svg (vector placeholder)
- icons/ (attribute icons, nav, benefit, weapon-type icons, chassis silhouettes)
- robots/ (48 robot portrait placeholders - currently 12 chassis single-color placeholders)
- weapons/ (10 weapon thumbnail placeholders)
- facilities/ (14 facility placeholders)
- backgrounds/ (arena background placeholder)
- scripts/convert_svgs_to_webp.js (Node.js script using sharp)
- scripts/generate_ai_images.sh (bash template to generate AI images via an image API)

How to replace placeholders with final WEBP assets (example workflow):
1. Use the AI prompt templates in this README or an external tool (Midjourney, DALL·E, Stable Diffusion) to generate PNG/PNG sequences at high resolution (1024-2048px).
2. Place final PNGs in the corresponding folders (e.g. prototype/frontend/src/assets/robots/).
3. Run the conversion script to produce WEBP versions and retina variants:
   - Install deps: `npm install sharp`
   - `node prototype/frontend/src/assets/scripts/convert_svgs_to_webp.js --in ./prototype/frontend/src/assets/robots --out ./prototype/frontend/src/assets/robots --sizes 64,128,256,512 --quality 85`

Example cwebp command (if you prefer cwebp):

  cwebp -q 85 input.png -o output.webp

AI prompt templates (examples):

Robot portrait (512x512):
"industrial sci-fi battle robot, HUMANOID chassis, red/black colorway, 3/4 view, hard-surface mech rendering, worn metal texture, dark gradient background with subtle grid, rim lighting from top-right, 512x512, high detail"

Weapon thumbnail (512x512):
"plasma blade, glowing blue blade, 3/4 view, hard-surface, dark gradient background, rim light, 512x512, high detail"

Facility card (1024x576):
"weapon workshop interior, industrial assembly lines, sparks flying, wide shot, worn metal, overhead lighting, 1024x576"

Notes on licensing:
- You confirmed generating assets with AI for this repo. Please ensure any AI generation tool you use allows commercial reuse for the intended license of this repo. Document the tool name and prompt (add to /docs/ASSET_SOURCES.md) for provenance.

TODOs for designers / maintainers:
- Replace these SVG placeholders with final WEBP assets.
- Run optimization and verify file sizes meet PRD targets (<100KB per 512x512 portrait).
- Add retina variants and srcset entries in components that render images.
