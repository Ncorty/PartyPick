import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HTTPMethods } from 'fastify';
import type {
  LibrarySnapshot,
  Preferences,
  RoomSnapshot,
} from '@partypick/contracts';
import { buildApp } from '../src/app.js';

const origin = 'http://127.0.0.1:5173';
type App = ReturnType<typeof buildApp>;
class Client {
  cookie = '';
  constructor(public app: App) {}
  async send(method: HTTPMethods, url: string, payload?: unknown) {
    const response = await this.app.inject({
      method,
      url,
      headers: { origin, ...(this.cookie ? { cookie: this.cookie } : {}) },
      ...(payload === undefined ? {} : { payload }),
    });
    const cookie = response.headers['set-cookie'];
    const raw = Array.isArray(cookie) ? cookie[0] : cookie;
    if (raw) this.cookie = raw.split(';')[0] ?? '';
    return response;
  }
  async session() {
    const response = await this.send('POST', '/api/guest-session');
    expect(response.statusCode).toBe(200);
    return response.json<{ expiresAt: string }>();
  }
  async library() {
    const response = await this.send('GET', '/api/me/library');
    expect(response.statusCode).toBe(200);
    return response.json<LibrarySnapshot>();
  }
  async room(title = 'Тестовая комната') {
    const response = await this.send('POST', '/api/rooms', {
      displayName: 'Ведущий',
      title,
      maxMembers: 3,
    });
    expect(response.statusCode).toBe(201);
    return response.json<RoomSnapshot>();
  }
}
function prefs(gameId: string): Preferences {
  return {
    availableMinutes: 75,
    mode: 'coop',
    sessionStyle: 'relaxed',
    games: [{ gameId, owned: false, installed: false, taste: 'veto' }],
  };
}

