import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  applyCatalogUpdateSchema,
  type CatalogFieldChange,
  type CatalogGameChange,
  type CatalogProfileChange,
  type CatalogUpdatePreview,
  type Game,
  gameGenres,
  type RoomSnapshot,
} from '@partypick/contracts';
import {
  canonicalCatalogValue,
  catalogRevision,
  readCatalog,
} from './catalog.js';
import type { Database, Queryable } from './db.js';
import { ApiError } from './errors.js';
import type { InternalMember, Room } from './app.js';

interface Dependencies {
  getDb: () => Database;
  now: () => number;
  sessionOrThrow: (request: FastifyRequest) => Promise<string>;
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

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const integer = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const modes = new Set(['coop', 'competitive', 'pvpve']);
const intensities = new Set(['relaxed', 'focused']);

/** Historical and manually edited records may omit provenance fields. */
export function validTargetCatalog(games: unknown): games is Game[] {
  if (!Array.isArray(games) || !games.length || games.length > 200)
    return false;
  const gameIds = new Set<string>();
  for (const game of games) {
    if (
      !record(game) ||
      !string(game.id) ||
      game.id.length > 64 ||
      gameIds.has(game.id) ||
      !string(game.name) ||
      !string(game.description) ||
      typeof game.freeToPlay !== 'boolean' ||
      !Array.isArray(game.genres) ||
      !game.genres.length ||
      new Set(game.genres).size !== game.genres.length ||
      !game.genres.every((genre) => gameGenres.includes(genre)) ||
      !Array.isArray(game.modes) ||
      !game.modes.length ||
      !game.modes.every((mode) => modes.has(mode)) ||
      !Array.isArray(game.profiles) ||
      !game.profiles.length ||
      (game.aliases !== undefined &&
        (!Array.isArray(game.aliases) || !game.aliases.every(string))) ||
      (game.sourceUrl !== undefined && !string(game.sourceUrl)) ||
      (game.verifiedAt !== undefined && !string(game.verifiedAt))
    )
      return false;
    gameIds.add(game.id);
    const profileIds = new Set<string>();
    for (const profile of game.profiles) {
      if (
        !record(profile) ||
        !string(profile.id) ||
        profileIds.has(profile.id) ||
        !string(profile.name) ||
        !modes.has(String(profile.mode)) ||
        !integer(profile.minParty, 1, 16) ||
        !integer(profile.maxParty, Number(profile.minParty), 16) ||
        !integer(profile.estimatedMinutes, 5, 240) ||
        !intensities.has(String(profile.intensity)) ||
        typeof profile.allowsRandoms !== 'boolean' ||
        (profile.teamSize !== undefined &&
          !integer(profile.teamSize, Number(profile.maxParty), 16)) ||
        (profile.allowedPartySizes !== undefined &&
          (!Array.isArray(profile.allowedPartySizes) ||
            !profile.allowedPartySizes.length ||
            new Set(profile.allowedPartySizes).size !==
              profile.allowedPartySizes.length ||
            !profile.allowedPartySizes.every((size) =>
              integer(size, Number(profile.minParty), Number(profile.maxParty)),
            ))) ||
        (profile.allowsRandoms &&
          !integer(profile.teamSize, Number(profile.minParty) + 1, 16)) ||
        (profile.playMinutes === undefined) !==
          (profile.setupMinutes === undefined) ||
        (profile.playMinutes !== undefined &&
          !integer(profile.playMinutes, 1, 240)) ||
        (profile.setupMinutes !== undefined &&
          !integer(profile.setupMinutes, 0, 240)) ||
        (profile.playMinutes !== undefined &&
          profile.setupMinutes !== undefined &&
          Number(profile.playMinutes) + Number(profile.setupMinutes) !==
            profile.estimatedMinutes)
      )
        return false;
      profileIds.add(profile.id);
    }
    const profiles = game.profiles as Game['profiles'];
    if (
      game.minPlayers !==
        Math.min(...profiles.map((profile) => profile.minParty)) ||
      game.maxPlayers !==
        Math.max(...profiles.map((profile) => profile.maxParty)) ||
      game.suggestedMinutes !==
        Math.min(...profiles.map((profile) => profile.estimatedMinutes)) ||
      new Set(game.modes).size !== game.modes.length ||
      game.modes.length !==
        new Set(profiles.map((profile) => profile.mode)).size ||
      game.modes.some(
        (mode) => !profiles.some((profile) => profile.mode === mode),
      )
    )
      return false;
  }
  return true;
}

function display(value: unknown): string {
  if (value === undefined) return 'не указано';
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (Array.isArray(value)) return value.join(', ');
  if (record(value)) return 'изменены';
  return String(value);
}
function fieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  omit: string[],
): CatalogFieldChange[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => !omit.includes(field))
    .sort()
    .filter(
      (field) =>
        JSON.stringify(canonicalCatalogValue(before[field], field)) !==
        JSON.stringify(canonicalCatalogValue(after[field], field)),
    )
    .map((field) => ({
      field,
      before: display(before[field]),
      after: display(after[field]),
    }));
}
function profileChanges(
  before: Game['profiles'],
  after: Game['profiles'],
): CatalogProfileChange[] {
  const previous = new Map(before.map((profile) => [profile.id, profile]));
  const next = new Map(after.map((profile) => [profile.id, profile]));
  return [...new Set([...previous.keys(), ...next.keys()])]
    .sort()
    .flatMap((profileId): CatalogProfileChange[] => {
      const old = previous.get(profileId),
        current = next.get(profileId);
      if (!old)
        return [
          {
            profileId,
            name: current!.name,
            kind: 'added' as const,
            fields: [],
          },
        ];
      if (!current)
        return [
          { profileId, name: old.name, kind: 'removed' as const, fields: [] },
        ];
      const fields = fieldChanges(
        old as unknown as Record<string, unknown>,
        current as unknown as Record<string, unknown>,
        ['id'],
      );
      return fields.length
        ? [{ profileId, name: current.name, kind: 'changed' as const, fields }]
        : [];
    });
}
export function diffCatalog(
  before: Game[],
  after: Game[],
): CatalogGameChange[] {
  const previous = new Map(before.map((game) => [game.id, game]));
  const next = new Map(after.map((game) => [game.id, game]));
  return [...new Set([...previous.keys(), ...next.keys()])]
    .sort()
    .flatMap((gameId): CatalogGameChange[] => {
      const old = previous.get(gameId),
        current = next.get(gameId);
      if (!old)
        return [
          {
            gameId,
            name: current!.name,
            kind: 'added' as const,
            fields: [],
            profiles: [],
          },
        ];
      if (!current)
        return [
          {
            gameId,
            name: old.name,
            kind: 'removed' as const,
            fields: [],
            profiles: [],
          },
        ];
      const fields = fieldChanges(
        old as unknown as Record<string, unknown>,
        current as unknown as Record<string, unknown>,
        ['id', 'profiles'],
      );
      const profiles = profileChanges(old.profiles, current.profiles);
      return fields.length || profiles.length
        ? [
            {
              gameId,
              name: current.name,
              kind: 'changed' as const,
              fields,
              profiles,
            },
          ]
        : [];
    });
}

