import {
  catalog,
  type Game,
  type GameMatch,
  type GameProfile,
  type MatchingResult,
  type MatchReason,
  type RecoveryChange,
  type RecoveryGroupCode,
  type RecoveryPlan,
  type RoomMember,
} from '@partypick/contracts';

const reason = (
  code: MatchReason['code'],
  memberIds: string[] = [],
  params: MatchReason['params'] = {},
): MatchReason => ({ code, memberIds: [...memberIds].sort(), params });

function profileProblems(profile: GameProfile, members: readonly RoomMember[]) {
  const problems: MatchReason[] = [];
  const size = members.length;
  if (
    size < profile.minParty ||
    size > profile.maxParty ||
    (profile.allowedPartySizes && !profile.allowedPartySizes.includes(size))
  )
    problems.push(
      reason('player_count', [], {
        min: profile.minParty,
        max: profile.maxParty,
        profile: profile.name,
        ...(profile.allowedPartySizes
          ? { allowedSizes: profile.allowedPartySizes.join(', ') }
          : {}),
      }),
    );
  const modes = members.filter(
    (m) =>
      m.preferences!.mode !== 'any' && m.preferences!.mode !== profile.mode,
  );
  if (modes.length)
    problems.push(
      reason(
        'mode',
        modes.map((m) => m.id),
        { profile: profile.name },
      ),
    );
  const times = members.filter(
    (m) => m.preferences!.availableMinutes < profile.estimatedMinutes,
  );
  if (times.length)
    problems.push(
      reason(
        'time',
        times.map((m) => m.id),
        { suggestedMinutes: profile.estimatedMinutes, profile: profile.name },
      ),
    );
  const randomSlots = profile.allowsRandoms
    ? Math.max(0, (profile.teamSize ?? size) - size)
    : 0;
  const noRandoms = members.filter(
    (m) => m.preferences!.allowRandoms === false,
  );
  if (randomSlots && noRandoms.length)
    problems.push(
      reason(
        'randoms_required',
        noRandoms.map((m) => m.id),
        { slots: randomSlots, profile: profile.name },
      ),
    );
  return { problems, randomSlots };
}

function accessProblems(
  game: Game,
  members: readonly RoomMember[],
): MatchReason[] {
  const missing: string[] = [];
  const uninstalled: string[] = [];
  const veto: string[] = [];
  for (const member of members) {
    const choice = member.preferences!.games.find(
      (item) => item.gameId === game.id,
    );
    if (!choice?.owned) missing.push(member.id);
    else if (!choice.installed) uninstalled.push(member.id);
    if (choice?.taste === 'veto') veto.push(member.id);
  }
  return [
    ...(missing.length ? [reason('missing_ownership', missing)] : []),
    ...(uninstalled.length ? [reason('not_installed', uninstalled)] : []),
    ...(veto.length ? [reason('veto', veto)] : []),
  ];
}

