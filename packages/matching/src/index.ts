import {
  catalog,
  type Game,
  type MatchingResult,
  type MatchReason,
  type RoomMember,
} from '@partypick/contracts';

export function matchGames(
  members: readonly RoomMember[],
  games: readonly Game[] = catalog,
): MatchingResult {
  const pendingMemberIds = members
    .filter((member) => !member.preferences)
    .map((member) => member.id);
  if (!members.length || pendingMemberIds.length)
    return { status: 'pending', pendingMemberIds, eligible: [], excluded: [] };
  const result: MatchingResult = {
    status: 'ready',
    pendingMemberIds: [],
    eligible: [],
    excluded: [],
  };
  const requestedModes = new Set(
    members
      .map((member) => member.preferences!.mode)
      .filter((mode) => mode !== 'any'),
  );
  for (const game of games) {
    const reasons: MatchReason[] = [];
    const add = (
      code: MatchReason['code'],
      ids: string[] = [],
      params: MatchReason['params'] = {},
    ) => reasons.push({ code, memberIds: ids, params });
    if (members.length < game.minPlayers || members.length > game.maxPlayers)
      add('player_count', [], { min: game.minPlayers, max: game.maxPlayers });
    const unavailable: string[] = [],
      uninstalled: string[] = [],
      veto: string[] = [],
      modes: string[] = [],
      times: string[] = [];
    const scores: number[] = [];
    for (const member of members) {
      const prefs = member.preferences!;
      const choice = prefs.games.find((entry) => entry.gameId === game.id);
      if (!choice?.owned) unavailable.push(member.id);
      else if (!choice.installed) uninstalled.push(member.id);
      if (choice?.taste === 'veto') veto.push(member.id);
      if (
        prefs.mode !== 'any' &&
        (requestedModes.size > 1 || !game.modes.includes(prefs.mode))
      )
        modes.push(member.id);
      if (prefs.availableMinutes < game.suggestedMinutes) times.push(member.id);
      scores.push(choice?.taste === 'want' ? 2 : 1);
    }
    if (unavailable.length) add('missing_ownership', unavailable);
    if (uninstalled.length) add('not_installed', uninstalled);
    if (veto.length) add('veto', veto);
    if (modes.length) add('mode', modes);
    if (times.length)
      add('time', times, { suggestedMinutes: game.suggestedMinutes });
    if (reasons.length) result.excluded.push({ gameId: game.id, reasons });
    else
      result.eligible.push({
        gameId: game.id,
        score: scores.reduce((sum, score) => sum + score, 0),
        weakestScore: Math.min(...scores),
        reasons: [
          'all_owned',
          'all_installed',
          'players_fit',
          'time_fit',
          'mode_fit',
          'no_veto',
        ].map((code) => ({
          code: code as MatchReason['code'],
          memberIds: [],
          params: {},
        })),
      });
  }
  result.eligible.sort(
    (a, b) =>
      b.weakestScore - a.weakestScore ||
      b.score - a.score ||
      a.gameId.localeCompare(b.gameId, 'en'),
  );
  if (!result.eligible.length) result.status = 'empty';
  return result;
}
