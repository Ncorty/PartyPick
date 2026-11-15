import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { expect, test } from '@playwright/test';

const origin = 'https://localhost:8443';
const headers = { origin };

test('production proxy, PostgreSQL and recovery support two guests', async ({
  page,
  browser,
}) => {
  const ready = await page.request.get('/api/health');
  expect(ready.status()).toBe(200);

  const spa = await page.request.get('/create');
  expect(spa.status()).toBe(200);
  expect(spa.headers()['content-type']).toContain('text/html');
  const missingAsset = await page.request.get('/assets/not-found.js');
  expect(missingAsset.status()).toBe(404);
  expect(missingAsset.headers()['content-type'] ?? '').not.toContain(
    'text/html',
  );
  const missingApi = await page.request.get('/api/not-found');
  expect(missingApi.status()).toBe(404);
  expect(missingApi.headers()['content-type'] ?? '').not.toContain('text/html');

  const html = await spa.text();
  const hashedAsset = html.match(
    /\/assets\/[^"']+-[A-Za-z0-9_-]{8,}\.[^"']+/,
  )?.[0];
  expect(hashedAsset).toBeTruthy();
  const asset = await page.request.get(hashedAsset!);
  expect(asset.status()).toBe(200);
  expect(asset.headers()['cache-control']).toContain('immutable');

  const session = await page.request.post('/api/guest-session', { headers });
  expect(session.status()).toBe(200);
  const cookie = session.headers()['set-cookie'];
  expect(cookie).toMatch(/\bSecure\b/i);
  expect(cookie).toMatch(/\bHttpOnly\b/i);
  expect(cookie).toMatch(/SameSite=Lax/i);

  const wrongOrigin = await page.request.post('/api/rooms', {
    headers: { origin: 'https://attacker.invalid' },
    data: { displayName: 'X', title: 'X', maxMembers: 2 },
  });
  expect(wrongOrigin.status()).toBe(403);
  const wrongHostStatus = await new Promise<number>((resolve, reject) => {
    // Keep TLS SNI on localhost while sending a different HTTP Host.
    const probe = httpsRequest(
      `${origin}/api/rooms`,
      {
        method: 'POST',
        servername: 'localhost',
        rejectUnauthorized: false,
        headers: {
          host: 'attacker.invalid',
          origin,
          'content-type': 'application/json',
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    probe.on('error', reject);
    probe.end('{}');
  });
  expect(wrongHostStatus).toBeGreaterThanOrEqual(400);
  expect(wrongHostStatus).toBeLessThan(500);

  const catalog = await (await page.request.get('/api/catalog')).json();
  const game = catalog.find(
    (entry: { name: string }) => entry.name === 'Deep Rock Galactic',
  );
  expect(game).toBeTruthy();
  const library = await page.request.patch('/api/me/library', {
    headers,
    data: {
      version: 0,
      changes: [{ gameId: game.id, availability: 'installed' }],
    },
  });
  expect(library.status()).toBe(200);

  const created = await page.request.post('/api/rooms', {
    headers,
    data: { displayName: 'Ведущий', title: 'Проверка VPS', maxMembers: 2 },
  });
  expect(created.status()).toBe(201);
  const room = await created.json();
  await page.goto(`/rooms/${room.id}`);
  await expect(
    page.getByRole('heading', { name: 'Проверка VPS' }),
  ).toBeVisible();

  const guestContext = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  try {
    const guest = await guestContext.newPage();
    await guest.goto(room.invitePath);
    await expect(
      guest.getByRole('button', { name: 'Войти в комнату' }),
    ).toBeVisible();
    const joined = await guestContext.request.post(
      `/api/invites/${room.invitePath.split('/').pop()}/join`,
      { headers, data: { displayName: 'Друг' } },
    );
    expect(joined.status()).toBe(200);
    const joinedRoom = await joined.json();
    const preferences = {
      availableMinutes: 120,
      mode: 'any',
      games: [{ gameId: game.id, owned: true, installed: true, taste: 'want' }],
    };

    // Both writers race on the same room version against real row locks.
    const attempts = await Promise.all([
      page.request.put(`/api/rooms/${room.id}/preferences`, {
        headers,
        data: { version: joinedRoom.version, preferences },
      }),
      guestContext.request.put(`/api/rooms/${room.id}/preferences`, {
        headers,
        data: { version: joinedRoom.version, preferences },
      }),
    ]);
    expect(attempts.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    const winner = await attempts
      .find((response) => response.status() === 200)!
      .json();
    const retry = await (
      attempts[0].status() === 409 ? page.request : guestContext.request
    ).put(`/api/rooms/${room.id}/preferences`, {
      headers,
      data: { version: winner.version, preferences },
    });
    expect(retry.status()).toBe(200);
    const answered = await retry.json();

    const voting = await page.request.post(`/api/rooms/${room.id}/voting`, {
      headers,
      data: { version: answered.version },
    });
    expect(voting.status()).toBe(200);
    const active = await voting.json();
    const hostVote = await page.request.put(`/api/rooms/${room.id}/vote`, {
      headers,
      data: { version: active.version, round: active.round, gameId: game.id },
    });
    expect(hostVote.status()).toBe(200);
    const afterHostVote = await hostVote.json();
    const guestVote = await guestContext.request.put(
      `/api/rooms/${room.id}/vote`,
      {
        headers,
        data: {
          version: afterHostVote.version,
          round: active.round,
          gameId: game.id,
        },
      },
    );
    expect(guestVote.status()).toBe(200);
    const afterGuestVote = await guestVote.json();
    const final = await page.request.post(`/api/rooms/${room.id}/finalize`, {
      headers,
      data: { version: afterGuestVote.version, round: active.round },
    });
    expect(final.status()).toBe(200);
    expect((await final.json()).winnerGameId).toBe(game.id);

    await guest.goto(`/rooms/${room.id}`);
    await expect(
      guest.getByRole('heading', { name: 'Проверка VPS' }),
    ).toBeVisible();
    await page.goto('/library');
    await expect(
      page.getByRole('combobox', {
        name: 'Deep Rock Galactic: доступ и установка',
      }),
    ).toHaveValue('installed');

    execFileSync('docker', ['compose', 'restart', 'api'], { stdio: 'pipe' });
    await expect
      .poll(async () => (await page.request.get('/api/health')).status(), {
        timeout: 30_000,
      })
      .toBe(200);
    const persisted = await (
      await page.request.get(`/api/rooms/${room.id}`)
    ).json();
    expect(persisted.winnerGameId).toBe(game.id);
    expect(
      (await (await page.request.get('/api/me/library')).json()).entries,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ gameId: game.id })]),
    );

    const backup = execFileSync('sh', ['deploy/backup.sh'], {
      encoding: 'utf8',
    });
    const backupPath = backup.trim().replace(/^Backup saved: /, '');
    expect(backupPath).toMatch(/^backups\/partypick-.*\.dump$/);
    const restored = execFileSync(
      'sh',
      ['deploy/restore-check.sh', backupPath],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          EXPECT_MIN_ROOMS: '1',
          EXPECT_MIN_LIBRARIES: '1',
          EXPECT_SAME_AS_LIVE: '1',
        },
      },
    );
    expect(restored).toMatch(/Restore verified: sessions=[1-9]/);
    expect(restored).toMatch(/rooms=[1-9]/);
    expect(restored).toMatch(/libraries=[1-9]/);
  } finally {
    await guestContext.close();
  }
});
