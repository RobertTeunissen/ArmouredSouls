/**
 * Unit tests for updateUserProfile (moved out of routes/user.ts). The
 * database-backed behaviour is also covered end to end by
 * tests/profileUpdate*.test.ts in the integration tier.
 */

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCompare = jest.fn();
const mockHash = jest.fn();
const mockIsUnique = jest.fn();
const mockToken = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: (...a: unknown[]) => mockFindUnique(...a), update: (...a: unknown[]) => mockUpdate(...a) } },
}));
jest.mock('bcrypt', () => ({ compare: (...a: unknown[]) => mockCompare(...a) }));
jest.mock('../passwordService', () => ({ hashPassword: (...a: unknown[]) => mockHash(...a) }));
jest.mock('../jwtService', () => ({ generateToken: (...a: unknown[]) => mockToken(...a) }));
jest.mock('../../../utils/validation', () => {
  const actual = jest.requireActual('../../../utils/validation');
  return { ...actual, isStableNameUnique: (...a: unknown[]) => mockIsUnique(...a) };
});

import { updateUserProfile } from '../profileUpdateService';

const updatedRow = {
  id: 7,
  username: 'pilot',
  email: null,
  role: 'user',
  currency: 1000,
  prestige: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  stableName: null as string | null,
  profileVisibility: 'public',
  notificationsBattle: true,
  notificationsLeague: true,
  themePreference: 'dark',
  tokenVersion: 3,
};

describe('updateUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue(updatedRow);
    mockIsUnique.mockResolvedValue(true);
    mockToken.mockReturnValue('new-token');
  });

  it('updates preferences and falls back to the username as stable name', async () => {
    const result = await updateUserProfile(7, { profileVisibility: 'private', notificationsBattle: false, themePreference: 'light' });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: { profileVisibility: 'private', notificationsBattle: false, themePreference: 'light' },
    }));
    expect(result.stableName).toBe('pilot');
    expect(result).not.toHaveProperty('token');
  });

  it('trims the stable name and rejects a taken one with 409', async () => {
    await updateUserProfile(7, { stableName: '  Iron Wolves  ' });
    expect(mockUpdate.mock.calls[0][0].data).toEqual({ stableName: 'Iron Wolves' });

    mockIsUnique.mockResolvedValue(false);
    await expect(updateUserProfile(7, { stableName: 'Iron Wolves' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_STABLE_NAME',
    });
  });

  it('rejects an empty update', async () => {
    await expect(updateUserProfile(7, {})).rejects.toMatchObject({ statusCode: 400, message: 'No updates provided' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('reports field errors in the shared VALIDATION_ERROR shape', async () => {
    await expect(updateUserProfile(7, { newPassword: 'Abcdefg1' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Current password is required to change password',
      details: { fields: [{ field: 'currentPassword', message: 'Current password is required to change password' }] },
    });
  });

  it('rejects a wrong current password with 401 and changes nothing', async () => {
    mockFindUnique.mockResolvedValue({ passwordHash: 'stored' });
    mockCompare.mockResolvedValue(false);
    await expect(updateUserProfile(7, { currentPassword: 'wrong', newPassword: 'Abcdefg1' })).rejects.toMatchObject({ statusCode: 401 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a weak new password', async () => {
    mockFindUnique.mockResolvedValue({ passwordHash: 'stored' });
    mockCompare.mockResolvedValue(true);
    await expect(updateUserProfile(7, { currentPassword: 'right', newPassword: 'alllowercase' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(mockHash).not.toHaveBeenCalled();
  });

  it('changes the password, bumps tokenVersion and returns a fresh token', async () => {
    mockFindUnique.mockResolvedValue({ passwordHash: 'stored' });
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue('hashed');

    const result = await updateUserProfile(7, { currentPassword: 'right', newPassword: 'Abcdefg1' });

    expect(mockUpdate.mock.calls[0][0].data).toEqual({ passwordHash: 'hashed', tokenVersion: { increment: 1 } });
    expect(mockToken).toHaveBeenCalledWith({ id: '7', username: 'pilot', role: 'user', tokenVersion: 3 });
    expect(result.token).toBe('new-token');
  });

  it('is a 404 when the user no longer exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(updateUserProfile(7, { currentPassword: 'x', newPassword: 'Abcdefg1' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
