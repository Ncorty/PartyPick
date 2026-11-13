import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  applyLibrarySchema,
  applyLibraryToPreferences,
  patchLibrarySchema,
  type LibraryEntry,
  type LibrarySnapshot,
  type RoomSnapshot,
} from '@partypick/contracts';
import { readCatalog } from './catalog.js';
import type { Database, Queryable } from './db.js';
import { ApiError } from './errors.js';
import type { InternalMember, Room } from './app.js';

interface Dependencies {
  getDb: () => Database;
  now: () => number;
  sessionOrThrow: (request: FastifyRequest) => Promise<string>;
  ensureSession: (
    request: FastifyRequest,
    reply: {
      setCookie: (name: string, value: string, options: object) => unknown;
    },
  ) => Promise<string>;
  findRoom: (
    connection: Queryable,
    id: string,
    lock?: boolean,
  ) => Promise<Room>;
  ensureActive: (room: Room) => void;
  memberOf: (room: Room, session: string) => InternalMember;
  requireHost: (room: Room, member: InternalMember) => void;
  snapshot: (room: Room, session: string) => RoomSnapshot;
  resetRound: (room: Room) => void;
  persist: (connection: Queryable, room: Room) => Promise<void>;
}
interface SessionRow extends Record<string, unknown> {
  expires_at: string | number;
}
interface LibraryRow extends Record<string, unknown> {
  version: number;
  entries: LibraryEntry[];
  updated_at: string | number;
}

function toSnapshot(
  row: LibraryRow | undefined,
  expiresAt: number,
): LibrarySnapshot {
  return {
    version: row?.version ?? 0,
    entries: row?.entries ?? [],
    updatedAt: row ? new Date(Number(row.updated_at)).toISOString() : null,
    sessionExpiresAt: new Date(expiresAt).toISOString(),
  };
}

export function registerLibraryRoutes(
  app: FastifyInstance,
  deps: Dependencies,
): void {
  const activeSession = async (
    connection: Queryable,
    hash: string,
    lock: boolean,
  ) => {
    const result = await connection.query<SessionRow>(
      `SELECT expires_at FROM guest_sessions WHERE token_hash = $1${lock ? ' FOR UPDATE' : ''}`,
      [hash],
    );
    const expiresAt = Number(result.rows[0]?.expires_at ?? 0);
    if (expiresAt <= deps.now())
      throw new ApiError(
        403,
        'SESSION_EXPIRED',
        'Гостевая сессия истекла. Начните новую сессию.',
      );
    return expiresAt;
  };
  const readLibrary = async (
    connection: Queryable,
    hash: string,
    lock = false,
  ) => {
    const result = await connection.query<LibraryRow>(
      `SELECT version, entries, updated_at FROM guest_libraries WHERE session_hash = $1${lock ? ' FOR UPDATE' : ''}`,
      [hash],
    );
    return result.rows[0];
  };

  app.post(
    '/api/guest-session',
    { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const session = await deps.ensureSession(request, reply);
      const expiresAt = await activeSession(deps.getDb(), session, false);
      return { expiresAt: new Date(expiresAt).toISOString() };
    },
  );

  app.get('/api/me/library', async (request) => {
    const session = await deps.sessionOrThrow(request);
    const expiresAt = await activeSession(deps.getDb(), session, false);
    return toSnapshot(await readLibrary(deps.getDb(), session), expiresAt);
  });

  app.patch('/api/me/library', async (request) => {
    const input = patchLibrarySchema.parse(request.body);
    const session = await deps.sessionOrThrow(request);
    return deps.getDb().transaction(async (connection) => {
      const expiresAt = await activeSession(connection, session, true);
      const previous = await readLibrary(connection, session, true);
      if ((previous?.version ?? 0) !== input.version)
        throw new ApiError(
          409,
          'CONFLICT',
          'Библиотека изменилась в другой вкладке.',
        );
      const catalog = await readCatalog(connection);
      const ids = new Set(catalog.map((game) => game.id));
      if (input.changes.some((change) => !ids.has(change.gameId)))
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Выберите игры из каталога.',
        );
      const entries = new Map(
        (previous?.entries ?? []).map((entry) => [
          entry.gameId,
          entry.availability,
        ]),
      );
      for (const change of input.changes) {
        if (change.availability === 'unknown') entries.delete(change.gameId);
        else entries.set(change.gameId, change.availability);
      }
      const nextEntries: LibraryEntry[] = [...entries]
        .map(([gameId, availability]) => ({ gameId, availability }))
        .sort((a, b) => a.gameId.localeCompare(b.gameId));
      const oldEntries = [...(previous?.entries ?? [])].sort((a, b) =>
        a.gameId.localeCompare(b.gameId),
      );
      if (JSON.stringify(nextEntries) === JSON.stringify(oldEntries))
        return toSnapshot(previous, expiresAt);
      const version = (previous?.version ?? 0) + 1;
      const updatedAt = deps.now();
      await connection.query(
        `INSERT INTO guest_libraries (session_hash, version, entries, updated_at)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (session_hash) DO UPDATE SET version = EXCLUDED.version,
         entries = EXCLUDED.entries, updated_at = EXCLUDED.updated_at`,
        [session, version, JSON.stringify(nextEntries), updatedAt],
      );
      return toSnapshot(
        { version, entries: nextEntries, updated_at: updatedAt },
        expiresAt,
      );
    });
  });

  app.post<{ Params: { id: string } }>(
    '/api/rooms/:id/apply-library',
    async (request) => {
      const input = applyLibrarySchema.parse(request.body);
      const session = await deps.sessionOrThrow(request);
      return deps.getDb().transaction(async (connection) => {
        // Every operation that locks more than one aggregate uses session → library → room.
        await activeSession(connection, session, true);
        const library = await readLibrary(connection, session, true);
        const room = await deps.findRoom(connection, request.params.id, true);
        deps.ensureActive(room);
        const member = deps.memberOf(room, session);
        deps.requireHost(room, member);
        if (
          room.version !== input.version ||
          (library?.version ?? 0) !== input.libraryVersion
        )
          throw new ApiError(
            409,
            'CONFLICT',
            'Комната или библиотека изменились. Обновите данные.',
          );
        if (room.status === 'collecting')
          throw new ApiError(
            409,
            'INVALID_STATE',
            'Сейчас подставьте библиотеку в пожелания и сохраните их.',
          );
        if (!member.preferences)
          throw new ApiError(
            409,
            'INVALID_STATE',
            'Сначала сохраните свои пожелания.',
          );
        const roomIds = new Set(room.catalog.map((game) => game.id));
        const applicable = (library?.entries ?? []).filter((entry) =>
          roomIds.has(entry.gameId),
        );
        const next = applyLibraryToPreferences(member.preferences, applicable);
        const oldGames = new Map(
          member.preferences.games.map((game) => [game.gameId, game]),
        );
        if (
          !next.games.some((game) => {
            const old = oldGames.get(game.gameId);
            return (
              game.owned !== (old?.owned ?? false) ||
              game.installed !== (old?.installed ?? false)
            );
          })
        )
          return deps.snapshot(room, session);
        member.preferences = next;
        deps.resetRound(room);
        room.version += 1;
        await deps.persist(connection, room);
        return deps.snapshot(room, session);
      });
    },
  );
}
