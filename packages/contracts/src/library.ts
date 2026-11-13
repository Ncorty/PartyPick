import { z } from 'zod';
import type { GameChoice, Preferences } from './index.js';

export const availabilitySchema = z.enum([
  'unknown',
  'unavailable',
  'available',
  'installed',
]);
export type Availability = z.infer<typeof availabilitySchema>;
export type KnownAvailability = Exclude<Availability, 'unknown'>;
export interface LibraryEntry {
  gameId: string;
  availability: KnownAvailability;
}
export interface LibrarySnapshot {
  version: number;
  entries: LibraryEntry[];
  updatedAt: string | null;
  sessionExpiresAt: string;
}
export const libraryChangeSchema = z.strictObject({
  gameId: z.string().min(1).max(64),
  availability: availabilitySchema,
});
export const patchLibrarySchema = z.strictObject({
  version: z.number().int().nonnegative(),
  changes: z
    .array(libraryChangeSchema)
    .max(200)
    .refine(
      (changes) =>
        new Set(changes.map((change) => change.gameId)).size === changes.length,
      'Не повторяйте игры в списке',
    ),
});
export const applyLibrarySchema = z.strictObject({
  version: z.number().int().positive(),
  libraryVersion: z.number().int().nonnegative(),
  resetRound: z.literal(true),
});

export function applyAvailability(
  games: GameChoice[],
  entries: LibraryEntry[],
): GameChoice[] {
  const byId = new Map(games.map((game) => [game.gameId, game]));
  for (const entry of entries) {
    const previous = byId.get(entry.gameId);
    if (!previous && entry.availability === 'unavailable') continue;
    const owned = entry.availability !== 'unavailable';
    const installed = entry.availability === 'installed';
    if (previous?.owned === owned && previous.installed === installed) continue;
    byId.set(entry.gameId, {
      gameId: entry.gameId,
      owned,
      installed,
      taste: previous?.taste ?? 'okay',
    });
  }
  return [...byId.values()];
}

export function applyLibraryToPreferences(
  preferences: Preferences,
  entries: LibraryEntry[],
): Preferences {
  return {
    ...preferences,
    games: applyAvailability(preferences.games, entries),
  };
}
