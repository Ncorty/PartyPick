import { describe, expect, it } from 'vitest';
import {
  catalog,
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
    const result = matchGames([host, guest]);
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
    expect(result.eligible.map((entry) => entry.gameId)).toEqual([
      'dont-starve',
      'pummel-party',
      'valheim',
    ]);
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
    ).toEqual(['host', 'guest']);
  });
});