function recoveryPlan(
  game: Game,
  profile: GameProfile,
  members: readonly RoomMember[],
  access: readonly MatchReason[],
): RecoveryPlan | null {
  if (
    access.some(
      (item) => item.code === 'missing_ownership' || item.code === 'veto',
    )
  )
    return null;
  if (
    profileProblems(profile, members).problems.some(
      (item) => item.code === 'player_count',
    )
  )
    return null;
  const changes: RecoveryChange[] = [];
  const changed = members.map((member) => {
    const preferences = member.preferences!;
    const choice = preferences.games.find((item) => item.gameId === game.id)!;
    const next = {
      ...preferences,
      games: preferences.games.map((item) => ({ ...item })),
    };
    if (!choice.installed) {
      changes.push({
        field: 'installed',
        memberId: member.id,
        gameId: game.id,
        from: false,
        to: true,
      });
      next.games.find((item) => item.gameId === game.id)!.installed = true;
    }
    if (preferences.availableMinutes < profile.estimatedMinutes) {
      changes.push({
        field: 'availableMinutes',
        memberId: member.id,
        from: preferences.availableMinutes,
        to: profile.estimatedMinutes,
      });
      next.availableMinutes = profile.estimatedMinutes;
    }
    if (preferences.mode !== 'any' && preferences.mode !== profile.mode) {
      changes.push({
        field: 'mode',
        memberId: member.id,
        from: preferences.mode,
        to: profile.mode,
      });
      next.mode = profile.mode;
    }
    const slots = profile.allowsRandoms
      ? Math.max(0, (profile.teamSize ?? members.length) - members.length)
      : 0;
    if (slots && preferences.allowRandoms === false) {
      changes.push({
        field: 'allowRandoms',
        memberId: member.id,
        from: false,
        to: true,
      });
      next.allowRandoms = true;
    }
    return { ...member, preferences: next };
  });
  if (!changes.length || accessProblems(game, changed).length) return null;
  const evaluated = profileProblems(profile, changed);
  if (evaluated.problems.length) return null;
  changes.sort(
    (a, b) =>
      a.memberId.localeCompare(b.memberId, 'en') ||
      a.field.localeCompare(b.field, 'en'),
  );
  return {
    gameId: game.id,
    profileId: profile.id,
    profileName: profile.name,
    estimatedMinutes: profile.estimatedMinutes,
    randomSlots: evaluated.randomSlots,
    mode: profile.mode,
    changes,
    warnings: [
      ...(evaluated.randomSlots
        ? [reason('random_fill', [], { slots: evaluated.randomSlots })]
        : []),
      ...(profile.mode === 'pvpve' ? [reason('pvp_risk')] : []),
    ],
  };
}

function comparePlans(a: RecoveryPlan, b: RecoveryPlan): number {
  const people = (plan: RecoveryPlan) =>
    new Set(plan.changes.map((change) => change.memberId)).size;
  const addedTime = (plan: RecoveryPlan) =>
    plan.changes.reduce(
      (sum, change) =>
        sum +
        (change.field === 'availableMinutes' ? change.to - change.from : 0),
      0,
    );
  return (
    people(a) - people(b) ||
    a.changes.length - b.changes.length ||
    addedTime(a) - addedTime(b) ||
    a.gameId.localeCompare(b.gameId, 'en') ||
    a.profileId.localeCompare(b.profileId, 'en')
  );
}

function rankProfile(
  game: Game,
  profile: GameProfile,
  members: readonly RoomMember[],
  randomSlots: number,
): GameMatch {
  const tastes = members.map((m) =>
    m.preferences!.games.find((choice) => choice.gameId === game.id)?.taste ===
    'want'
      ? 100
      : 60,
  );
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const genres = members.map((m) => {
    const requested = m.preferences!.genres ?? [];
    return !requested.length
      ? 5
      : game.genres.some((genre) => requested.includes(genre))
        ? 10
        : 0;
  });
  const styles = members.map((m) => {
    const style = m.preferences!.sessionStyle ?? 'any';
    return style === 'any' ? 5 : style === profile.intensity ? 10 : 0;
  });
  const scoreBreakdown = {
    preferences: Math.round(average(tastes) * 0.7),
    genreFit: Math.round(average(genres)),
    sessionFit: Math.round(average(styles)),
    partyFit: Math.round(
      (10 * members.length) / (members.length + randomSlots),
    ),
  };
  const warnings: MatchReason[] = [];
  if (randomSlots)
    warnings.push(reason('random_fill', [], { slots: randomSlots }));
  if (profile.mode === 'pvpve') warnings.push(reason('pvp_risk'));
  return {
    gameId: game.id,
    profileId: profile.id,
    profileName: profile.name,
    estimatedMinutes: profile.estimatedMinutes,
    randomSlots,
    scoreBreakdown,
    score: Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0),
    weakestScore: Math.min(...tastes),
    reasons: [
      reason('all_owned'),
      reason('all_installed'),
      reason('players_fit'),
      reason('time_fit', [], { suggestedMinutes: profile.estimatedMinutes }),
      reason('mode_fit'),
      reason('no_veto'),
      reason('preference_fit', [], {
        want: tastes.filter((value) => value === 100).length,
        total: members.length,
      }),
      ...(members.some((m) => m.preferences!.genres?.length)
        ? [reason('genre_fit', [], { points: scoreBreakdown.genreFit })]
        : []),
      ...(members.some(
        (m) =>
          m.preferences!.sessionStyle && m.preferences!.sessionStyle !== 'any',
      )
        ? [reason('session_fit', [], { points: scoreBreakdown.sessionFit })]
        : []),
    ],
    warnings,
  };
}

