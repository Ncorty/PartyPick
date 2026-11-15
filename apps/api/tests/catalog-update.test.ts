import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HTTPMethods } from 'fastify';
import type {
  CatalogUpdatePreview,
  Game,
  RoomSnapshot,
} from '@partypick/contracts';
import { buildApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';

const origin = 'http://127.0.0.1:5173';
type App = ReturnType<typeof buildApp>;
class Client {
  cookie = '';
  constructor(public app: App) {}
  async send(method: HTTPMethods, url: string, body?: unknown) {
    const response = await this.app.inject({
      method,
      url,
      headers: {
        origin,
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
    });
    const raw = response.headers['set-cookie'];
    const cookie = Array.isArray(raw) ? raw[0] : raw;
    if (cookie) this.cookie = cookie.split(';')[0] ?? '';
    return response;
  }
}

describe('catalog update', () => {
  it('preserves a confirmed result on no-op and clears it on a real metadata change', async () => {
    const database = await openDatabase('memory://');
    const app = buildApp({ database, logger: false });
    const host = new Client(app),
      guest = new Client(app);
    try {
      await app.ready();
      const created = (
        await host.send('POST', '/api/rooms', {
          displayName: 'Ведущий',
          title: 'Победитель и каталог',
          maxMembers: 2,
        })
      ).json<RoomSnapshot>();
      const path = `/api/rooms/${created.id}`;
      const joined = (
        await guest.send(
          'POST',
          `/api/invites/${created.invitePath!.split('/').pop()}/join`,
          { displayName: 'Друг' },
        )
      ).json<RoomSnapshot>();
      const gameId = 'deep-rock';
      const preferences = {
        availableMinutes: 120,
        mode: 'any',
        games: [{ gameId, owned: true, installed: true, taste: 'want' }],
      };
      const first = (
        await host.send('PUT', `${path}/preferences`, {
          version: joined.version,
          preferences,
        })
      ).json<RoomSnapshot>();
      const second = (
        await guest.send('PUT', `${path}/preferences`, {
          version: first.version,
          preferences,
        })
      ).json<RoomSnapshot>();
      const voting = (
        await host.send('POST', `${path}/voting`, { version: second.version })
      ).json<RoomSnapshot>();
      const hostVote = (
        await host.send('PUT', `${path}/vote`, {
          version: voting.version,
          round: voting.round,
          gameId,
        })
      ).json<RoomSnapshot>();
      const guestVote = (
        await guest.send('PUT', `${path}/vote`, {
          version: hostVote.version,
          round: hostVote.round,
          gameId,
        })
      ).json<RoomSnapshot>();
      const final = (
        await host.send('POST', `${path}/finalize`, {
          version: guestVote.version,
          round: guestVote.round,
        })
      ).json<RoomSnapshot>();
      const ready = (
        await host.send('PUT', `${path}/ready`, {
          version: final.version,
          round: final.round,
          ready: true,
        })
      ).json<RoomSnapshot>();
      expect(ready.winnerGameId).toBe(gameId);
      const noop = (
        await host.send('POST', `${path}/catalog-update`, {
          version: ready.version,
          targetRevision: ready.catalogRevision,
          confirmReset: true,
        })
      ).json<RoomSnapshot>();
      expect(noop).toMatchObject({
        version: ready.version,
        round: ready.round,
        status: 'confirmed',
        winnerGameId: gameId,
      });
      expect(noop.members[0]!.ready).toBe(true);
      expect(noop.members.every((member) => member.voteGameId === gameId)).toBe(
        true,
      );
      const game = created.catalog.find((entry) => entry.id === gameId)!;
      await database.query(
        'UPDATE game_catalog SET data = $2::jsonb WHERE id = $1',
        [gameId, JSON.stringify({ ...game, verifiedAt: '2026-11-14' })],
      );
      const preview = (
        await host.send('GET', `${path}/catalog-update`)
      ).json<CatalogUpdatePreview>();
      expect(preview.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ gameId, kind: 'changed' }),
        ]),
      );
      expect(
        (
          await host.send('POST', `${path}/catalog-update`, {
            version: ready.version - 1,
            targetRevision: preview.targetRevision,
            confirmReset: true,
          })
        ).statusCode,
      ).toBe(409);
      const applied = (
        await host.send('POST', `${path}/catalog-update`, {
          version: preview.roomVersion,
          targetRevision: preview.targetRevision,
          confirmReset: true,
        })
      ).json<RoomSnapshot>();
      expect(applied).toMatchObject({
        version: ready.version + 1,
        round: ready.round + 1,
        status: 'collecting',
        winnerGameId: null,
      });
      expect(
        applied.members.every(
          (member) => member.voteGameId === null && !member.ready,
        ),
      ).toBe(true);
    } finally {
      await app.close();
      await database.close();
    }
  }, 60_000);

  it('requires the host, freezes the preview, applies one server-read target and preserves compatible choices', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'partypick-catalog-update-'));
    const database = await openDatabase(dir);
    let app = buildApp({ database, logger: false });
    const host = new Client(app),
      guest = new Client(app),
      outsider = new Client(app);
    try {
      await app.ready();
      const created = (
        await host.send('POST', '/api/rooms', {
          displayName: 'Ведущий',
          title: 'Новый каталог',
          maxMembers: 3,
        })
      ).json<RoomSnapshot>();
      expect(created.catalogRevision).toMatch(/^[a-f0-9]{64}$/);
      expect(created.matchingRulesVersion).toBe(1);
      const path = `/api/rooms/${created.id}`;
      const invite = created.invitePath!.split('/').pop();
      expect(
        (
          await guest.send('POST', `/api/invites/${invite}/join`, {
            displayName: 'Друг',
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (await guest.send('GET', `${path}/catalog-update`)).statusCode,
      ).toBe(403);
      expect(
        (await outsider.send('GET', `${path}/catalog-update`)).statusCode,
      ).toBe(403);
      const initial = (await host.send('GET', path)).json<RoomSnapshot>();
      const noChange = (
        await host.send('GET', `${path}/catalog-update`)
      ).json<CatalogUpdatePreview>();
      expect(noChange.changes).toEqual([]);
      expect(noChange.currentRevision).toBe(noChange.targetRevision);
      const first = initial.catalog[0]!,
        removed = initial.catalog[1]!;
      const hostPrefs = {
        availableMinutes: 120,
        mode: 'any',
        allowRandoms: false,
        genres: ['party'],
        games: [
          { gameId: first.id, owned: true, installed: true, taste: 'veto' },
          { gameId: removed.id, owned: true, installed: false, taste: 'want' },
        ],
      };
      const saveHost = (
        await host.send('PUT', `${path}/preferences`, {
          version: initial.version,
          preferences: hostPrefs,
        })
      ).json<RoomSnapshot>();
      const saveGuest = (
        await guest.send('PUT', `${path}/preferences`, {
          version: saveHost.version,
          preferences: {
            availableMinutes: 45,
            mode: 'coop',
            games: [
              { gameId: first.id, owned: true, installed: true, taste: 'okay' },
            ],
          },
        })
      ).json<RoomSnapshot>();
      expect(saveGuest.members.every((member) => member.preferences)).toBe(
        true,
      );
      const thirdJoin = await outsider.send(
        'POST',
        `/api/invites/${invite}/join`,
        { displayName: 'Третий' },
      );
      expect(thirdJoin.statusCode).toBe(200);
      const edited: Game = {
        ...first,
        description: `${first.description} Редакция.`,
        profiles: [
          ...first.profiles,
          { ...first.profiles[0]!, id: 'new-profile', name: 'Новый режим' },
        ],
      };
      const added: Game = {
        ...removed,
        id: 'new-catalog-game',
        name: 'Новая игра',
        aliases: ['новая игра'],
      };
      await database.query(
        'UPDATE game_catalog SET data = $2::jsonb WHERE id = $1',
        [first.id, JSON.stringify(edited)],
      );
      await database.query('DELETE FROM game_catalog WHERE id = $1', [
        removed.id,
      ]);
      await database.query(
        'INSERT INTO game_catalog (id, data, seed_version) VALUES ($1, $2::jsonb, 3)',
        [added.id, JSON.stringify(added)],
      );
      let preview = (
        await host.send('GET', `${path}/catalog-update`)
      ).json<CatalogUpdatePreview>();
      expect(preview.currentRevision).toBe(created.catalogRevision);
      expect(preview.targetRevision).not.toBe(preview.currentRevision);
      expect(preview.changes.map((change) => change.kind).sort()).toEqual(
        ['changed', 'removed', 'added'].sort(),
      );
      expect(
        preview.changes.find((change) => change.gameId === first.id)?.profiles,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ profileId: 'new-profile', kind: 'added' }),
        ]),
      );
      await database.query(
        'UPDATE game_catalog SET data = $2::jsonb WHERE id = $1',
        [
          first.id,
          JSON.stringify({
            ...edited,
            description: `${edited.description} Ещё правка.`,
          }),
        ],
      );
      expect(
        (
          await host.send('POST', `${path}/catalog-update`, {
            version: preview.roomVersion,
            targetRevision: preview.targetRevision,
            confirmReset: true,
          })
        ).statusCode,
      ).toBe(409);
      preview = (
        await host.send('GET', `${path}/catalog-update`)
      ).json<CatalogUpdatePreview>();
      expect(
        (
          await guest.send('POST', `${path}/catalog-update`, {
            version: preview.roomVersion,
            targetRevision: preview.targetRevision,
            confirmReset: true,
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await host.send('POST', `${path}/catalog-update`, {
            version: preview.roomVersion,
            targetRevision: preview.targetRevision,
            confirmReset: false,
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await host.send('POST', `${path}/catalog-update`, {
            version: preview.roomVersion,
            targetRevision: '0'.repeat(64),
            confirmReset: true,
          })
        ).statusCode,
      ).toBe(409);
      const outcomes = await Promise.all([
        host.send('POST', `${path}/catalog-update`, {
          version: preview.roomVersion,
          targetRevision: preview.targetRevision,
          confirmReset: true,
        }),
        host.send('POST', `${path}/catalog-update`, {
          version: preview.roomVersion,
          targetRevision: preview.targetRevision,
          confirmReset: true,
        }),
      ]);
      expect(outcomes.map((response) => response.statusCode).sort()).toEqual([
        200, 409,
      ]);
      const updated = outcomes
        .find((response) => response.statusCode === 200)!
        .json<RoomSnapshot>();
      expect(updated.round).toBe(saveGuest.round + 2);
      expect(updated.version).toBe(saveGuest.version + 2);
      expect(updated.status).toBe('collecting');
      expect(updated.catalogRevision).toBe(preview.targetRevision);
      expect(updated.members[0]!.preferences).toMatchObject({
        availableMinutes: 120,
        mode: 'any',
        allowRandoms: false,
        genres: ['party'],
        games: [
          { gameId: first.id, owned: true, installed: true, taste: 'veto' },
        ],
      });
      expect(updated.members[1]!.preferences?.games).toEqual([
        { gameId: first.id, owned: true, installed: true, taste: 'okay' },
      ]);
      expect(updated.members[2]!.preferences).toBeNull();
      expect(
        updated.members.every(
          (member) => member.voteGameId === null && !member.ready,
        ),
      ).toBe(true);
      expect(updated.catalog.some((game) => game.id === added.id)).toBe(true);
      expect(
        updated.members.every(
          (member) =>
            !member.preferences?.games.some(
              (choice) => choice.gameId === added.id,
            ),
        ),
      ).toBe(true);
      const noop = (
        await host.send('POST', `${path}/catalog-update`, {
          version: updated.version,
          targetRevision: preview.targetRevision,
          confirmReset: true,
        })
      ).json<RoomSnapshot>();
      expect(noop.version).toBe(updated.version);
      expect(noop.round).toBe(updated.round);
      await app.close();
      await database.close();
      app = buildApp({ dataDir: dir, logger: false });
      host.app = app;
      await app.ready();
      expect(
        (await host.send('GET', path)).json<RoomSnapshot>().catalogRevision,
      ).toBe(updated.catalogRevision);
    } finally {
      await app.close();
      await database.close().catch(() => {});
      await rm(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it('rejects an empty or malformed target and an expired room', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'partypick-catalog-invalid-'));
    let clock = Date.now();
    const database = await openDatabase(dir);
    const app = buildApp({ database, logger: false, now: () => clock });
    const host = new Client(app);
    try {
      await app.ready();
      const room = (
        await host.send('POST', '/api/rooms', {
          displayName: 'Ведущий',
          title: 'Плохой каталог',
          maxMembers: 2,
        })
      ).json<RoomSnapshot>();
      await database.query('DELETE FROM game_catalog');
      expect(
        (await host.send('GET', `/api/rooms/${room.id}/catalog-update`))
          .statusCode,
      ).toBe(409);
      await database.query(
        'INSERT INTO game_catalog (id, data, seed_version) VALUES ($1, $2::jsonb, 3)',
        [
          room.catalog[0]!.id,
          JSON.stringify({
            ...room.catalog[0],
            genres: ['invalid-genre'],
            profiles: [{ ...room.catalog[0]!.profiles[0], playMinutes: 10 }],
          }),
        ],
      );
      expect(
        (await host.send('GET', `/api/rooms/${room.id}/catalog-update`))
          .statusCode,
      ).toBe(409);
      clock += 25 * 60 * 60 * 1000;
      expect(
        (await host.send('GET', `/api/rooms/${room.id}/catalog-update`))
          .statusCode,
      ).toBe(410);
    } finally {
      await app.close();
      await database.close();
      await rm(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
