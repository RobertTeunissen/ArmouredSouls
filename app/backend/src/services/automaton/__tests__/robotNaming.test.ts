import { ROBOT_NAME_MAX_LENGTH, chooseRobotName, robotNameCandidates } from '../robotNaming';

describe('robotNaming (R3.9, design §9.2)', () => {
  it('tries the blueprint name, then Mk II to Mk X', () => {
    expect(robotNameCandidates('Rex')).toEqual([
      'Rex', 'Rex Mk II', 'Rex Mk III', 'Rex Mk IV', 'Rex Mk V',
      'Rex Mk VI', 'Rex Mk VII', 'Rex Mk VIII', 'Rex Mk IX', 'Rex Mk X',
    ]);
  });

  it('uses the blueprint name when it is free', () => {
    expect(chooseRobotName('CT-7567 Rex', new Set(['Cody']))).toBe('CT-7567 Rex');
  });

  it('takes the first free Mk suffix', () => {
    expect(chooseRobotName('Rex', new Set(['Rex', 'Rex Mk II']))).toBe('Rex Mk III');
  });

  it('returns null when every candidate is taken', () => {
    expect(chooseRobotName('Rex', new Set(robotNameCandidates('Rex')))).toBeNull();
  });

  it('trims the base so every candidate fits 50 characters', () => {
    const name = 'A'.repeat(50);
    const candidates = robotNameCandidates(name);
    expect(candidates[0]).toBe(name);
    for (const candidate of candidates) expect(candidate.length).toBeLessThanOrEqual(ROBOT_NAME_MAX_LENGTH);
    expect(candidates[1]).toBe(`${'A'.repeat(44)} Mk II`);
    expect(candidates[7]).toBe(`${'A'.repeat(42)} Mk VIII`);
    expect(chooseRobotName(name, new Set([name]))).toHaveLength(50);
  });

  it('does not leave a double space when the trim cuts at a space', () => {
    const name = `${'B'.repeat(43)} ${'C'.repeat(6)}`; // 50 characters, space at index 43
    expect(robotNameCandidates(name)[1]).toBe(`${'B'.repeat(43)} Mk II`);
  });
});
