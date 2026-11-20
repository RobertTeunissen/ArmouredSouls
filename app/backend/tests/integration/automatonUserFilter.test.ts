/**
 * Spec #55 task 1.6 (R1.6) — admin user filter results against the database.
 *
 * `automaton` returns exactly the users with stableType = automaton; `real`
 * excludes them in addition to its current exclusions; `auto` and `all` keep
 * their current results. Each query is scoped to this file's fixture users so
 * other rows in the shared database do not affect the counts.
 */
import prisma from '../../src/lib/prisma';
import { realUserFilter } from '../../src/utils/realUserFilter';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

describe('realUserFilter against the database (Spec #55 R1.6)', () => {
  const ids: Record<'human' | 'automaton' | 'bot' | 'system', number> = { human: 0, automaton: 0, bot: 0, system: 0 };

  beforeAll(async () => {
    const create = (username: string, stableType: 'human' | 'generated' | 'automaton', isGenerated: boolean) =>
      prisma.user.create({ data: { username, passwordHash: 'x', stableType, isGenerated } });
    ids.human = (await create(`uf_human_${suffix}`, 'human', false)).id;
    ids.automaton = (await create(`automaton_uf_${suffix}`, 'automaton', false)).id;
    ids.bot = (await create(`auto_wimpbot_uf_${suffix}`, 'generated', true)).id;
    ids.system = (await create(`test_user_uf_${suffix}`, 'human', false)).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  async function matching(): Promise<number[]> {
    const rows = await prisma.user.findMany({
      where: { AND: [realUserFilter(), { id: { in: Object.values(ids) } }] },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  it('real excludes Automaton_Stables, bots and system accounts', async () => {
    expect(await matching()).toEqual([ids.human]);
  });

});