describe('guest library', () => {
  let now = Date.now();
  const app = buildApp({ dataDir: 'memory://', logger: false, now: () => now });
  beforeAll(() => app.ready(), 30_000);
  afterAll(() => app.close());

  it('keeps identity, expiry, and libraries private; rejects invalid changes', async () => {
    const first = new Client(app),
      second = new Client(app);
    expect((await first.send('GET', '/api/me/library')).statusCode).toBe(403);
    expect(
      (
        await first.send('PATCH', '/api/me/library', {
          version: 0,
          changes: [],
        })
      ).statusCode,
    ).toBe(403);
    const session = await first.session();
    const cookie = first.cookie;
    expect(await first.session()).toEqual(session);
    expect(first.cookie).toBe(cookie);
    await second.session();
    const catalog = (await first.send('GET', '/api/catalog')).json<
      { id: string }[]
    >();
    const id = catalog[0]!.id;
    const saved = await first.send('PATCH', '/api/me/library', {
      version: 0,
      changes: [{ gameId: id, availability: 'installed' }],
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json<LibrarySnapshot>().entries).toEqual([
      { gameId: id, availability: 'installed' },
    ]);
    expect((await second.library()).entries).toEqual([]);
    expect(JSON.stringify(await first.library())).not.toContain('token_hash');
    for (const changes of [
      [{ gameId: 'missing', availability: 'available' }],
      [
        { gameId: id, availability: 'available' },
        { gameId: id, availability: 'installed' },
      ],
    ]) {
      expect(
        (await first.send('PATCH', '/api/me/library', { version: 1, changes }))
          .statusCode,
      ).toBe(400);
    }
    const noop = await first.send('PATCH', '/api/me/library', {
      version: 1,
      changes: [{ gameId: id, availability: 'installed' }],
    });
    expect(noop.json<LibrarySnapshot>().version).toBe(1);
    expect(noop.json<LibrarySnapshot>().updatedAt).toBe(
      saved.json<LibrarySnapshot>().updatedAt,
    );
  });

  it('serializes two writes to one version and enforces expiry', async () => {
    const first = new Client(app);
    await first.session();
    const id = (await first.send('GET', '/api/catalog')).json<
      { id: string }[]
    >()[0]!.id;
    const sibling = new Client(app);
    sibling.cookie = first.cookie;
    const outcomes = await Promise.all([
      first.send('PATCH', '/api/me/library', {
        version: 0,
        changes: [{ gameId: id, availability: 'available' }],
      }),
      sibling.send('PATCH', '/api/me/library', {
        version: 0,
        changes: [{ gameId: id, availability: 'unavailable' }],
      }),
    ]);
    expect(outcomes.map((outcome) => outcome.statusCode).sort()).toEqual([
      200, 409,
    ]);
    now += 8 * 24 * 60 * 60 * 1000;
    expect((await first.send('GET', '/api/me/library')).statusCode).toBe(403);
    expect(
      (
        await first.send('PATCH', '/api/me/library', {
          version: 1,
          changes: [],
        })
      ).statusCode,
    ).toBe(403);
    now -= 8 * 24 * 60 * 60 * 1000;
  });

  it('leaves room answers untouched on library save and applies known entries only with host reset', async () => {
    const host = new Client(app),
      guest = new Client(app);
    const room = await host.room();
    const joined = await guest.send(
      'POST',
      `/api/invites/${room.invitePath!.split('/').pop()}/join`,
      { displayName: 'Друг' },
    );
    expect(joined.statusCode).toBe(200);
    const game = room.catalog[0]!.id;
    const other = room.catalog[1]!.id;
    const library = await host.library();
    const saved = (
      await host.send('PATCH', '/api/me/library', {
        version: library.version,
        changes: [
          { gameId: game, availability: 'installed' },
          { gameId: other, availability: 'available' },
        ],
      })
    ).json<LibrarySnapshot>();
    const before = (
      await host.send('GET', `/api/rooms/${room.id}`)
    ).json<RoomSnapshot>();
    expect(before.members[0]!.preferences).toBeNull();
    expect(
      (
        await host.send('POST', `/api/rooms/${room.id}/apply-library`, {
          version: before.version,
          libraryVersion: saved.version,
          resetRound: true,
        })
      ).statusCode,
    ).toBe(409);
    const hostAnswer = (
      await host.send('PUT', `/api/rooms/${room.id}/preferences`, {
        version: before.version,
        preferences: prefs(game),
      })
    ).json<RoomSnapshot>();
    const guestAnswer = (
      await guest.send('PUT', `/api/rooms/${room.id}/preferences`, {
        version: hostAnswer.version,
        preferences: prefs(game),
      })
    ).json<RoomSnapshot>();
    const voting = await host.send('POST', `/api/rooms/${room.id}/voting`, {
      version: guestAnswer.version,
    });
    // Veto makes voting unavailable, so use an eligible preference while keeping another veto.
    expect(voting.statusCode).toBe(409);
    const eligible: Preferences = {
      ...prefs(game),
      games: [
        { gameId: game, owned: true, installed: true, taste: 'okay' },
        { gameId: other, owned: false, installed: false, taste: 'veto' },
      ],
    };
    const h = (
      await host.send('PUT', `/api/rooms/${room.id}/preferences`, {
        version: guestAnswer.version,
        preferences: eligible,
      })
    ).json<RoomSnapshot>();
    const g = (
      await guest.send('PUT', `/api/rooms/${room.id}/preferences`, {
        version: h.version,
        preferences: eligible,
      })
    ).json<RoomSnapshot>();
    const active = (
      await host.send('POST', `/api/rooms/${room.id}/voting`, {
        version: g.version,
      })
    ).json<RoomSnapshot>();
    const afterSave = (
      await host.send('PATCH', '/api/me/library', {
        version: saved.version,
        changes: [{ gameId: other, availability: 'installed' }],
      })
    ).json<LibrarySnapshot>();
    const unchanged = (
      await host.send('GET', `/api/rooms/${room.id}`)
    ).json<RoomSnapshot>();
    expect(unchanged.version).toBe(active.version);
    expect(unchanged.round).toBe(active.round);
    expect(
      (
        await guest.send('POST', `/api/rooms/${room.id}/apply-library`, {
          version: active.version,
          libraryVersion: 0,
          resetRound: true,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await host.send('POST', `/api/rooms/${room.id}/apply-library`, {
          version: active.version,
          libraryVersion: saved.version,
          resetRound: true,
        })
      ).statusCode,
    ).toBe(409);
    const applied = (
      await host.send('POST', `/api/rooms/${room.id}/apply-library`, {
        version: active.version,
        libraryVersion: afterSave.version,
        resetRound: true,
      })
    ).json<RoomSnapshot>();
    expect(applied.status).toBe('collecting');
    expect(applied.round).toBe(active.round + 1);
    expect(applied.version).toBe(active.version + 1);
    const own = applied.members.find((m) => m.id === applied.viewerMemberId)!;
    expect(
      own.preferences?.games.find((g) => g.gameId === other),
    ).toMatchObject({ owned: true, installed: true, taste: 'veto' });
    expect(own.preferences?.availableMinutes).toBe(75);
    expect(applied.members[1]!.preferences).toEqual(eligible);
  });
});

it('persists libraries across restart and removes them through session cleanup', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'partypick-library-'));
  let now = Date.now();
  try {
    const first = buildApp({ dataDir: dir, logger: false, now: () => now });
    await first.ready();
    const client = new Client(first);
    await client.session();
    const id = (await client.send('GET', '/api/catalog')).json<
      { id: string }[]
    >()[0]!.id;
    expect(
      (
        await client.send('PATCH', '/api/me/library', {
          version: 0,
          changes: [{ gameId: id, availability: 'available' }],
        })
      ).statusCode,
    ).toBe(200);
    await first.close();
    const reopened = buildApp({ dataDir: dir, logger: false, now: () => now });
    await reopened.ready();
    client.app = reopened;
    expect((await client.library()).entries).toEqual([
      { gameId: id, availability: 'available' },
    ]);
    await reopened.close();
    now += 8 * 24 * 60 * 60 * 1000;
    const expired = buildApp({ dataDir: dir, logger: false, now: () => now });
    await expired.ready();
    client.app = expired;
    expect((await client.send('GET', '/api/me/library')).statusCode).toBe(403);
    await expired.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60_000);
