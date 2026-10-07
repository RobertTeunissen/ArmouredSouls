/**
 * `validateRegistrationRequest().invalidFields` is what the register route logs
 * instead of the error messages (CodeQL js/clear-text-logging: the messages are
 * derived from the password check). It must name exactly the failing fields
 * and never carry submitted values.
 */
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

import { RegistrationRequest, validateRegistrationRequest } from '../../src/utils/validation';

const VALID: RegistrationRequest = {
  username: 'validuser',
  email: 'player@mail.com',
  password: 'longEnough1',
  stableName: 'Valid Stable',
};

describe('validateRegistrationRequest invalidFields', () => {
  test('is empty for a valid request', () => {
    const result = validateRegistrationRequest(VALID);
    expect(result.isValid).toBe(true);
    expect(result.invalidFields).toEqual([]);
  });

  test('reports only "required" when a field is missing', () => {
    const result = validateRegistrationRequest({ ...VALID, password: '' });
    expect(result.isValid).toBe(false);
    expect(result.invalidFields).toEqual(['required']);
  });

  test.each([
    ['username', { username: 'ab' }],
    ['email', { email: 'x' }],
    ['password', { password: 'short' }],
  ] as const)('names %s when only that field is invalid', (field, override) => {
    const result = validateRegistrationRequest({ ...VALID, ...override });
    expect(result.isValid).toBe(false);
    expect(result.invalidFields).toEqual([field]);
  });

  test('lists every failing field in validation order', () => {
    const result = validateRegistrationRequest({ ...VALID, username: 'ab', email: 'x', password: '1234567' });
    expect(result.invalidFields).toEqual(['username', 'email', 'password']);
    expect(result.errors).toHaveLength(3);
  });

  test('never contains the submitted values', () => {
    const request = { username: 'ab', email: 'x', password: 'secret1', stableName: 'Valid Stable' };
    const serialized = JSON.stringify(validateRegistrationRequest(request).invalidFields);
    expect(serialized).not.toContain(request.password);
    expect(serialized).not.toContain(request.email);
  });
});