export function registerCatalogUpdateRoutes(
  app: FastifyInstance,
  deps: Dependencies,
): void {
  const target = async (connection: Queryable) => {
    const games = await readCatalog(connection);
    if (!validTargetCatalog(games))
      throw new ApiError(
        409,
        'INVALID_CATALOG',
        'Новый каталог пуст или содержит некорректные игры. Обновление недоступно.',
      );
    return { games, revision: catalogRevision(games) };
  };
  const authorizedRoom = async (
    connection: Queryable,
    id: string,
    session: string,
    lock: boolean,
  ) => {
    const room = await deps.findRoom(connection, id, lock);
    deps.ensureActive(room);
    deps.requireHost(room, deps.memberOf(room, session));
    if (
      room.matchingRulesVersion !== undefined &&
      room.matchingRulesVersion !== 1
    )
      throw new ApiError(
        409,
        'UNSUPPORTED_RULES',
        'Версия правил этой комнаты пока не поддерживается.',
      );
    return room;
  };
  app.get<{ Params: { id: string } }>(
    '/api/rooms/:id/catalog-update',
    async (request): Promise<CatalogUpdatePreview> => {
      const session = await deps.sessionOrThrow(request);
      const room = await authorizedRoom(
        deps.getDb(),
        request.params.id,
        session,
        false,
      );
      const next = await target(deps.getDb());
      return {
        roomVersion: room.version,
        currentRevision: room.catalogRevision ?? catalogRevision(room.catalog),
        targetRevision: next.revision,
        currentRulesVersion: room.matchingRulesVersion ?? 1,
        targetRulesVersion: 1,
        changes: diffCatalog(room.catalog, next.games),
      };
    },
  );
  app.post<{ Params: { id: string } }>(
    '/api/rooms/:id/catalog-update',
    async (request) => {
      const input = applyCatalogUpdateSchema.parse(request.body);
      const session = await deps.sessionOrThrow(request);
      return deps.getDb().transaction(async (connection) => {
        // Multi-aggregate order is session → room, matching library operations.
        const sessionRow = await connection.query<{
          expires_at: string | number;
        }>(
          'SELECT expires_at FROM guest_sessions WHERE token_hash = $1 FOR UPDATE',
          [session],
        );
        if (Number(sessionRow.rows[0]?.expires_at ?? 0) <= deps.now())
          throw new ApiError(
            403,
            'SESSION_EXPIRED',
            'Гостевая сессия истекла.',
          );
        const room = await authorizedRoom(
          connection,
          request.params.id,
          session,
          true,
        );
        if (room.version !== input.version)
          throw new ApiError(
            409,
            'CONFLICT',
            'Комната изменилась. Обновите предпросмотр каталога.',
          );
        const next = await target(connection); // Exactly one SELECT; apply this same read.
        if (next.revision !== input.targetRevision)
          throw new ApiError(
            409,
            'CONFLICT',
            'Каталог изменился. Обновите предпросмотр.',
          );
        if (
          next.revision ===
          (room.catalogRevision ?? catalogRevision(room.catalog))
        )
          return deps.snapshot(room, session);
        const ids = new Set(next.games.map((game) => game.id));
        for (const member of room.members) {
          if (member.preferences)
            member.preferences = {
              ...member.preferences,
              games: member.preferences.games.filter((choice) =>
                ids.has(choice.gameId),
              ),
            };
        }
        room.catalog = next.games;
        room.catalogRevision = next.revision;
        room.matchingRulesVersion = 1;
        deps.resetRound(room);
        room.version += 1;
        await deps.persist(connection, room);
        return deps.snapshot(room, session);
      });
    },
  );
}
