import Fastify, { LogController, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import {
  catalog,
  createRoomSchema,
  joinRoomSchema,
  updatePreferencesSchema,
  versionedSchema,
  roundSchema,
  voteSchema,
  readySchema,
  type RoomMember,
  type RoomSnapshot,
  type RoomStatus,
} from '@partypick/contracts';
import { matchGames } from '@partypick/matching';
import { openDatabase, type Database, type Queryable } from './db.js';

const COOKIE = 'partypick_session';
const DAY = 24 * 60 * 60 * 1000;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
interface InternalMember extends RoomMember {
  sessionHash: string;
}
interface Room {
  id: string;
  title: string;
  maxMembers: number;
  expiresAt: string;
  version: number;
  round: number;
  status: RoomStatus;
  hostMemberId: string;
  members: InternalMember[];
  winnerGameId: string | null;
  inviteToken: string;
}
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface AppOptions {
  dataDir?: string;
  databaseUrl?: string;
  publicOrigin?: string;
  logger?: boolean;
  now?: () => number;
}
export function buildApp(options: AppOptions = {}) {
  const now = options.now ?? Date.now;
  const production = process.env.NODE_ENV === 'production';
  const publicOrigin = options.publicOrigin ?? process.env.PUBLIC_ORIGIN;
  if (production && !publicOrigin)
    throw new Error('PUBLIC_ORIGIN is required in production');
  const origins = new Set(
    publicOrigin
      ? [new URL(publicOrigin).origin]
      : ['http://127.0.0.1:5173', 'http://localhost:5173'],
  );
  const hostnames = new Set(
    [...origins].map((origin) => new URL(origin).hostname),
  );
  const app = Fastify({
    logger: options.logger ?? true,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 65536,
  });
  let database: Database | undefined;
  const getDb = () => {
    if (!database) throw new Error('Database is not ready');
    return database;
  };

  app.register(cookie);
  app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      const hostname = request.hostname.startsWith('[')
        ? request.hostname
        : request.hostname.split(':')[0];
      if (
        !origin ||
        !origins.has(origin) ||
        !hostname ||
        !hostnames.has(hostname)
      ) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'Запрос должен поступать с адреса PartyPick.',
        );
      }
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError)
      return reply
        .code(error.status)
        .send({ error: { code: error.code, message: error.message } });
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Проверьте заполненные поля и полный список игр.',
        },
      });
    const nativeError = error as { statusCode?: number };
    if (nativeError.statusCode === 429)
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Слишком много запросов. Попробуйте чуть позже.',
        },
      });
    if (
      nativeError.statusCode &&
      nativeError.statusCode >= 400 &&
      nativeError.statusCode < 500
    )
      return reply.code(nativeError.statusCode).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Не удалось прочитать запрос.',
        },
      });
    // Do not log request URLs: invitation URLs carry bearer capabilities.
    app.log.error(
      { message: error instanceof Error ? error.name : 'UnknownError' },
      'Request failed',
    );
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
      },
    });
  });
  app.addHook('onReady', async () => {
    const dataDir =
      options.dataDir ??
      process.env.PGLITE_DATA_DIR ??
      fileURLToPath(new URL('../.data', import.meta.url));
    database = await openDatabase(
      dataDir,
      options.databaseUrl ?? process.env.DATABASE_URL,
    );
    await database.query('DELETE FROM guest_sessions WHERE expires_at < $1', [
      now(),
    ]);
    await database.query(
      "DELETE FROM rooms WHERE (state->>'expiresAt')::timestamptz < $1::timestamptz",
      [new Date(now()).toISOString()],
    );
  });
  app.addHook('onClose', async () => {
    await database?.close();
  });

  const currentSession = async (
    request: FastifyRequest,
  ): Promise<string | null> => {
    const token = request.cookies[COOKIE];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const tokenHash = hash(token);
    const result = await getDb().query(
      'SELECT token_hash FROM guest_sessions WHERE token_hash = $1 AND expires_at > $2',
      [tokenHash, now()],
    );
    return result.rows.length ? tokenHash : null;
  };
  const sessionOrThrow = async (request: FastifyRequest) => {
    const session = await currentSession(request);
    if (!session)
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Сессия не найдена. Войдите в комнату по приглашению.',
      );
    return session;
  };
  const ensureSession = async (
    request: FastifyRequest,
    reply: {
      setCookie: (name: string, value: string, options: object) => unknown;
    },
  ) => {
    const existing = await currentSession(request);
    if (existing) return existing;
    const token = randomBytes(32).toString('hex');
    const tokenHash = hash(token);
    await getDb().query(
      'INSERT INTO guest_sessions (token_hash, expires_at) VALUES ($1, $2)',
      [tokenHash, now() + 7 * DAY],
    );
    reply.setCookie(COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: production,
      maxAge: (7 * DAY) / 1000,
    });
    return tokenHash;
  };
  const ensureActive = (room: Room) => {
    if (Date.parse(room.expiresAt) <= now())
      throw new ApiError(
        410,
        'ROOM_EXPIRED',
        'Время жизни комнаты истекло. Создайте новую комнату.',
      );
  };
  const memberOf = (room: Room, session: string) => {
    const member = room.members.find((entry) => entry.sessionHash === session);
    if (!member)
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Вы не участник этой комнаты. Используйте ссылку-приглашение.',
      );
    return member;
  };
  const requireHost = (room: Room, member: InternalMember) => {
    if (room.hostMemberId !== member.id)
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Это действие доступно только ведущему.',
      );
  };
  const snapshot = (room: Room, session: string): RoomSnapshot => {
    const member = memberOf(room, session);
    return {
      id: room.id,
      title: room.title,
      maxMembers: room.maxMembers,
      expiresAt: room.expiresAt,
      version: room.version,
      round: room.round,
      status: room.status,
      hostMemberId: room.hostMemberId,
      viewerMemberId: member.id,
      members: room.members.map((entry) => ({
        id: entry.id,
        displayName: entry.displayName,
        preferences: entry.preferences,
        voteGameId: entry.voteGameId,
        ready: entry.ready,
      })),
      winnerGameId: room.winnerGameId,
      ...(member.id === room.hostMemberId
        ? { invitePath: '/join/' + room.inviteToken }
        : {}),
      matching: matchGames(room.members),
    };
  };
  const resetRound = (room: Room) => {
    room.round += 1;
    room.status = 'collecting';
    room.winnerGameId = null;
    for (const member of room.members) {
      member.voteGameId = null;
      member.ready = false;
    }
  };
  const findRoom = async (
    connection: Queryable,
    id: string,
    lock = false,
  ): Promise<Room> => {
    const result = await connection.query<{ state: Room }>(
      'SELECT state FROM rooms WHERE id = $1' + (lock ? ' FOR UPDATE' : ''),
      [id],
    );
    const room = result.rows[0]?.state;
    if (!room) throw new ApiError(404, 'NOT_FOUND', 'Комната не найдена.');
    return room;
  };
  const persist = async (connection: Queryable, room: Room) => {
    await connection.query('UPDATE rooms SET state = $2::jsonb WHERE id = $1', [
      room.id,
      JSON.stringify(room),
    ]);
  };
  const mutate = async (
    id: string,
    request: FastifyRequest,
    version: number,
    action: (room: Room, member: InternalMember) => void,
  ): Promise<RoomSnapshot> => {
    const session = await sessionOrThrow(request);
    return getDb().transaction(async (connection) => {
      const room = await findRoom(connection, id, true);
      ensureActive(room);
      const member = memberOf(room, session);
      if (room.version !== version)
        throw new ApiError(
          409,
          'CONFLICT',
          'Комната изменилась. Обновите данные и повторите действие.',
        );
      action(room, member);
      room.version += 1;
      await persist(connection, room);
      return snapshot(room, session);
    });
  };

  app.register(async (routes) => {
    routes.get('/api/health', async () => ({
      status: 'ok',
      service: 'partypick-api',
    }));
    routes.get('/api/catalog', async () => catalog);
    routes.post(
      '/api/rooms',
      { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const input = createRoomSchema.parse(request.body);
        const session = await ensureSession(request, reply);
        const memberId = randomUUID();
        const room: Room = {
          id: randomUUID(),
          title: input.title,
          maxMembers: input.maxMembers,
          expiresAt: new Date(now() + DAY).toISOString(),
          version: 1,
          round: 1,
          status: 'collecting',
          hostMemberId: memberId,
          winnerGameId: null,
          inviteToken: randomBytes(32).toString('hex'),
          members: [
            {
              id: memberId,
              displayName: input.displayName,
              sessionHash: session,
              preferences: null,
              voteGameId: null,
              ready: false,
            },
          ],
        };
        await getDb().query(
          'INSERT INTO rooms (id, invite_hash, state) VALUES ($1, $2, $3::jsonb)',
          [room.id, hash(room.inviteToken), JSON.stringify(room)],
        );
        return reply.code(201).send(snapshot(room, session));
      },
    );
    routes.get<{ Params: { token: string } }>(
      '/api/invites/:token',
      async (request) => {
        const result = await getDb().query<{ state: Room }>(
          'SELECT state FROM rooms WHERE invite_hash = $1',
          [hash(request.params.token)],
        );
        const room = result.rows[0]?.state;
        if (!room)
          throw new ApiError(404, 'NOT_FOUND', 'Приглашение не найдено.');
        ensureActive(room);
        return {
          title: room.title,
          memberCount: room.members.length,
          maxMembers: room.maxMembers,
          expiresAt: room.expiresAt,
        };
      },
    );
    routes.post<{ Params: { token: string } }>(
      '/api/invites/:token/join',
      { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const input = joinRoomSchema.parse(request.body);
        const session = await ensureSession(request, reply);
        return getDb().transaction(async (connection) => {
          const result = await connection.query<{ state: Room }>(
            'SELECT state FROM rooms WHERE invite_hash = $1 FOR UPDATE',
            [hash(request.params.token)],
          );
          const room = result.rows[0]?.state;
          if (!room)
            throw new ApiError(404, 'NOT_FOUND', 'Приглашение не найдено.');
          ensureActive(room);
          if (room.members.some((member) => member.sessionHash === session))
            return snapshot(room, session);
          if (room.members.length >= room.maxMembers)
            throw new ApiError(
              409,
              'ROOM_FULL',
              'В комнате больше нет свободных мест.',
            );
          room.members.push({
            id: randomUUID(),
            displayName: input.displayName,
            sessionHash: session,
            preferences: null,
            voteGameId: null,
            ready: false,
          });
          resetRound(room);
          room.version += 1;
          await persist(connection, room);
          return snapshot(room, session);
        });
      },
    );
    routes.get<{ Params: { id: string } }>(
      '/api/rooms/:id',
      { config: { rateLimit: { max: 1200, timeWindow: '1 minute' } } },
      async (request) => {
        const session = await sessionOrThrow(request);
        const room = await findRoom(getDb(), request.params.id);
        memberOf(room, session);
        ensureActive(room);
        return snapshot(room, session);
      },
    );
    routes.put<{ Params: { id: string } }>(
      '/api/rooms/:id/preferences',
      async (request) => {
        const input = updatePreferencesSchema.parse(request.body);
        return mutate(
          request.params.id,
          request,
          input.version,
          (room, member) => {
            if (room.status !== 'collecting') resetRound(room);
            member.preferences = input.preferences;
          },
        );
      },
    );
    routes.post<{ Params: { id: string } }>(
      '/api/rooms/:id/voting',
      async (request) => {
        const input = versionedSchema.parse(request.body);
        return mutate(
          request.params.id,
          request,
          input.version,
          (room, member) => {
            requireHost(room, member);
            if (room.status !== 'collecting')
              throw new ApiError(
                409,
                'INVALID_STATE',
                'Голосование уже началось или завершено.',
              );
            if (
              room.members.length < 2 ||
              room.members.some((entry) => !entry.preferences)
            )
              throw new ApiError(
                409,
                'NOT_READY',
                'Нужно минимум два участника и ответы каждого.',
              );
            if (!matchGames(room.members).eligible.length)
              throw new ApiError(
                409,
                'NO_MATCHES',
                'Подходящих игр нет. Обсудите и измените условия.',
              );
            room.status = 'voting';
          },
        );
      },
    );
    routes.put<{ Params: { id: string } }>(
      '/api/rooms/:id/vote',
      async (request) => {
        const input = voteSchema.parse(request.body);
        return mutate(
          request.params.id,
          request,
          input.version,
          (room, member) => {
            if (room.round !== input.round)
              throw new ApiError(
                409,
                'CONFLICT',
                'Раунд изменился. Проголосуйте заново.',
              );
            if (room.status !== 'voting')
              throw new ApiError(
                409,
                'INVALID_STATE',
                'Голосование сейчас закрыто.',
              );
            if (
              !matchGames(room.members).eligible.some(
                (game) => game.gameId === input.gameId,
              )
            )
              throw new ApiError(
                400,
                'VALIDATION_ERROR',
                'Этой игры нет среди подходящих вариантов.',
              );
            member.voteGameId = input.gameId;
          },
        );
      },
    );
    routes.post<{ Params: { id: string } }>(
      '/api/rooms/:id/finalize',
      async (request) => {
        const input = roundSchema.parse(request.body);
        return mutate(
          request.params.id,
          request,
          input.version,
          (room, member) => {
            requireHost(room, member);
            if (room.round !== input.round)
              throw new ApiError(409, 'CONFLICT', 'Раунд изменился.');
            if (room.status !== 'voting')
              throw new ApiError(
                409,
                'INVALID_STATE',
                'Голосование сейчас закрыто.',
              );
            if (room.members.some((entry) => !entry.voteGameId))
              throw new ApiError(
                409,
                'NOT_READY',
                'Дождитесь голосов всех участников.',
              );
            const counts = new Map<string, number>();
            for (const entry of room.members) {
              if (entry.voteGameId)
                counts.set(
                  entry.voteGameId,
                  (counts.get(entry.voteGameId) ?? 0) + 1,
                );
            }
            // Match order breaks equal vote counts by weakest preference, total score, ID.
            const candidates = matchGames(room.members).eligible;
            candidates.sort(
              (a, b) =>
                (counts.get(b.gameId) ?? 0) - (counts.get(a.gameId) ?? 0),
            );
            const winner = candidates[0];
            if (!winner)
              throw new ApiError(
                409,
                'NO_MATCHES',
                'Больше нет подходящих игр.',
              );
            room.winnerGameId = winner.gameId;
            room.status = 'confirmed';
            for (const entry of room.members) entry.ready = false;
          },
        );
      },
    );
    routes.put<{ Params: { id: string } }>(
      '/api/rooms/:id/ready',
      async (request) => {
        const input = readySchema.parse(request.body);
        return mutate(
          request.params.id,
          request,
          input.version,
          (room, member) => {
            if (room.round !== input.round)
              throw new ApiError(409, 'CONFLICT', 'Раунд изменился.');
            if (room.status !== 'confirmed')
              throw new ApiError(
                409,
                'INVALID_STATE',
                'Сначала выберите игру.',
              );
            member.ready = input.ready;
          },
        );
      },
    );
    routes.post<{ Params: { id: string } }>(
      '/api/rooms/:id/reopen',
      async (request) => {
        const input = versionedSchema.parse(request.body);
        return mutate(
          request.params.id,
          request,
          input.version,
          (room, member) => {
            requireHost(room, member);
            resetRound(room);
          },
        );
      },
    );
    routes.delete<{ Params: { id: string } }>(
      '/api/rooms/:id/membership',
      async (request) => {
        const input = versionedSchema.parse(request.body);
        const session = await sessionOrThrow(request);
        await getDb().transaction(async (connection) => {
          const room = await findRoom(connection, request.params.id, true);
          ensureActive(room);
          const member = memberOf(room, session);
          if (room.version !== input.version)
            throw new ApiError(
              409,
              'CONFLICT',
              'Комната изменилась. Обновите данные и повторите действие.',
            );
          if (member.id === room.hostMemberId)
            throw new ApiError(
              409,
              'INVALID_STATE',
              'Ведущий не может покинуть свою комнату.',
            );
          room.members = room.members.filter((entry) => entry.id !== member.id);
          resetRound(room);
          room.version += 1;
          await persist(connection, room);
        });
        return { left: true };
      },
    );
  });
  return app;
}
