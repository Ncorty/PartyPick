import { gameGenres, type Game } from '../index.js';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeCatalogSearch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Validates shipped catalog data. Historical room snapshots are intentionally not passed here. */
export function validateCatalog(games: readonly Game[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const names = new Map<string, string>();
  const aliases = new Map<string, string>();
  for (const game of games) {
    const path = game.id || '<missing-id>';
    if (!idPattern.test(game.id) || game.id.length > 64)
      errors.push(`${path}: invalid id`);
    if (ids.has(game.id)) errors.push(`${path}: duplicate id`);
    ids.add(game.id);
    if (!game.name.trim() || !game.description.trim())
      errors.push(`${path}: missing name or description`);
    const name = normalizeCatalogSearch(game.name);
    if (names.has(name))
      errors.push(`${path}: duplicate name with ${names.get(name)}`);
    names.set(name, path);
    if (!game.aliases?.length) errors.push(`${path}: missing aliases`);
    for (const alias of game.aliases ?? []) {
      const key = normalizeCatalogSearch(alias);
      if (!key) errors.push(`${path}: blank alias`);
      const previous = aliases.get(key);
      if (previous)
        errors.push(
          `${path}: duplicate alias '${alias}'${previous === path ? '' : ` also belongs to ${previous}`}`,
        );
      aliases.set(key, path);
    }
    if (
      !game.verifiedAt ||
      !isoDate.test(game.verifiedAt) ||
      Number.isNaN(Date.parse(game.verifiedAt))
    )
      errors.push(`${path}: invalid verification date`);
    try {
      const source = new URL(game.sourceUrl);
      if (source.protocol !== 'https:')
        errors.push(`${path}: source must use https`);
    } catch {
      errors.push(`${path}: invalid source URL`);
    }
    if (
      !game.genres.length ||
      new Set(game.genres).size !== game.genres.length ||
      game.genres.some((genre) => !gameGenres.includes(genre))
    )
      errors.push(`${path}: invalid genres`);
    if (!game.profiles.length) errors.push(`${path}: no profiles`);
    const profileIds = new Set<string>();
    for (const profile of game.profiles) {
      const pp = `${path}/${profile.id}`;
      if (!idPattern.test(profile.id) || profileIds.has(profile.id))
        errors.push(`${pp}: invalid or duplicate profile id`);
      profileIds.add(profile.id);
      if (
        !profile.name.trim() ||
        !['coop', 'competitive', 'pvpve'].includes(profile.mode)
      )
        errors.push(`${pp}: missing name or invalid mode`);
      if (
        !Number.isInteger(profile.minParty) ||
        !Number.isInteger(profile.maxParty) ||
        profile.minParty < 1 ||
        profile.maxParty > 16 ||
        profile.minParty > profile.maxParty
      )
        errors.push(`${pp}: invalid party bounds`);
      if (
        profile.allowedPartySizes &&
        (!profile.allowedPartySizes.length ||
          new Set(profile.allowedPartySizes).size !==
            profile.allowedPartySizes.length ||
          profile.allowedPartySizes.some(
            (size) =>
              !Number.isInteger(size) ||
              size < profile.minParty ||
              size > profile.maxParty,
          ))
      )
        errors.push(`${pp}: invalid allowed party sizes`);
      if (
        profile.teamSize !== undefined &&
        (!Number.isInteger(profile.teamSize) ||
          profile.teamSize < profile.maxParty ||
          profile.teamSize > 16)
      )
        errors.push(`${pp}: invalid team size`);
      if (
        profile.allowsRandoms &&
        (profile.teamSize === undefined || profile.teamSize <= profile.minParty)
      )
        errors.push(`${pp}: random fill has no team slots`);
      if (
        !Number.isInteger(profile.estimatedMinutes) ||
        profile.estimatedMinutes < 5 ||
        profile.estimatedMinutes > 240 ||
        !Number.isInteger(profile.playMinutes) ||
        !Number.isInteger(profile.setupMinutes) ||
        (profile.playMinutes ?? 0) < 1 ||
        (profile.setupMinutes ?? 0) < 0 ||
        (profile.playMinutes ?? 0) + (profile.setupMinutes ?? 0) !==
          profile.estimatedMinutes
      )
        errors.push(`${pp}: invalid editorial time budget`);
      if (!['focused', 'relaxed'].includes(profile.intensity))
        errors.push(`${pp}: invalid intensity`);
    }
    if (
      game.profiles.length &&
      (game.minPlayers !==
        Math.min(...game.profiles.map((profile) => profile.minParty)) ||
        game.maxPlayers !==
          Math.max(...game.profiles.map((profile) => profile.maxParty)) ||
        game.suggestedMinutes !==
          Math.min(
            ...game.profiles.map((profile) => profile.estimatedMinutes),
          ) ||
        new Set(game.modes).size !== game.modes.length ||
        game.modes.length !==
          new Set(game.profiles.map((profile) => profile.mode)).size ||
        game.modes.some(
          (mode) => !game.profiles.some((profile) => profile.mode === mode),
        ))
    )
      errors.push(`${path}: inconsistent derived fields`);
  }
  for (const [name, owner] of names) {
    const aliasOwner = aliases.get(name);
    if (aliasOwner && aliasOwner !== owner)
      errors.push(`${owner}: name conflicts with alias of ${aliasOwner}`);
  }
  return errors;
}
