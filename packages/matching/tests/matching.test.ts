import { describe, expect, it } from 'vitest';
import {
  catalog,
  preferencesSchema,
  type Preferences,
  type RoomMember,
} from '@partypick/contracts';
import { matchGames } from '../src/index.js';

const preferences = (): Preferences => ({
  availableMinutes: 120,
  mode: 'any',
  games: catalog.map((game) => ({
    gameId: game.id,
    owned: true,
    installed: true,
    taste: 'okay',
  })),
});
const member = (id: string): RoomMember => ({
  id,
  displayName: id,
  preferences: preferences(),
  voteGameId: null,
  ready: false,
});
describe('matching rules', () => {
  it('does not imply approval when a member has not answered', () => {
    const result = matchGames([
      member('host'),
      { ...member('guest'), preferences: null },
    ]);
    expect(result.status).toBe('pending');
    expect(result.pendingMemberIds).toEqual(['guest']);
    expect(result.eligible).toEqual([]);
  });
  it('explains player limits, missing ownership, installation, veto, mode and time', () => {
    const host = member('host');
    host.preferences!.mode = 'competitive';
    host.preferences!.availableMinutes = 15;
    host.preferences!.games[0] = {
      gameId: 'deep-rock',
      owned: false,
      installed: false,
      taste: 'veto',
    };
    const guest = member('guest');
    guest.preferences!.games[0] = {
      gameId: 'deep-rock',
      owned: true,
      installed: false,
      taste: 'okay',
    };
    const result = matchGames(
      [host, guest],
      catalog.filter((game) => game.id === 'deep-rock'),
    );
    const reasons = result.excluded.find(
      (game) => game.gameId === 'deep-rock',
    )!.reasons;
    expect(reasons.map((reason) => reason.code)).toEqual([
      'missing_ownership',
      'not_installed',
      'veto',
      'mode',
      'time',
    ]);
    expect(
      reasons.find((reason) => reason.code === 'missing_ownership')!.memberIds,
    ).toEqual(['host']);
    expect(result.status).toBe('empty');
  });
  it('never recommends a four-player game to five people', () => {
    const result = matchGames(
      Array.from({ length: 5 }, (_, index) => member(String(index))),
    );
    expect(result.eligible.map((entry) => entry.gameId)).toEqual(
      expect.arrayContaining([
        'dont-starve',
        'pummel-party',
        'valheim',
        'cs2',
        'valorant',
        'dota2',
        'overwatch',
      ]),
    );
    expect(result.excluded.map((entry) => entry.gameId)).toEqual(
      expect.arrayContaining(['deep-rock', 'arc-raiders', 'rocket-league']),
    );
  });
  it('ranks the least unhappy participant ahead of a larger total and breaks ties stably', () => {
    const host = member('host'),
      guest = member('guest');
    host.preferences!.games.find(
      (choice) => choice.gameId === 'valheim',
    )!.taste = 'want';
    guest.preferences!.games.find(
      (choice) => choice.gameId === 'valheim',
    )!.taste = 'want';
    const result = matchGames([host, guest]);
    expect(result.eligible[0]!.gameId).toBe('valheim');
    expect(matchGames([guest, host])).toEqual(result);
  });
  it('does not mutate participant answers', () => {
    const members = [member('host'), member('guest')];
    const before = structuredClone(members);
    matchGames(members);
    expect(members).toEqual(before);
  });
  it('does not mistake support for two modes for agreement on one mode', () => {
    const host = member('host'),
      guest = member('guest');
    host.preferences!.mode = 'coop';
    guest.preferences!.mode = 'competitive';
    const result = matchGames([host, guest]);
    expect(result.status).toBe('empty');
    const multiModeGame = result.excluded.find(
      (game) => game.gameId === 'overcooked-2',
    );
    expect(
      multiModeGame!.reasons.find((reason) => reason.code === 'mode')!
        .memberIds,
    ).toEqual(['guest']);
  });
});

const only = (...ids: string[]) =>
  catalog.filter((game) => ids.includes(game.id));
const group = (count: number) =>
  Array.from({ length: count }, (_, index) => member(String(index)));

