/**
 * A stable's kind (`User.stableType`): `human` players, `generated` bots
 * (deleted at season rollover) and persistent computer-run `automaton`
 * stables. Responses carry it so the Automaton_Badge can render.
 */
export type StableType = 'human' | 'generated' | 'automaton';
