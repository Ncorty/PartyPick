import { catalog, type Game } from '@partypick/contracts';
import type { Database, Queryable } from './db.js';

export const CATALOG_SEED_VERSION = 2;
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
  await database.transaction(async (connection) => {
    for (const game of catalog) {
      await connection.query(
        `INSERT INTO game_catalog (id, data, seed_version)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data,
           seed_version = EXCLUDED.seed_version
         WHERE game_catalog.seed_version < EXCLUDED.seed_version`,
        [game.id, JSON.stringify(game), CATALOG_SEED_VERSION],
      );
    }
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