describe('session-aware recommendations', () => {
  it('selects a real short mode instead of using another mode duration', () => {
    const people = group(2);
    people.forEach((person) => {
      person.preferences!.availableMinutes = 25;
    });
    const result = matchGames(people, only('valorant', 'dota2', 'cs2'));
    expect(
      result.eligible.map((entry) => [entry.gameId, entry.profileId]),
    ).toEqual([['valorant', 'swiftplay']]);
    expect(result.eligible[0]!.randomSlots).toBe(3);
  });
  it('requires unanimous consent to fill a team, but keeps a complete duo', () => {
    const people = group(2);
    people[0]!.preferences!.allowRandoms = false;
    const result = matchGames(people, only('valorant', 'cs2', 'arc-raiders'));
    expect(result.eligible.map((entry) => entry.gameId)).toEqual(
      expect.arrayContaining(['cs2', 'arc-raiders']),
    );
    expect(
      result.eligible.find((entry) => entry.gameId === 'cs2')!.profileId,
    ).toBe('wingman');
    expect(result.excluded[0]!.reasons).toContainEqual(
      expect.objectContaining({ code: 'randoms_required', memberIds: ['0'] }),
    );
  });
  it('accepts a complete five stack without randoms and never a six stack', () => {
    const five = group(5);
    five.forEach((person) => {
      person.preferences!.allowRandoms = false;
    });
    expect(
      matchGames(five, only('cs2', 'valorant', 'dota2', 'overwatch')).eligible,
    ).toHaveLength(4);
    expect(
      matchGames(group(6), only('cs2', 'valorant', 'dota2', 'overwatch'))
        .eligible,
    ).toEqual([]);
  });
  it('does not apply ranked restrictions to the supported unranked Valorant profile', () => {
    const four = group(4);
    expect(matchGames(four, only('valorant')).eligible[0]!.profileId).toBe(
      'swiftplay',
    );
    four[0]!.preferences!.allowRandoms = false;
    expect(matchGames(four, only('valorant')).status).toBe('empty');
  });
  it('handles explicit forbidden party sizes on a profile', () => {
    const game = structuredClone(only('valorant')[0]!);
    game.profiles = [{ ...game.profiles[0]!, allowedPartySizes: [1, 2, 3, 5] }];
    expect(matchGames(group(4), [game]).excluded[0]!.reasons).toContainEqual(
      expect.objectContaining({ code: 'player_count' }),
    );
  });
  it('distinguishes PvPvE from safe cooperative play and warns about other players', () => {
    const people = group(2);
    people[0]!.preferences!.mode = 'coop';
    expect(matchGames(people, only('arc-raiders')).status).toBe('empty');
    people[0]!.preferences!.mode = 'pvpve';
    expect(
      matchGames(people, only('arc-raiders')).eligible[0]!.warnings,
    ).toContainEqual(expect.objectContaining({ code: 'pvp_risk' }));
    expect(matchGames(group(4), only('arc-raiders')).status).toBe('empty');
  });
  it('uses genre and session style as transparent soft signals', () => {
    const people = group(2);
    people.forEach((person) => {
      person.preferences!.genres = ['moba'];
      person.preferences!.sessionStyle = 'focused';
    });
    const result = matchGames(people, only('dota2', 'valorant'));
    expect(result.eligible[0]!.gameId).toBe('dota2');
    expect(result.eligible[0]!.profileId).toBe('all-pick');
    expect(result.eligible[0]!.scoreBreakdown.genreFit).toBe(10);
    expect(result.eligible).toHaveLength(2);
  });
  it('never lets a high soft score override a veto or missing access for a free game', () => {
    const people = group(2);
    people[0]!.preferences!.games.find(
      (choice) => choice.gameId === 'valorant',
    )!.taste = 'veto';
    people[1]!.preferences!.games = [];
    const result = matchGames(people, only('valorant'));
    expect(result.eligible).toEqual([]);
    expect(result.excluded[0]!.reasons.map((item) => item.code)).toEqual(
      expect.arrayContaining(['veto', 'missing_ownership']),
    );
  });
  it('ranks unanimous enthusiasm above a higher soft score for a divided group', () => {
    const people = group(3);
    for (const person of people) {
      person.preferences!.games.find(
        (choice) => choice.gameId === 'valheim',
      )!.taste = 'want';
      person.preferences!.genres = ['shooter'];
    }
    people[0]!.preferences!.games.find(
      (choice) => choice.gameId === 'cs2',
    )!.taste = 'want';
    expect(matchGames(people, only('valheim', 'cs2')).eligible[0]!.gameId).toBe(
      'valheim',
    );
  });
  it('is invariant to participant, catalog and profile order', () => {
    const people = group(3);
    const games = structuredClone(catalog).reverse();
    games.forEach((game) => game.profiles.reverse());
    expect(matchGames([...people].reverse(), games)).toEqual(
      matchGames(people, catalog),
    );
    for (const entry of matchGames(people).eligible) {
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(100);
      expect(entry.score).toBe(
        Object.values(entry.scoreBreakdown).reduce(
          (sum, value) => sum + value,
          0,
        ),
      );
    }
  });
  it('preserves sparse legacy answers and rejects duplicates without binding schemas to the seed', () => {
    const sparse = {
      availableMinutes: 60,
      mode: 'any',
      games: [
        { gameId: 'deep-rock', owned: true, installed: true, taste: 'okay' },
      ],
    };
    expect(preferencesSchema.safeParse(sparse).success).toBe(true);
    expect(
      preferencesSchema.safeParse({
        ...sparse,
        games: [...sparse.games, ...sparse.games],
      }).success,
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({
        ...sparse,
        games: [{ ...sparse.games[0], owned: false }],
      }).success,
    ).toBe(false);
  });
  it('has consistent unique catalog profiles with bounded session estimates', () => {
    expect(new Set(catalog.map((game) => game.id)).size).toBe(catalog.length);
    for (const game of catalog) {
      expect(game.profiles.length).toBeGreaterThan(0);
      expect(new Set(game.profiles.map((profile) => profile.id)).size).toBe(
        game.profiles.length,
      );
      expect(game.maxPlayers).toBe(
        Math.max(...game.profiles.map((profile) => profile.maxParty)),
      );
      for (const profile of game.profiles) {
        expect(profile.maxParty).toBeGreaterThanOrEqual(profile.minParty);
        if (profile.teamSize)
          expect(profile.teamSize).toBeGreaterThanOrEqual(profile.maxParty);
      }
    }
  });
});
