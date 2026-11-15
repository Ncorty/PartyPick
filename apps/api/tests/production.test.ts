import { afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';

afterEach(() => vi.unstubAllEnvs());

it('rejects incomplete production configuration without opening PGlite', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('DATABASE_HOST', '');
  expect(() => buildApp({ publicOrigin: 'http://example.com' })).toThrow(
    'PUBLIC_ORIGIN must be an exact HTTPS origin',
  );
  expect(() => buildApp({ publicOrigin: 'https://example.com/path' })).toThrow(
    'PUBLIC_ORIGIN must be an exact HTTPS origin',
  );
  expect(() =>
    buildApp({
      publicOrigin: 'https://example.com',
      trustedProxy: '172.30.77.2',
    }),
  ).toThrow('PostgreSQL is required in production');
  expect(() =>
    buildApp({
      publicOrigin: 'https://example.com',
      databaseUrl: 'postgres://db',
    }),
  ).toThrow('TRUSTED_PROXY must be one exact proxy IP in production');
});

it('compares mutation Origin with the raw Host, including the public port', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const database = await openDatabase('memory://');
  const app = buildApp({
    database,
    publicOrigin: 'https://partypick.example:8443',
    trustedProxy: '172.30.77.2',
    logger: false,
  });
  try {
    const wrongHost = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: {
        origin: 'https://partypick.example:8443',
        host: 'partypick.example',
        'x-forwarded-host': 'partypick.example:8443',
      },
    });
    expect(wrongHost.statusCode).toBe(403);
    const wrongOrigin = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: {
        origin: 'https://attacker.example',
        host: 'partypick.example:8443',
      },
    });
    expect(wrongOrigin.statusCode).toBe(403);
  } finally {
    await app.close();
    await database.close();
  }
});
