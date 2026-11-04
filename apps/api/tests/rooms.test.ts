import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HTTPMethods } from 'fastify';
import {
  catalog,
  type Preferences,
  type RoomSnapshot,
} from '@partypick/contracts';
import { buildApp } from '../src/app.js';

const ORIGIN = 'http://127.0.0.1:5173';
type App = ReturnType<typeof buildApp>;
let address = 1;
class Client {
  cookie = '';
  constructor(readonly app: App) {}
  async send(method: HTTPMethods, url: string, payload?: unknown) {
    const response = await this.app.inject({
      method,
      url,
      remoteAddress: '127.0.0.' + ((address++ % 250) + 1),
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    });
    const setCookie = response.headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (raw) this.cookie = raw.split(';')[0] ?? '';
    return response;
  }
}
function preferences(): Preferences {
  return {
    availableMinutes: 120,
    mode: 'any',
    games: catalog.map((game) => ({
      gameId: game.id,
      owned: true,
      installed: true,
      taste: 'want',
    })),
  };
}
async function create(host: Client, maxMembers = 8) {
  const response = await host.send('POST', '/api/rooms', {
    displayName: 'Ведущий',
    title: 'Тестовая компания',
    maxMembers,
  });
  expect(response.statusCode).toBe(201);
  return response.json<RoomSnapshot>();
}
async function get(client: Client, id: string) {
  const response = await client.send('GET', '/api/rooms/' + id);
  expect(response.statusCode).toBe(200);
  return response.json<RoomSnapshot>();
}
async function joinRoom(
  client: Client,
  room: RoomSnapshot,
  displayName = 'Участник',
) {
  const response = await client.send(
    'POST',
    '/api/invites/' + room.invitePath!.split('/').pop() + '/join',
    { displayName },
  );
  expect(response.statusCode).toBe(200);
  return response.json<RoomSnapshot>();
}
async function answer(client: Client, room: RoomSnapshot) {
  const current = await get(client, room.id);
  const response = await client.send(
    'PUT',
    '/api/rooms/' + room.id + '/preferences',
    { version: current.version, preferences: preferences() },
  );
  expect(response.statusCode).toBe(200);
  return response.json<RoomSnapshot>();
}

