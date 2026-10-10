/**
 * Unit and property tests for the whole-word stable-name profanity filter.
 *
 * Covers the three matching rules documented on `containsProfanity`:
 * whole letter runs, camelCase/PascalCase parts, and the compound substring
 * rule limited to `COMPOUND_MATCH_ENTRIES`.
 *
 * Requirements: 1.7
 */
import * as fc from 'fast-check';
import { containsProfanity, PROFANITY_LIST, COMPOUND_MATCH_ENTRIES } from '../profanityFilter';

/** Upper-case the first letter: "ass" → "Ass". */
const cap = (word: string): string => word[0].toUpperCase() + word.slice(1);

describe('containsProfanity', () => {
  describe('ordinary words that contain a list entry are allowed', () => {
    test.each([
      'Glass Cannon',
      'GlassCannon',
      'Assembly Line',
      'Shell Corp',
      'Bass Drop',
      'Scunthorpe Steel',
      'Classic',
      'Passion',
      'Hello',
      'AssassinClan',
      'Cockpit Crew',
      'Peacock Squad',
      'Grape Shot',
      'Scrap Heap',
      'Dickens Works',
      'Hellhound',
      // PascalCase junctions that spell a compound entry across the word boundary.
      'OrbitChaos',
      'BitChassis',
      'RabbitChase',
      'WhoReigns',
      'TheOnesWhoRemain',
    ])('%s is not flagged', (name) => {
      expect(containsProfanity(name)).toBe(false);
    });

    // Witnesses for the entries excluded from COMPOUND_MATCH_ENTRIES: each is a
    // substring of a common English word, so it is matched as a whole word only.
    test.each([
      ['Flame Retardant', 'retard'],
      ['Pussycat', 'pussy'],
      ['Snigger', 'nigger'],
      ['Niggardly', 'nigga'],
    ])('%s is not flagged (why "%s" has no compound match)', (name) => {
      expect(containsProfanity(name)).toBe(false);
    });
  });

  describe('existing clean names stay clean', () => {
    test.each(['GoodName', 'MyStable', 'RobotWarrior', 'Champion2024', 'Elite_Squad', 'Thunder-Strike'])(
      '%s is not flagged',
      (name) => {
        expect(containsProfanity(name)).toBe(false);
      },
    );
  });

  describe('rule 1: a list entry on its own, in any case', () => {
    test.each(PROFANITY_LIST)('%s', (entry) => {
      expect(containsProfanity(entry)).toBe(true);
      expect(containsProfanity(entry.toUpperCase())).toBe(true);
      expect(containsProfanity(cap(entry))).toBe(true);
    });

    test('mixed case is caught through the whole run', () => {
      expect(containsProfanity('ShIt')).toBe(true);
    });
  });

  describe('rule 1: a list entry between separators', () => {
    test.each(PROFANITY_LIST)('%s', (entry) => {
      expect(containsProfanity(`Big ${entry}`)).toBe(true);
      expect(containsProfanity(`Big_${entry}`)).toBe(true);
      expect(containsProfanity(`big-${entry}`)).toBe(true);
      expect(containsProfanity(`${entry}123`)).toBe(true);
      expect(containsProfanity(`7${entry}7`)).toBe(true);
      expect(containsProfanity(`${cap(entry)}!`)).toBe(true);
    });

    test.each(['Big_Ass', 'big-ass'])('%s is flagged', (name) => {
      expect(containsProfanity(name)).toBe(true);
    });
  });

  describe('rule 2: a list entry as a camelCase/PascalCase part', () => {
    test.each(PROFANITY_LIST)('%s', (entry) => {
      expect(containsProfanity(`Big${cap(entry)}`)).toBe(true);
      expect(containsProfanity(`${cap(entry)}Bot`)).toBe(true);
      expect(containsProfanity(`${entry.toUpperCase()}Bot`)).toBe(true);
    });

    test.each(['BigAss', 'AssHole123', 'ASSHole', 'BadShitName'])('%s is flagged', (name) => {
      expect(containsProfanity(name)).toBe(true);
    });

    // An upper-case entry glued to a lower-case tail: the camelCase split alone
    // would give "SHI" + "Tbot", so the upper-case run is checked as well.
    test.each(PROFANITY_LIST)('%s in upper case glued to a lower-case tail', (entry) => {
      expect(containsProfanity(`${entry.toUpperCase()}bot`)).toBe(true);
      expect(containsProfanity(`My${entry.toUpperCase()}bot`)).toBe(true);
    });

    test.each(['SHITbot', 'ASSface', 'FUCKyou'])('%s is flagged', (name) => {
      expect(containsProfanity(name)).toBe(true);
    });
  });

  describe('rule 3: compound substring match for long, unambiguous entries', () => {
    test.each(COMPOUND_MATCH_ENTRIES)('%s is caught inside a compound', (entry) => {
      expect(containsProfanity(`big${entry}bot`)).toBe(true);
      expect(containsProfanity(`BIG${entry.toUpperCase()}BOT`)).toBe(true);
      expect(containsProfanity(`${entry}s`)).toBe(true);
    });

    test.each(['bitches', 'BigBitchyBot', 'bigbastard', 'BIGBITCHBOT', 'MyBASTARDbot', 'orbitchaos'])(
      '%s is flagged',
      (name) => {
        expect(containsProfanity(name)).toBe(true);
      },
    );

    // Rule 3 runs per segment split at lower→upper boundaries, so a compound
    // entry spelled across a PascalCase word junction is not matched.
    test.each(['OrbitChaos', 'BitChassis', 'WhoReigns'])('%s is not flagged', (name) => {
      expect(containsProfanity(name)).toBe(false);
    });

    // A single-case run has no boundary marker, so ALL-CAPS behaves exactly
    // like all-lower: the junction is not visible and the compound is caught.
    test.each([
      ['orbitchaos', 'ORBITCHAOS'],
      ['whoreigns', 'WHOREIGNS'],
      ['bitchassis', 'BITCHASSIS'],
    ])('%s and %s are treated the same', (lower, upper) => {
      expect(containsProfanity(lower)).toBe(true);
      expect(containsProfanity(upper)).toBe(containsProfanity(lower));
    });

    // Documented trade-off: random-case gluing is not caught inside a compound,
    // but the standalone word in any case still is (rule 1).
    test('random-case gluing is the accepted trade-off', () => {
      expect(containsProfanity('xBiTcHx')).toBe(false);
      expect(containsProfanity('BiTcH')).toBe(true);
    });

    // Documented gap (rule 3 of the JSDoc): other entries are not matched inside
    // a lower-case or ALL-CAPS compound without a separator or camelCase boundary.
    test.each(PROFANITY_LIST.filter((entry) => !COMPOUND_MATCH_ENTRIES.includes(entry)))(
      '%s is not caught inside a lower-case compound',
      (entry) => {
        expect(containsProfanity(`big${entry}bot`)).toBe(false);
      },
    );

    test.each(['bigshitbot', 'fuckingbot', 'bigassbot'])('%s is not flagged', (name) => {
      expect(containsProfanity(name)).toBe(false);
    });
  });

  describe('inflected and derived forms are listed explicitly', () => {
    // Forms the whole-token matcher would miss if only the base word were listed.
    const INFLECTED_FORMS = [
      'fucking',
      'fucker',
      'motherfucker',
      'motherfuckers',
      'shitty',
      'bullshit',
      'horseshit',
      'dipshit',
      'shithead',
      'bigass',
      'dumbass',
      'jackass',
      'asshole',
      'assholes',
      'damnit',
      'dammit',
      'goddamn',
      'faggot',
      'nazis',
      'retarded',
      'niggers',
      'niggas',
    ];

    test.each(INFLECTED_FORMS)('%s is a list entry', (form) => {
      expect(PROFANITY_LIST).toContain(form);
    });

    test.each(INFLECTED_FORMS)('%s is flagged standalone, with separators and in camelCase', (form) => {
      expect(containsProfanity(form)).toBe(true);
      expect(containsProfanity(form.toUpperCase())).toBe(true);
      expect(containsProfanity(cap(form))).toBe(true);
      expect(containsProfanity(`Big ${cap(form)}`)).toBe(true);
      expect(containsProfanity(`Big_${form}`)).toBe(true);
      expect(containsProfanity(`${form}-bot`)).toBe(true);
      expect(containsProfanity(`${cap(form)}Bot`)).toBe(true);
      expect(containsProfanity(`My${cap(form)}`)).toBe(true);
    });

    test.each(['Fucking Robots', 'Big_Bullshit', 'ShittyBot', 'BadShittyName', 'TheMotherfuckers', 'Nazis-United'])(
      '%s is flagged',
      (name) => {
        expect(containsProfanity(name)).toBe(true);
      },
    );

    // Innocent words that resemble a listed form, plus forms skipped on purpose
    // because they have a common innocent meaning.
    test.each([
      'Shitake',
      'Shiitake Farm',
      'Bassist',
      'Classes',
      'Masses',
      'Assessor',
      'Passes',
      'Grasshopper',
      'Cocktail',
      'Cockerel',
      'Cocky Bot',
      'Half Cocked',
      'Craps Table',
      'Damning Evidence',
      'Rapeseed Oil',
      'Hellish',
      'Dickens Works',
    ])('%s is not flagged', (name) => {
      expect(containsProfanity(name)).toBe(false);
    });
  });

  describe('list invariants', () => {
    test('every list entry is lower-case letters only', () => {
      for (const entry of PROFANITY_LIST) {
        expect(entry).toMatch(/^[a-z]+$/);
      }
    });

    test('every compound entry is a list entry of at least 5 letters', () => {
      for (const entry of COMPOUND_MATCH_ENTRIES) {
        expect(PROFANITY_LIST).toContain(entry);
        expect(entry.length).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe('properties', () => {
    // Ordinary words, several of which contain a list entry as a substring.
    const SAFE_WORDS = [
      'glass',
      'cannon',
      'assembly',
      'line',
      'shell',
      'corp',
      'bass',
      'drop',
      'scunthorpe',
      'steel',
      'classic',
      'passion',
      'hello',
      'assassin',
      'iron',
      'titan',
      'grape',
      'scrap',
      'cockpit',
      'hellhound',
    ];

    // Whole-word casing only. Per-character random casing would be wrong here:
    // "clASS" splits into "cl" + "ASS", which is a legitimate camelCase match.
    const style = fc.constantFrom<(word: string) => string>(
      (word) => word,
      (word) => word.toUpperCase(),
      cap,
    );
    const sep = fc.constantFrom(' ', '_', '-', '1', '42');
    const styled = (words: fc.Arbitrary<string>): fc.Arbitrary<string> =>
      fc.tuple(words, style).map(([word, applyStyle]) => applyStyle(word));
    const safeWord = styled(fc.constantFrom(...SAFE_WORDS));
    const listWord = styled(fc.constantFrom(...PROFANITY_LIST));

    /** Join tokens, putting a separator after each one. */
    const joinWith = (tokens: string[], seps: string[]): string =>
      tokens.map((token, i) => token + seps[i % seps.length]).join('');

    test('P1: safe words joined by separators are never flagged', () => {
      fc.assert(
        fc.property(
          fc.array(safeWord, { minLength: 1, maxLength: 4 }),
          fc.array(sep, { minLength: 1, maxLength: 4 }),
          (tokens, seps) => !containsProfanity(joinWith(tokens, seps)),
        ),
      );
    });

    test('P2: a list entry between separators is always flagged', () => {
      fc.assert(
        fc.property(
          fc.array(safeWord, { minLength: 0, maxLength: 3 }),
          listWord,
          fc.nat(),
          fc.array(sep, { minLength: 1, maxLength: 4 }),
          (tokens, entry, index, seps) => {
            const withEntry = [...tokens];
            withEntry.splice(index % (tokens.length + 1), 0, entry);
            return containsProfanity(joinWith(withEntry, seps));
          },
        ),
      );
    });

    test('P3: a list entry glued in PascalCase to a safe word is always flagged', () => {
      fc.assert(
        fc.property(fc.constantFrom(...SAFE_WORDS), fc.constantFrom(...PROFANITY_LIST), (safe, entry) => {
          return containsProfanity(cap(safe) + cap(entry)) && containsProfanity(cap(entry) + cap(safe));
        }),
      );
    });
  });
});
