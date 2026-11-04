import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

type Row = Record<string, unknown>;
export interface Queryable {
  query<T extends Row = Row>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends Queryable {
  transaction<T>(run: (database: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function openDatabase(
  dataDir: string,
  databaseUrl?: string,
): Promise<Database> {
  let database: Database;
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
    database = {
      query: async <T extends Row>(text: string, values: unknown[] = []) => {
        const result = await pool.query<T>(text, values);
        return { rows: result.rows };
      },
      transaction: async <T>(run: (connection: Queryable) => Promise<T>) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await run({
            query: async <R extends Row>(
              text: string,
              values: unknown[] = [],
            ) => ({ rows: (await client.query<R>(text, values)).rows }),
          });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    const client = new PGlite(dataDir);
    await client.waitReady;
    database = {
      query: async <T extends Row>(text: string, values: unknown[] = []) => ({
        rows: (await client.query<T>(text, values)).rows,
      }),
      transaction: async <T>(run: (connection: Queryable) => Promise<T>) =>
        client.transaction(async (transaction) =>
          run({
            query: async <R extends Row>(
              text: string,
              values: unknown[] = [],
            ) => ({ rows: (await transaction.query<R>(text, values)).rows }),
          }),
        ),
      close: () => client.close(),
    };
  }
  // Idempotent initial migration. Keeping the migration in compiled code makes
  // source and dist launch modes use the same schema without path assumptions.
  try {
    await database.query(`CREATE TABLE IF NOT EXISTS guest_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at BIGINT NOT NULL
  )`);
    await database.query(`CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    invite_hash TEXT NOT NULL UNIQUE,
    state JSONB NOT NULL
  )`);
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}