describe('room API and authorization', () => {
  let clock = Date.now();
  const app = buildApp({
    dataDir: 'memory://',
    logger: false,
    now: () => clock,
  });
  beforeAll(async () => {
    await app.ready();
  }, 30_000);
  afterAll(async () => {
    await app.close();
  });

  it('protects membership, hides capabilities and validates guest data and same-origin writes', async () => {
    const host = new Client(app);
    const created = await host.send('POST', '/api/rooms', {
      displayName: 'Ведущий',
      title: 'Приватная комната',
      maxMembers: 3,
    });
    expect(created.statusCode).toBe(201);
    const room = created.json<RoomSnapshot>();
    expect(String(created.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(created.headers['set-cookie'])).toContain('SameSite=Lax');
    const stranger = new Client(app);
    expect(
      (await stranger.send('GET', '/api/rooms/' + room.id)).statusCode,
    ).toBe(403);
    const publicInfo = await stranger.send(
      'GET',
      '/api/invites/' + room.invitePath!.split('/').pop(),
    );
    expect(publicInfo.json()).toEqual({
      title: room.title,
      memberCount: 1,
      maxMembers: 3,
      expiresAt: room.expiresAt,
    });
    const joined = await joinRoom(stranger, room);
    expect(joined.invitePath).toBeUndefined();
    expect(JSON.stringify(joined)).not.toContain('sessionHash');
    expect(JSON.stringify(joined)).not.toContain(
      room.invitePath!.split('/').pop(),
    );
    const repeated = await joinRoom(stranger, room);
    expect(repeated.members).toHaveLength(2);
    expect(repeated.version).toBe(joined.version);
    const denied = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: 'https://untrusted.example' },
      payload: { displayName: 'Имя', title: 'Комната', maxMembers: 4 },
    });
    expect(denied.statusCode).toBe(403);
    const missingOrigin = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { displayName: 'Имя', title: 'Комната', maxMembers: 4 },
    });
    expect(missingOrigin.statusCode).toBe(403);
    const forgedHost = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: ORIGIN, host: 'untrusted.example' },
      payload: { displayName: 'Имя', title: 'Комната', maxMembers: 4 },
    });
    expect(forgedHost.statusCode).toBe(403);
    const invalid = await host.send('POST', '/api/rooms', {
      displayName: 'X',
      title: 'Bad',
      maxMembers: 99,
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('VALIDATION_ERROR');
    const invalidPrefs = await stranger.send(
      'PUT',
      '/api/rooms/' + room.id + '/preferences',
      {
        version: repeated.version,
        memberId: room.hostMemberId,
        preferences: preferences(),
      },
    );
    expect(invalidPrefs.statusCode).toBe(400);
  });

  it('serializes concurrent joins and versioned writes without exceeding capacity', async () => {
    const host = new Client(app);
    const room = await create(host, 2);
    const token = room.invitePath!.split('/').pop();
    const clients = [new Client(app), new Client(app)];
    const responses = await Promise.all(
      clients.map((client, index) =>
        client.send('POST', '/api/invites/' + token + '/join', {
          displayName: 'Гость ' + index,
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200, 409,
    ]);
    const full = await get(host, room.id);
    expect(full.members).toHaveLength(2);
    const attempts = await Promise.all(
      [1, 2].map(() =>
        host.send('PUT', '/api/rooms/' + room.id + '/preferences', {
          version: full.version,
          preferences: preferences(),
        }),
      ),
    );
    expect(attempts.map((response) => response.statusCode).sort()).toEqual([
      200, 409,
    ]);
    expect((await get(host, room.id)).version).toBe(full.version + 1);
  });

  it('runs voting and ready states, rejects unauthorized host actions and stale rounds, and allows leaving', async () => {
    const host = new Client(app);
    const guest = new Client(app);
    let room = await create(host);
    await joinRoom(guest, room);
    room = await get(host, room.id);
    const premature = await host.send(
      'POST',
      '/api/rooms/' + room.id + '/voting',
      { version: room.version },
    );
    expect(premature.json().error.code).toBe('NOT_READY');
    await answer(host, room);
    await answer(guest, room);
    room = await get(host, room.id);
    const forbidden = await guest.send(
      'POST',
      '/api/rooms/' + room.id + '/voting',
      { version: room.version },
    );
    expect(forbidden.statusCode).toBe(403);
    const opened = await host.send(
      'POST',
      '/api/rooms/' + room.id + '/voting',
      { version: room.version },
    );
    expect(opened.statusCode).toBe(200);
    room = opened.json<RoomSnapshot>();
    expect(room.status).toBe('voting');
    const invalidVote = await guest.send(
      'PUT',
      '/api/rooms/' + room.id + '/vote',
      { version: room.version, round: room.round, gameId: 'not-in-catalog' },
    );
    expect(invalidVote.statusCode).toBe(400);
    const gameId = room.matching.eligible[0]!.gameId;
    const hostVoted = await host.send(
      'PUT',
      '/api/rooms/' + room.id + '/vote',
      { version: room.version, round: room.round, gameId },
    );
    room = hostVoted.json<RoomSnapshot>();
    const earlyFinal = await host.send(
      'POST',
      '/api/rooms/' + room.id + '/finalize',
      { version: room.version, round: room.round },
    );
    expect(earlyFinal.json().error.code).toBe('NOT_READY');
    const guestVoted = await guest.send(
      'PUT',
      '/api/rooms/' + room.id + '/vote',
      { version: room.version, round: room.round, gameId },
    );
    room = guestVoted.json<RoomSnapshot>();
    const result = await host.send(
      'POST',
      '/api/rooms/' + room.id + '/finalize',
      { version: room.version, round: room.round },
    );
    expect(result.statusCode).toBe(200);
    room = result.json<RoomSnapshot>();
    expect(room.status).toBe('confirmed');
    expect(room.winnerGameId).toBe(gameId);
    for (const client of [host, guest]) {
      room = await get(client, room.id);
      const ready = await client.send(
        'PUT',
        '/api/rooms/' + room.id + '/ready',
        { version: room.version, round: room.round, ready: true },
      );
      expect(ready.statusCode).toBe(200);
    }
    room = await get(host, room.id);
    expect(room.members.every((member) => member.ready)).toBe(true);
    const previousRound = room.round;
    const reopened = await host.send(
      'POST',
      '/api/rooms/' + room.id + '/reopen',
      { version: room.version },
    );
    room = reopened.json<RoomSnapshot>();
    expect(room.round).toBe(previousRound + 1);
    expect(room.winnerGameId).toBeNull();
    expect(
      room.members.every((member) => !member.voteGameId && !member.ready),
    ).toBe(true);
    const stale = await guest.send('PUT', '/api/rooms/' + room.id + '/vote', {
      version: room.version,
      round: previousRound,
      gameId,
    });
    expect(stale.json().error.code).toBe('CONFLICT');
    const hostLeave = await host.send(
      'DELETE',
      '/api/rooms/' + room.id + '/membership',
      { version: room.version },
    );
    expect(hostLeave.statusCode).toBe(409);
    const left = await guest.send(
      'DELETE',
      '/api/rooms/' + room.id + '/membership',
      { version: room.version },
    );
    expect(left.json()).toEqual({ left: true });
    expect((await get(host, room.id)).members).toHaveLength(1);
    expect((await guest.send('GET', '/api/rooms/' + room.id)).statusCode).toBe(
      403,
    );
  });

  it('does not open voting when everyone answered but no common games exist', async () => {
    const host = new Client(app),
      guest = new Client(app);
    let room = await create(host);
    await joinRoom(guest, room);
    await answer(host, room);
    room = await get(guest, room.id);
    const prefs = preferences();
    for (const choice of prefs.games) {
      choice.owned = false;
      choice.installed = false;
    }
    const answered = await guest.send(
      'PUT',
      '/api/rooms/' + room.id + '/preferences',
      { version: room.version, preferences: prefs },
    );
    room = answered.json<RoomSnapshot>();
    expect(room.matching.status).toBe('empty');
    const response = await host.send(
      'POST',
      '/api/rooms/' + room.id + '/voting',
      { version: room.version },
    );
    expect(response.json().error.code).toBe('NO_MATCHES');
  });

  it('expires room access and invitation metadata', async () => {
    const host = new Client(app);
    const room = await create(host);
    clock += 24 * 60 * 60 * 1000 + 1;
    expect(
      (await host.send('GET', '/api/rooms/' + room.id)).json().error.code,
    ).toBe('ROOM_EXPIRED');
    expect(
      (
        await host.send(
          'GET',
          '/api/invites/' + room.invitePath!.split('/').pop(),
        )
      ).json().error.code,
    ).toBe('ROOM_EXPIRED');
  });

  it('limits creation bursts before a client can fill the store', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 13; attempt += 1) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/api/rooms',
          remoteAddress: '192.0.2.99',
          headers: { origin: ORIGIN },
          payload: {
            displayName: 'Проверка',
            title: 'Лимит запросов',
            maxMembers: 2,
          },
        }),
      );
    }
    expect(
      responses.slice(0, 12).every((response) => response.statusCode === 201),
    ).toBe(true);
    expect(responses[12]!.statusCode).toBe(429);
    expect(responses[12]!.json().error.code).toBe('RATE_LIMITED');
  });

  it('allows polling by a party behind one shared IP without the default 300-read ceiling', async () => {
    const host = new Client(app);
    const room = await create(host);
    for (let read = 0; read < 305; read += 1) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rooms/' + room.id,
        remoteAddress: '198.51.100.20',
        headers: { cookie: host.cookie },
      });
      expect(response.statusCode).toBe(200);
    }
  });
});

it('persists rooms and guest sessions across database restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'partypick-api-'));
  let app = buildApp({ dataDir: directory, logger: false });
  try {
    const host = new Client(app);
    const room = await create(host);
    const cookie = host.cookie;
    await app.close();
    app = buildApp({ dataDir: directory, logger: false });
    const returning = new Client(app);
    returning.cookie = cookie;
    expect((await get(returning, room.id)).title).toBe(room.title);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
