import { STABLE_ADJECTIVES, STABLE_NOUNS } from './tierConfig';

/**
 * Generates a unique stable name by combining a random adjective and noun
 * from the enterprise-themed word lists. If the name already exists in
 * existingNames, appends an incrementing numeric suffix (e.g., "Iron Forge 2").
 */
export function generateStableName(existingNames: Set<string>): string {
  const adjective = STABLE_ADJECTIVES[Math.floor(Math.random() * STABLE_ADJECTIVES.length)];
  const noun = STABLE_NOUNS[Math.floor(Math.random() * STABLE_NOUNS.length)];
  const baseName = `${adjective} ${noun}`;

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (existingNames.has(`${baseName} ${suffix}`)) {
    suffix++;
  }

  return `${baseName} ${suffix}`;
}
