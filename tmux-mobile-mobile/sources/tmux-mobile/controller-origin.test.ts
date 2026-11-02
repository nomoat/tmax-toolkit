import { describe, expect, it } from 'vitest';
import { migrateControllerOrigin, migrateControllerSession } from './controller-origin';
describe('production domain migration', () => {
  it('keeps the session token and account when migrating a saved login', () => {
    const old = { baseUrl: 'https://eng.impo.ai', sessionToken: 'existing-token', expiresAt: '2030-01-01', user: { email: 'user@example.com' } };
    const next = migrateControllerSession(old);
    expect(next).toEqual({ ...old, baseUrl: 'https://eng.xyznot.com' });
    expect(old.baseUrl).toBe('https://eng.impo.ai');
    expect(migrateControllerSession(next)).toBe(next);
  });
  it('does not send custom-server credentials to production', () => {
    for (const baseUrl of ['https://custom.example', 'http://localhost:3737', 'https://eng.impo.ai.other.example', 'https://eng.impo.ai:8443']) {
      const session = { baseUrl, sessionToken: 'private' };
      expect(migrateControllerSession(session)).toBe(session);
      expect(migrateControllerOrigin(baseUrl)).toBe(baseUrl);
    }
  });
});
