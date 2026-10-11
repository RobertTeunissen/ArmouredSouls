/**
 * Robot names for Automaton robots (Spec #55, R3.9, design §9.2).
 *
 * Slot s is named after its blueprint. When that name is taken anywhere in
 * the game, "{name} Mk II" … "{name} Mk X" are tried, trimming the base so
 * the result fits the 50-character robot-name limit of `validateRobotName`.
 */

/** Robot-name length limit enforced by `validateRobotName`. */
export const ROBOT_NAME_MAX_LENGTH = 50;

const MARK_SUFFIXES = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

/** The base name trimmed (both ends) to at most `maxLength` characters. */
function fitBase(base: string, maxLength: number): string {
  return base.trim().slice(0, maxLength).trimEnd();
}

/**
 * Candidate names in the order they are tried: the blueprint name, then
 * "Mk II" to "Mk X". Every candidate has at most 50 characters.
 */
export function robotNameCandidates(blueprintName: string): string[] {
  const candidates = [fitBase(blueprintName, ROBOT_NAME_MAX_LENGTH)];
  for (const mark of MARK_SUFFIXES) {
    const suffix = ` Mk ${mark}`;
    candidates.push(`${fitBase(blueprintName, ROBOT_NAME_MAX_LENGTH - suffix.length)}${suffix}`);
  }
  return candidates;
}

/**
 * The first candidate not in `takenNames`, or null when every candidate is
 * taken (the Robot_Chain is then Blocked with `name_unavailable`).
 */
export function chooseRobotName(blueprintName: string, takenNames: ReadonlySet<string>): string | null {
  return robotNameCandidates(blueprintName).find((name) => !takenNames.has(name)) ?? null;
}
