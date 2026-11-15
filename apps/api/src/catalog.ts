import { catalog, validateCatalog, type Game } from '@partypick/contracts';
import { createHash } from 'node:crypto';
import type { Database, Queryable } from './db.js';

export const CATALOG_SEED_VERSION = 3;
const setFields = new Set(['genres', 'modes', 'aliases', 'allowedPartySizes']);

export function canonicalCatalogValue(value: unknown, key = ''): unknown {
  const normalize = (item: unknown, field = ''): unknown => {
    if (Array.isArray(item)) {
      const values = item.map((entry) => normalize(entry));
      if (field === 'games' || field === 'profiles')
        return values.sort((a, b) =>
          String((a as { id: string }).id).localeCompare(
            String((b as { id: string }).id),
            'en',
          ),
        );
      if (setFields.has(field))
        return values.sort((a, b) => String(a).localeCompare(String(b), 'en'));
      return values;
    }
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => a.localeCompare(b, 'en'))
          .map(([name, entry]) => [name, normalize(entry, name)]),
      );
    return item;
  };
  return normalize(value, key);
}

export function canonicalCatalog(value: readonly Game[]): string {
  return JSON.stringify(canonicalCatalogValue(value, 'games'));
}

export function catalogRevision(games: readonly Game[]): string {
  return createHash('sha256').update(canonicalCatalog(games)).digest('hex');
}
const legacyIds = new Set([
  'deep-rock',
  'valheim',
  'overcooked-2',
  'pummel-party',
  'dont-starve',
  'unrailed',
]);
interface LegacyRoomState {
  status: string;
  round: number;
  version: number;
  members: {
    voteGameId: string | null;
    ready: boolean;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

export async function readCatalog(connection: Queryable): Promise<Game[]> {
  const result = await connection.query<{ data: Game }>(
    "SELECT data FROM game_catalog ORDER BY data->>'name', id",
  );
  return result.rows.map((row) => row.data);
}

export async function seedCatalog(database: Database): Promise<void> {
  const errors = validateCatalog(catalog);
  if (errors.length)
    throw new Error(`Invalid shipped catalog:\n${errors.join('\n')}`);
  await database.transaction(async (connection) => {
    const params = catalog.flatMap((game) => [
      game.id,
      JSON.stringify(game),
      CATALOG_SEED_VERSION,
    ]);
    const rows = catalog.map((_, index) => {
      const start = index * 3;
      return `($${start + 1}, $${start + 2}::jsonb, $${start + 3})`;
    });
    await connection.query(
      `INSERT INTO game_catalog (id, data, seed_version)
       VALUES ${rows.join(', ')}
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data,
         seed_version = EXCLUDED.seed_version
       WHERE game_catalog.seed_version < EXCLUDED.seed_version`,
      params,
    );
    // Legacy rooms keep their six-game scope, but active choices must restart:
    // updated profile constraints and scoring can invalidate previous votes.
    // This runs once, because adding catalog removes the migration predicate.
    const legacyCatalog = (await readCatalog(connection)).filter((game) =>
      legacyIds.has(game.id),
    );
    const legacyRooms = await connection.query<{
      id: string;
      state: LegacyRoomState;
    }>("SELECT id, state FROM rooms WHERE NOT (state ? 'catalog') FOR UPDATE");
    for (const { id, state } of legacyRooms.rows) {
      if (state.status === 'voting' || state.status === 'confirmed') {
        state.status = 'collecting';
        state.round += 1;
        state.version += 1;
        state.winnerGameId = null;
        state.members = state.members.map((member) => ({
          ...member,
          voteGameId: null,
          ready: false,
        }));
      }
      state.catalog = legacyCatalog;
      await connection.query(
        'UPDATE rooms SET state = $2::jsonb WHERE id = $1',
        [id, JSON.stringify(state)],
      );
    }
  });
}