export function matchGames(
  members: readonly RoomMember[],
  games: readonly Game[] = catalog,
): MatchingResult {
  const pendingMemberIds = members
    .filter((m) => !m.preferences)
    .map((m) => m.id)
    .sort();
  if (!members.length || pendingMemberIds.length)
    return { status: 'pending', pendingMemberIds, eligible: [], excluded: [] };
  const result: MatchingResult = {
    status: 'ready',
    pendingMemberIds: [],
    eligible: [],
    excluded: [],
  };
  const groupGames = new Map<RecoveryGroupCode, Set<string>>();
  const groupMembers = new Map<RecoveryGroupCode, Set<string>>();
  const candidates: RecoveryPlan[] = [];
  const groupFor = (code: MatchReason['code']): RecoveryGroupCode | null => {
    if (code === 'player_count' || code === 'randoms_required') return 'party';
    if (
      code === 'missing_ownership' ||
      code === 'not_installed' ||
      code === 'veto' ||
      code === 'time' ||
      code === 'mode'
    )
      return code;
    return null;
  };
  for (const game of [...games].sort((a, b) =>
    a.id.localeCompare(b.id, 'en'),
  )) {
    const access = accessProblems(game, members);
    const profiles = game.profiles.map((profile) => ({
      profile,
      ...profileProblems(profile, members),
    }));
    const valid = profiles.filter((entry) => !entry.problems.length);
    if (access.length || !valid.length) {
      for (const item of [
        ...access,
        ...(!valid.length ? profiles.flatMap((entry) => entry.problems) : []),
      ]) {
        const group = groupFor(item.code);
        if (!group) continue;
        if (!groupGames.has(group)) groupGames.set(group, new Set());
        if (!groupMembers.has(group)) groupMembers.set(group, new Set());
        groupGames.get(group)!.add(game.id);
        for (const id of item.memberIds) groupMembers.get(group)!.add(id);
      }
      const plans = profiles
        .map(({ profile }) => recoveryPlan(game, profile, members, access))
        .filter((plan): plan is RecoveryPlan => !!plan)
        .sort(comparePlans);
      if (plans[0]) candidates.push(plans[0]);
      // Explain the closest single profile, never combine incompatible modes
      // or the duration of one mode with the party size of another.
      const closest = [...profiles].sort(
        (a, b) =>
          a.problems.length - b.problems.length ||
          a.profile.id.localeCompare(b.profile.id, 'en'),
      )[0];
      result.excluded.push({
        gameId: game.id,
        reasons: [
          ...access,
          ...(closest?.problems ?? [reason('player_count')]),
        ],
      });
      continue;
    }
    const ranked = valid.map(({ profile, randomSlots }) =>
      rankProfile(game, profile, members, randomSlots),
    );
    ranked.sort(
      (a, b) =>
        b.score - a.score ||
        a.randomSlots - b.randomSlots ||
        a.estimatedMinutes - b.estimatedMinutes ||
        a.profileId.localeCompare(b.profileId, 'en'),
    );
    result.eligible.push(ranked[0]!);
  }
  result.eligible.sort(
    (a, b) =>
      b.weakestScore - a.weakestScore ||
      b.score - a.score ||
      a.gameId.localeCompare(b.gameId, 'en'),
  );
  if (!result.eligible.length) {
    result.status = 'empty';
    result.emptyDiagnostics = {
      groups: (
        [
          'missing_ownership',
          'not_installed',
          'veto',
          'time',
          'mode',
          'party',
        ] as const
      )
        .filter((code) => groupGames.has(code))
        .map((code) => ({
          code,
          gameIds: [...groupGames.get(code)!].sort(),
          memberIds: [...groupMembers.get(code)!].sort(),
        })),
      plans: candidates.sort(comparePlans).slice(0, 3),
    };
  }
  return result;
}
