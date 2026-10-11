/**
 * Program_Switch (Spec #55 task 6.1; R2.7, R2.8).
 */
import { getProgramSwitch, isProgramEnabled, setProgramSwitch } from '../programSwitch';
import { fakeDb, resetFakeDb } from './helpers/fakeTurnDb';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: jest.requireActual('./helpers/fakeTurnDb').fakePrisma,
}));

beforeEach(() => resetFakeDb());

describe('programSwitch', () => {
  it('defaults to on', async () => {
    expect(await isProgramEnabled()).toBe(true);
  });

  it('creates the settings row with the default when it is missing', async () => {
    fakeDb.settings = null;
    expect(await getProgramSwitch()).toMatchObject({ turnsEnabled: true, updatedByUserId: null });
    expect(fakeDb.settings).not.toBeNull();
  });

  it('returns the old and new value and records the admin', async () => {
    expect(await setProgramSwitch(false, 7)).toMatchObject({ previous: true, current: false });
    expect(await isProgramEnabled()).toBe(false);
    expect(await getProgramSwitch()).toMatchObject({ turnsEnabled: false, updatedByUserId: 7 });
    expect(await setProgramSwitch(false, 8)).toMatchObject({ previous: false, current: false });
    expect(await setProgramSwitch(true, 8)).toMatchObject({ previous: false, current: true });
  });

  it('a read never changes updatedAt', async () => {
    const before = fakeDb.settings?.updatedAt;
    await getProgramSwitch();
    await isProgramEnabled();
    expect(fakeDb.settings?.updatedAt).toBe(before);
  });
});
