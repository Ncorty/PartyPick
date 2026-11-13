import { describe, expect, it } from 'vitest';
import {
  catalog,
  normalizeCatalogSearch,
  validateCatalog,
} from '../src/index.js';

describe('shipped catalog', () => {
  it('contains at least 80 distinct, sourced PC sessions across party sizes and themes', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(80);
    expect(validateCatalog(catalog)).toEqual([]);
    for (const size of [2, 3, 4, 5, 8]) {
      expect(
        catalog.filter((game) =>
          game.profiles.some(
            (profile) =>
              size >= profile.minParty &&
              size <= profile.maxParty &&
              (!profile.allowedPartySizes ||
                profile.allowedPartySizes.includes(size)),
          ),
        ).length,
      ).toBeGreaterThanOrEqual(5);
    }
    for (const genre of [
      'shooter',
      'survival',
      'horror',
      'party',
      'puzzle',
      'strategy',
    ]) {
      expect(
        catalog.filter((game) => game.genres.some((tag) => tag === genre))
          .length,
      ).toBeGreaterThanOrEqual(5);
    }
    expect(
      catalog.filter(
        (game) =>
          game.genres.includes('racing') || game.genres.includes('sports'),
      ).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it('finds Russian aliases regardless of case, spacing or ё', () => {
    for (const [query, id] of [
      ['  КС ', 'cs2'],
      ['cS', 'cs2'],
      ['ДОТА', 'dota2'],
      ['ВАЛОРАНТ', 'valorant'],
      ['плейт ап', 'plateup'],
    ] as const) {
      expect(
        catalog.some(
          (game) =>
            game.id === id &&
            [game.name, ...(game.aliases ?? [])].some((name) =>
              normalizeCatalogSearch(name).includes(
                normalizeCatalogSearch(query),
              ),
            ),
        ),
      ).toBe(true);
    }
    expect(normalizeCatalogSearch('  Ёж  ')).toBe('еж');
  });

  it('rejects a duplicate alias, invalid party size, missing source and inconsistent time', () => {
    const copy = structuredClone(catalog.slice(0, 2));
    copy[1]!.aliases = [copy[0]!.aliases![0]!];
    copy[1]!.sourceUrl = 'http://example.test';
    copy[1]!.profiles[0]!.allowedPartySizes = [99];
    copy[1]!.profiles[0]!.playMinutes = 5;
    const errors = validateCatalog(copy).join('\n');
    expect(errors).toContain('duplicate alias');
    expect(errors).toContain('source must use https');
    expect(errors).toContain('invalid allowed party sizes');
    expect(errors).toContain('invalid editorial time budget');
  });
});
