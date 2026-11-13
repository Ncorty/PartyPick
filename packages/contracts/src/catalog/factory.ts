import type { Game, GameGenre, GameMode, GameProfile } from '../index.js';

export interface CatalogGameInput {
  id: string;
  name: string;
  aliases: string[];
  genres: GameGenre[];
  freeToPlay?: boolean;
  description: string;
  sourceUrl: string;
  profiles: GameProfile[];
}

export function makeProfile(
  id: string,
  name: string,
  mode: GameMode,
  minParty: number,
  maxParty: number,
  playMinutes: number,
  setupMinutes: number,
  options: Partial<
    Pick<
      GameProfile,
      'intensity' | 'teamSize' | 'allowsRandoms' | 'allowedPartySizes'
    >
  > = {},
): GameProfile {
  return {
    id,
    name,
    mode,
    minParty,
    maxParty,
    playMinutes,
    setupMinutes,
    estimatedMinutes: playMinutes + setupMinutes,
    intensity: options.intensity ?? 'focused',
    allowsRandoms: options.allowsRandoms ?? false,
    ...(options.teamSize === undefined ? {} : { teamSize: options.teamSize }),
    ...(options.allowedPartySizes === undefined
      ? {}
      : { allowedPartySizes: options.allowedPartySizes }),
  };
}

export function makeGame(input: CatalogGameInput): Game {
  return {
    ...input,
    freeToPlay: input.freeToPlay ?? false,
    verifiedAt: '2026-11-13',
    minPlayers: Math.min(...input.profiles.map((profile) => profile.minParty)),
    maxPlayers: Math.max(...input.profiles.map((profile) => profile.maxParty)),
    modes: [...new Set(input.profiles.map((profile) => profile.mode))],
    suggestedMinutes: Math.min(
      ...input.profiles.map((profile) => profile.estimatedMinutes),
    ),
  };
}
