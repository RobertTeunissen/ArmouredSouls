// Bot tier constants and shared types: the attribute level and weapon price
// band of generated stables (userGeneration.ts) and Practice Arena sparring bots.
// Every generated stable has the same shape (three robots, see
// FILLER_ROBOTS_PER_STABLE); the tier only sets how strong its robots are.

export interface TierConfig {
  name: 'WimpBot' | 'AverageBot' | 'ExpertBot';
  attributeLevel: number;
  priceTier: { min: number; max: number };
}

export const TIER_CONFIGS: TierConfig[] = [
  { name: 'WimpBot', attributeLevel: 1.0, priceTier: { min: 0, max: 99999 } },
  { name: 'AverageBot', attributeLevel: 5.0, priceTier: { min: 100000, max: 250000 } },
  { name: 'ExpertBot', attributeLevel: 10.0, priceTier: { min: 250000, max: 400000 } },
];

export const LOADOUT_TITLES: Record<string, string> = {
  single: 'Lone',
  weapon_shield: 'Guardian',
  dual_wield: 'Twin',
  two_handed: 'Heavy',
};

export const WEAPON_CODENAMES: Record<string, string> = {
  // Budget Melee
  'Practice Sword': 'Rusty',
  'Combat Knife': 'Fang',
  'War Club': 'Brute',
  // Budget Ballistic
  'Practice Blaster': 'Spark',
  'Machine Pistol': 'Rattler',
  'Bolt Carbine': 'Striker',
  'Scatter Cannon': 'Shrapnel',
  // Budget Energy
  'Laser Pistol': 'Glint',
  'Beam Pistol': 'Radiant',
  'Training Beam': 'Drill',
  'Training Rifle': 'Cadet',
  // Budget Shields
  'Light Shield': 'Buckler',
  'Combat Shield': 'Rampart',
  'Reactive Shield': 'Reflex',
  // Mid Melee
  'Energy Blade': 'Arc',
  'Plasma Blade': 'Sear',
  'Shock Maul': 'Jolt',
  // Mid Ballistic
  'Machine Gun': 'Hailstorm',
  'Burst Rifle': 'Salvo',
  'Mortar System': 'Barrage',
  'Siege Cannon': 'Ramrod',
  // Mid Energy
  'Flux Repeater': 'Pulse',
  'Photon Marksman': 'Glimmer',
  'Pulse Accelerator': 'Surge',
  // Mid Shield
  'Barrier Shield': 'Bastion',
  // Premium Melee
  'Power Sword': 'Sovereign',
  'Thermal Lance': 'Inferno',
  // Premium Ballistic
  'Assault Rifle': 'Viper',
  'Shotgun': 'Thunder',
  'Grenade Launcher': 'Havoc',
  'Sniper Rifle': 'Hawkeye',
  'Gauss Pistol': 'Comet',
  // Premium Energy
  'Plasma Rifle': 'Nova',
  'Laser Rifle': 'Prism',
  'Disruptor Cannon': 'Rift',
  // Premium Shield
  'Fortress Shield': 'Citadel',
  // Luxury Melee
  'Battle Axe': 'Cleaver',
  'Heavy Hammer': 'Anvil',
  'Vibro Mace': 'Tremor',
  // Luxury Ballistic
  'Railgun': 'Meteor',
  // Luxury Energy
  'Plasma Cannon': 'Supernova',
  'Ion Beam': 'Torrent',
  'Volt Sabre': 'Tempest',
  'Arc Projector': 'Tesla',
  'Nova Caster': 'Flare',
  'Particle Lance': 'Spectre',
  // Luxury Shield
  'Aegis Bulwark': 'Monolith',
};

export const STABLE_ADJECTIVES = [
  'Iron', 'Steel', 'Shadow', 'Crimson', 'Thunder',
  'Obsidian', 'Phantom', 'Cobalt', 'Titan', 'Ember',
  'Frost', 'Onyx', 'Venom', 'Storm', 'Apex',
  'Rogue', 'Neon', 'Blaze', 'Void', 'Chrome',
  'Granite', 'Copper', 'Midnight', 'Scarlet', 'Tungsten',
  'Orbital', 'Zenith', 'Polar', 'Molten', 'Carbon',
  'Quantum', 'Plasma', 'Cipher', 'Vertex', 'Primal',
  'Astral', 'Boreal', 'Ferric', 'Argent', 'Pyro',
] as const;

export const STABLE_NOUNS = [
  'Industries', 'Dynamics', 'Robotics', 'Engineering', 'Systems',
  'Mechanics', 'Corp', 'Enterprises', 'Labs', 'Foundry',
  'Works', 'Motors', 'Armaments', 'Solutions', 'Technologies',
  'Syndicate', 'Collective', 'Group', 'Alliance', 'Forge',
  'Unlimited', 'Ventures', 'Holdings', 'Fabrication', 'Machina',
  'Kinetics', 'Logistics', 'Designs', 'Innovations', 'Automata',
  'Constructs', 'Division', 'Ordinance', 'Propulsion', 'Aeronautics',
  'Precision', 'Manufacturing', 'Tactical', 'Operations', 'Consortium',
] as const;

export interface TieredGenerationResult {
  usersCreated: number;
  robotsCreated: number;
  tagTeamsCreated: number;
  league2v2TeamsCreated: number;
  league3v3TeamsCreated: number;
  usernames: string[];
  tierBreakdown: {
    wimpBot: number;
    averageBot: number;
    expertBot: number;
  };
}

/**
 * Distributes n users across three tiers (WimpBot, AverageBot, ExpertBot).
 * Uses integer division by 3 with remainder allocated WimpBot-first,
 * then AverageBot, then ExpertBot.
 */
export function distributeTiers(n: number): { wimpBot: number; averageBot: number; expertBot: number } {
  const base = Math.floor(n / 3);
  const remainder = n % 3;

  return {
    wimpBot: base + (remainder >= 1 ? 1 : 0),
    averageBot: base + (remainder >= 2 ? 1 : 0),
    expertBot: base,
  };
}
