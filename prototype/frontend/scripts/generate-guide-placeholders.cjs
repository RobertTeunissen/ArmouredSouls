#!/usr/bin/env node
/**
 * Generates placeholder SVG images for the in-game guide.
 * These are simple colored rectangles with text labels.
 * Run: node prototype/frontend/scripts/generate-guide-placeholders.js
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', 'public', 'images', 'guide');

const SECTION_COLORS = {
  'getting-started': { bg: '#1a3a2a', accent: '#40916c' },
  'robots': { bg: '#1a2a3a', accent: '#4895ef' },
  'combat': { bg: '#3a1a1a', accent: '#d00000' },
  'weapons': { bg: '#3a2a1a', accent: '#e85d04' },
  'leagues': { bg: '#2a1a3a', accent: '#7b2cbf' },
  'tournaments': { bg: '#1a3a3a', accent: '#00b4d8' },
  'economy': { bg: '#2a3a1a', accent: '#80b918' },
  'facilities': { bg: '#3a3a1a', accent: '#ffd60a' },
  'prestige-fame': { bg: '#3a1a2a', accent: '#ff006e' },
  'strategy': { bg: '#1a2a2a', accent: '#48bfe3' },
  'integrations': { bg: '#2a2a3a', accent: '#9d4edd' },
};

const IMAGES = [
  { section: 'getting-started', name: 'core-game-loop-diagram', label: 'Core Game Loop Diagram' },
  { section: 'getting-started', name: 'roster-strategy-comparison', label: 'Roster Strategy Comparison' },
  { section: 'robots', name: 'attribute-categories-overview', label: 'Attribute Categories Overview' },
  { section: 'robots', name: 'attribute-combat-influence', label: 'Attribute Combat Influence' },
  { section: 'robots', name: 'training-academy-progression', label: 'Training Academy Progression' },
  { section: 'combat', name: 'attack-order-of-operations', label: 'Attack Order of Operations' },
  { section: 'combat', name: 'stance-comparison-chart', label: 'Stance Comparison Chart' },
  { section: 'combat', name: 'yield-threshold-tradeoff', label: 'Yield Threshold Trade-off' },
  { section: 'weapons', name: 'loadout-types-comparison', label: 'Loadout Types Comparison' },
  { section: 'weapons', name: 'weapon-categories-overview', label: 'Weapon Categories Overview' },
  { section: 'weapons', name: 'dual-wield-mechanics', label: 'Dual-Wield Mechanics' },
  { section: 'leagues', name: 'league-tier-progression', label: 'League Tier Progression' },
  { section: 'leagues', name: 'matchmaking-flow', label: 'Matchmaking Flow' },
  { section: 'leagues', name: 'promotion-demotion-rules', label: 'Promotion & Demotion Rules' },
  { section: 'tournaments', name: 'bracket-generation-example', label: 'Bracket Generation Example' },
  { section: 'tournaments', name: 'tournament-rewards-by-round', label: 'Tournament Rewards by Round' },
  { section: 'economy', name: 'daily-financial-cycle', label: 'Daily Financial Cycle' },
  { section: 'economy', name: 'income-sources-overview', label: 'Income Sources Overview' },
  { section: 'economy', name: 'league-tier-reward-scaling', label: 'League Tier Reward Scaling' },
  { section: 'facilities', name: 'facility-overview-grid', label: 'Facility Overview Grid' },
  { section: 'facilities', name: 'training-academy-system', label: 'Training Academy System' },
  { section: 'facilities', name: 'coaching-staff-system', label: 'Coaching Staff System' },
  { section: 'facilities', name: 'investment-priority-roadmap', label: 'Investment Priority Roadmap' },
  { section: 'prestige-fame', name: 'prestige-rank-progression', label: 'Prestige Rank Progression' },
  { section: 'prestige-fame', name: 'fame-tier-progression', label: 'Fame Tier Progression' },
  { section: 'prestige-fame', name: 'prestige-income-impact', label: 'Prestige Income Impact' },
  { section: 'strategy', name: 'tank-archetype', label: 'Tank Archetype' },
  { section: 'strategy', name: 'glass-cannon-archetype', label: 'Glass Cannon Archetype' },
  { section: 'strategy', name: 'speed-demon-archetype', label: 'Speed Demon Archetype' },
  { section: 'strategy', name: 'counter-striker-archetype', label: 'Counter Striker Archetype' },
  { section: 'strategy', name: 'sniper-archetype', label: 'Sniper Archetype' },
  { section: 'strategy', name: 'budget-allocation-strategies', label: 'Budget Allocation Strategies' },
  { section: 'integrations', name: 'notification-flow-diagram', label: 'Notification Flow Diagram' },
];

function generateSVG(label, colors) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${colors.bg}"/>
  <rect x="20" y="20" width="1160" height="590" rx="12" fill="none" stroke="${colors.accent}" stroke-width="2" stroke-dasharray="8 4"/>
  <text x="600" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="${colors.accent}" font-weight="bold">${label}</text>
  <text x="600" y="340" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#888888">Placeholder — Replace with final asset</text>
  <text x="600" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#555555">ARMOURED SOULS GUIDE</text>
</svg>`;
}

let created = 0;

for (const img of IMAGES) {
  const dir = path.join(BASE_DIR, img.section);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${img.name}.png`);
  if (!fs.existsSync(filePath)) {
    const colors = SECTION_COLORS[img.section];
    const svg = generateSVG(img.label, colors);
    // Write as SVG with .png extension — these are placeholders only.
    // The ContentRenderer's img onError handler will show alt text if needed.
    // For proper placeholders, replace with actual PNG files later.
    fs.writeFileSync(filePath, svg, 'utf-8');
    created++;
  }
}

console.log(`Created ${created} placeholder images in ${BASE_DIR}`);
console.log(`Total images expected: ${IMAGES.length}`);
