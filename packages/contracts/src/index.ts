import { z } from 'zod';

export type GameMode = 'coop' | 'competitive';
export type Taste = 'want' | 'okay' | 'veto';
export interface Game {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  modes: GameMode[];
  suggestedMinutes: number;
  description: string;
  sourceUrl: string;
}

// Durations are editorial session estimates, never guarantees or full campaign lengths.
export const catalog: Game[] = [
  {
    id: 'deep-rock',
    name: 'Deep Rock Galactic',
    minPlayers: 1,
    maxPlayers: 4,
    modes: ['coop'],
    suggestedMinutes: 30,
    description: 'Совместная вылазка космических дворфов.',
    sourceUrl: 'https://store.steampowered.com/app/548430/',
  },
  {
    id: 'valheim',
    name: 'Valheim',
    minPlayers: 1,
    maxPlayers: 10,
    modes: ['coop'],
    suggestedMinutes: 60,
    description: 'Исследование и строительство в мире викингов.',
    sourceUrl: 'https://store.steampowered.com/app/892970/',
  },
  {
    id: 'overcooked-2',
    name: 'Overcooked! 2',
    minPlayers: 2,
    maxPlayers: 4,
    modes: ['coop', 'competitive'],
    suggestedMinutes: 20,
    description: 'Хаос на кухне: совместные и соревновательные режимы.',
    sourceUrl: 'https://store.steampowered.com/app/728880/',
  },
  {
    id: 'pummel-party',
    name: 'Pummel Party',
    minPlayers: 2,
    maxPlayers: 8,
    modes: ['competitive'],
    suggestedMinutes: 60,
    description:
      'Настольная вечеринка и мини-игры. Для небольшой компании можно добавить ботов.',
    sourceUrl: 'https://store.steampowered.com/app/880940/',
  },
  {
    id: 'dont-starve',
    name: "Don't Starve Together",
    minPlayers: 2,
    maxPlayers: 6,
    modes: ['coop'],
    suggestedMinutes: 45,
    description:
      'Совместное выживание. В каталоге выбран профиль мира на 6 игроков; настройки выделенных серверов не учитываются.',
    sourceUrl: 'https://store.steampowered.com/app/322330/',
  },
  {
    id: 'unrailed',
    name: 'Unrailed!',
    minPlayers: 2,
    maxPlayers: 4,
    modes: ['coop', 'competitive'],
    suggestedMinutes: 20,
    description: 'Стройте железную дорогу, пока поезд движется.',
    sourceUrl: 'https://store.steampowered.com/app/1016920/',
  },
];

export const gameChoiceSchema = z
  .strictObject({
    gameId: z.enum(catalog.map((game) => game.id) as [string, ...string[]]),
    owned: z.boolean(),
    installed: z.boolean(),
    taste: z.enum(['want', 'okay', 'veto']),
  })
  .refine(
    (value) => !value.installed || value.owned,
    'Установленная игра должна быть доступна участнику',
  );

export const preferencesSchema = z
  .strictObject({
    availableMinutes: z.number().int().min(15).max(240),
    mode: z.enum(['any', 'coop', 'competitive']),
    games: z.array(gameChoiceSchema).length(catalog.length),
  })
  .refine(
    (value) =>
      new Set(value.games.map((game) => game.gameId)).size === catalog.length,
    'Укажите каждую игру каталога ровно один раз',
  );
export type Preferences = z.infer<typeof preferencesSchema>;
export type GameChoice = z.infer<typeof gameChoiceSchema>;

export interface RoomMember {
  id: string;
  displayName: string;
  preferences: Preferences | null;
  voteGameId: string | null;
  ready: boolean;
}
export type RoomStatus = 'collecting' | 'voting' | 'confirmed';
export type ReasonCode =
  | 'all_owned'
  | 'all_installed'
  | 'players_fit'
  | 'time_fit'
  | 'mode_fit'
  | 'no_veto'
  | 'player_count'
  | 'missing_ownership'
  | 'not_installed'
  | 'veto'
  | 'mode'
  | 'time';
export interface MatchReason {
  code: ReasonCode;
  memberIds: string[];
  params: Record<string, string | number>;
}
export interface GameMatch {
  gameId: string;
  score: number;
  weakestScore: number;
  reasons: MatchReason[];
}
export interface ExcludedGame {
  gameId: string;
  reasons: MatchReason[];
}
export interface MatchingResult {
  status: 'pending' | 'ready' | 'empty';
  pendingMemberIds: string[];
  eligible: GameMatch[];
  excluded: ExcludedGame[];
}
export interface RoomSnapshot {
  id: string;
  title: string;
  maxMembers: number;
  expiresAt: string;
  version: number;
  round: number;
  status: RoomStatus;
  hostMemberId: string;
  viewerMemberId: string;
  members: RoomMember[];
  winnerGameId: string | null;
  invitePath?: string;
  matching: MatchingResult;
}
export interface InviteInfo {
  title: string;
  memberCount: number;
  maxMembers: number;
  expiresAt: string;
}
export interface ApiErrorBody {
  error: { code: string; message: string };
}

const versionSchema = z.number().int().positive();
export const createRoomSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(24),
  title: z.string().trim().min(3).max(60),
  maxMembers: z.number().int().min(2).max(8),
});
export const joinRoomSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(24),
});
export const updatePreferencesSchema = z.strictObject({
  version: versionSchema,
  preferences: preferencesSchema,
});
export const versionedSchema = z.strictObject({ version: versionSchema });
export const roundSchema = z.strictObject({
  version: versionSchema,
  round: z.number().int().positive(),
});
export const voteSchema = roundSchema.extend({
  gameId: z.string().min(1).max(64),
});
export const readySchema = roundSchema.extend({ ready: z.boolean() });

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
