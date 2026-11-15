import { describe, expect, it } from 'vitest';
import { catalog } from '@partypick/contracts';
import { openDatabase } from '../src/db.js';
import {
  CATALOG_SEED_VERSION,
  catalogRevision,
  readCatalog,
  seedCatalog,
} from '../src/catalog.js';

describe('database-backed catalog', () => {
  it('hashes canonical content including metadata', () => {
    const game = catalog.find((entry) => entry.profiles.length > 1)!;
    const swapped = {
      ...game,
      genres: [...game.genres].reverse(),
      modes: [...game.modes].reverse(),
      aliases: [...(game.aliases ?? [])].reverse(),
      profiles: [...game.profiles].reverse().map((profile) => ({
        ...profile,
        ...(profile.allowedPartySizes
          ? { allowedPartySizes: [...profile.allowedPartySizes].reverse() }
          : {}),
      })),
    };
    expect(catalogRevision([game])).toBe(catalogRevision([swapped]));
    expect(catalogRevision([game, catalog[0]!])).toBe(
      catalogRevision([catalog[0]!, game]),
    );
    expect(
      catalogRevision([
        { ...game, description: `${game.description} Изменено.` },
      ]),
    ).not.toBe(catalogRevision([game]));
    expect(catalogRevision([{ ...game, verifiedAt: '2026-11-14' }])).not.toBe(
      catalogRevision([game]),
    );
  });
  it('seeds idempotently, updates older definitions and preserves current edits', async () => {
    const database = await openDatabase('memory://');
    try {
      await seedCatalog(database);
      expect(
        (await readCatalog(database)).map((game) => game.id).sort(),
      ).toEqual(catalog.map((game) => game.id).sort());
      const first = catalog[0]!;
      const edited = { ...first, name: 'Локальная редакция' };
      await database.query(
        'UPDATE game_catalog SET data = $2::jsonb WHERE id = $1',
        [first.id, JSON.stringify(edited)],
      );
      await seedCatalog(database);
      expect(
        (await readCatalog(database)).find((game) => game.id === first.id)
          ?.name,
      ).toBe(edited.name);
      await database.query(
        'UPDATE game_catalog SET seed_version = $2 WHERE id = $1',
        [first.id, CATALOG_SEED_VERSION - 1],
      );
      await seedCatalog(database);
      expect(
        (await readCatalog(database)).find((game) => game.id === first.id),
      ).toEqual(first);
      const rows = await database.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM game_catalog',
      );
      expect(rows.rows[0]?.count).toBe(catalog.length);
    } finally {
      await database.close();
    }
  });

  it('upgrades a version-two row without changing an active room snapshot or its votes', async () => {
    const database = await openDatabase('memory://');
    try {
      const original = { ...catalog[0]!, name: 'Старый seed' };
      const state = {
        id: 'existing',
        status: 'voting',
        round: 7,
        version: 12,
        winnerGameId: null,
        catalog: [original],
        members: [
          {
            id: 'guest',
            voteGameId: original.id,
            ready: false,
            preferences: {
              availableMinutes: 30,
              mode: 'any',
              games: [
                {
                  gameId: original.id,
                  owned: true,
                  installed: true,
                  taste: 'want',
                },
              ],
            },
          },
        ],
      };
      await database.query(
        'INSERT INTO game_catalog (id, data, seed_version) VALUES ($1, $2::jsonb, 2)',
        [original.id, JSON.stringify(original)],
      );
      await database.query(
        'INSERT INTO rooms (id, invite_hash, state) VALUES ($1, $2, $3::jsonb)',
        [state.id, 'invite-hash', JSON.stringify(state)],
      );
      await seedCatalog(database);
      await seedCatalog(database);
      const persisted = await database.query<{ state: typeof state }>(
        'SELECT state FROM rooms WHERE id = $1',
        [state.id],
      );
      expect(persisted.rows[0]?.state).toEqual(state);
      expect(
        (await readCatalog(database)).find((game) => game.id === original.id),
      ).toEqual(catalog[0]);
      expect(await readCatalog(database)).toHaveLength(catalog.length);
    } finally {
      await database.close();
    }
  });

  it('freezes legacy rooms to six games without rewriting modern room catalogs', async () => {
    const database = await openDatabase('memory://');
    try {
      await database.query(
        'INSERT INTO rooms (id, invite_hash, state) VALUES ($1, $2, $3::jsonb)',
        ['legacy', 'legacy-invite', JSON.stringify({ id: 'legacy', round: 3 })],
      );
      const frozen = [{ ...catalog[0]!, name: 'Зафиксированная версия' }];
      await database.query(
        'INSERT INTO rooms (id, invite_hash, state) VALUES ($1, $2, $3::jsonb)',
        [
          'modern',
          'modern-invite',
          JSON.stringify({ id: 'modern', catalog: frozen }),
        ],
      );
      await seedCatalog(database);
      await seedCatalog(database);
      const legacy = await database.query<{
        state: { round: number; catalog: typeof catalog };
      }>('SELECT state FROM rooms WHERE id = $1', ['legacy']);
      expect(legacy.rows[0]?.state.round).toBe(3);
      expect(
        legacy.rows[0]?.state.catalog.map((game) => game.id).sort(),
      ).toEqual([
        'deep-rock',
        'dont-starve',
        'overcooked-2',
        'pummel-party',
        'unrailed',
        'valheim',
      ]);
      const modern = await database.query<{
        state: { catalog: typeof catalog };
      }>('SELECT state FROM rooms WHERE id = $1', ['modern']);
      expect(modern.rows[0]?.state.catalog).toEqual(frozen);
    } finally {
      await database.close();
    }
  });

  it.each(['voting', 'confirmed'])(
    'restarts a legacy %s round once while preserving members and preferences',
    async (status) => {
      const database = await openDatabase('memory://');
      try {
        const preferences = { mode: 'any', availableMinutes: 60, games: [] };
        const state = {
          id: 'legacy',
          status,
          round: 4,
          version: 9,
          winnerGameId: 'deep-rock',
          members: [
            { id: 'host', preferences, voteGameId: 'deep-rock', ready: true },
          ],
        };
        await database.query(
          'INSERT INTO rooms (id, invite_hash, state) VALUES ($1, $2, $3::jsonb)',
          ['legacy', 'legacy-invite', JSON.stringify(state)],
        );
        await seedCatalog(database);
        await seedCatalog(database);
        const result = await database.query<{
          state: typeof state & { catalog: typeof catalog };
        }>('SELECT state FROM rooms WHERE id = $1', ['legacy']);
        expect(result.rows[0]?.state).toMatchObject({
          status: 'collecting',
          round: 5,
          version: 10,
          winnerGameId: null,
          members: [
            { id: 'host', preferences, voteGameId: null, ready: false },
          ],
        });
        expect(result.rows[0]?.state.catalog).toHaveLength(6);
      } finally {
        await database.close();
      }
    },
  );
});
