import { z } from 'zod';

export type GameMode = 'coop' | 'competitive' | 'pvpve';
export const gameGenres = [
  'shooter',
  'action',
  'moba',
  'survival',
  'party',
  'sandbox',
  'racing',
  'sports',
  'horror',
  'strategy',
  'puzzle',
  'board',
] as const;
export type GameGenre = (typeof gameGenres)[number];
export type Taste = 'want' | 'okay' | 'veto';
export interface GameProfile {
  id: string;
  name: string;
  mode: GameMode;
  minParty: number;
  maxParty: number;
  allowedPartySizes?: number[];
  teamSize?: number;
  estimatedMinutes: number;
  playMinutes?: number;
  setupMinutes?: number;
  intensity: 'relaxed' | 'focused';
  allowsRandoms: boolean;
}
export interface Game {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  modes: GameMode[];
  suggestedMinutes: number;
  description: string;
  sourceUrl: string;
  aliases?: string[];
  verifiedAt?: string;
  genres: GameGenre[];
  freeToPlay: boolean;
  profiles: GameProfile[];
}
export { catalog, normalizeCatalogSearch, validateCatalog } from './catalog.js';
export {
  availabilitySchema,
  libraryChangeSchema,
  patchLibrarySchema,
  applyLibrarySchema,
  applyAvailability,
  applyLibraryToPreferences,
} from './library.js';
export type {
  Availability,
  KnownAvailability,
  LibraryEntry,
  LibrarySnapshot,
} from './library.js';

export const gameChoiceSchema = z
  .strictObject({
    gameId: z.string().min(1).max(64),
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
    mode: z.enum(['any', 'coop', 'competitive', 'pvpve']),
    allowRandoms: z.boolean().optional(),
    sessionStyle: z.enum(['any', 'relaxed', 'focused']).optional(),
    genres: z
      .array(z.enum(gameGenres))
      .max(gameGenres.length)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    games: z.array(gameChoiceSchema).max(200),
  })
  .refine(
    (value) =>
      new Set(value.games.map((game) => game.gameId)).size ===
      value.games.length,
    'Не повторяйте игры в списке',
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
  | 'time'
  | 'randoms_required'
  | 'random_fill'
  | 'pvp_risk'
  | 'genre_fit'
  | 'session_fit'
  | 'preference_fit';
export interface MatchReason {
  code: ReasonCode;
  memberIds: string[];
  params: Record<string, string | number>;
}
export interface GameMatch {
  gameId: string;
  score: number;
  weakestScore: number;
  profileId: string;
  profileName: string;
  estimatedMinutes: number;
  randomSlots: number;
  scoreBreakdown: {
    preferences: number;
    genreFit: number;
    sessionFit: number;
    partyFit: number;
  };
  warnings: MatchReason[];
  reasons: MatchReason[];
}
export interface ExcludedGame {
  gameId: string;
  reasons: MatchReason[];
}
export type RecoveryGroupCode =
  'missing_ownership' | 'not_installed' | 'veto' | 'time' | 'mode' | 'party';
export interface RecoveryGroup {
  code: RecoveryGroupCode;
  gameIds: string[];
  memberIds: string[];
}
export type RecoveryChange =
  | { field: 'availableMinutes'; memberId: string; from: number; to: number }
  | { field: 'mode'; memberId: string; from: Preferences['mode']; to: GameMode }
  | { field: 'allowRandoms'; memberId: string; from: false; to: true }
  | {
      field: 'installed';
      memberId: string;
      gameId: string;
      from: false;
      to: true;
    };
export interface RecoveryPlan {
  gameId: string;
  profileId: string;
  profileName: string;
  estimatedMinutes: number;
  randomSlots: number;
  mode: GameMode;
  changes: RecoveryChange[];
  warnings: MatchReason[];
}
export interface EmptyDiagnostics {
  groups: RecoveryGroup[];
  plans: RecoveryPlan[];
}
export interface MatchingResult {
  status: 'pending' | 'ready' | 'empty';
  pendingMemberIds: string[];
  eligible: GameMatch[];
  excluded: ExcludedGame[];
  emptyDiagnostics?: EmptyDiagnostics;
}
export interface RoomSnapshot {
  catalog: Game[];
  catalogRevision: string;
  matchingRulesVersion: 1;
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
export interface CatalogFieldChange {
  field: string;
  before: string;
  after: string;
}
export interface CatalogProfileChange {
  profileId: string;
  name: string;
  kind: 'added' | 'removed' | 'changed';
  fields: CatalogFieldChange[];
}
export interface CatalogGameChange {
  gameId: string;
  name: string;
  kind: 'added' | 'removed' | 'changed';
  fields: CatalogFieldChange[];
  profiles: CatalogProfileChange[];
}
export interface CatalogUpdatePreview {
  roomVersion: number;
  currentRevision: string;
  targetRevision: string;
  currentRulesVersion: number;
  targetRulesVersion: 1;
  changes: CatalogGameChange[];
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
export const applyCatalogUpdateSchema = z.strictObject({
  version: versionSchema,
  targetRevision: z.string().regex(/^[a-f0-9]{64}$/),
  confirmReset: z.literal(true),
});
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
