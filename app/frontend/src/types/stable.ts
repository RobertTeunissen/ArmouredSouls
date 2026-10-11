/**
 * Stable_Type of an owning stable (Spec #55 R1.7), mirroring the backend
 * `StableType` enum. Public responses carry it wherever an owning stable is
 * rendered; the Automaton_Badge shows only for `automaton`.
 */
export type StableType = 'human' | 'generated' | 'automaton';
