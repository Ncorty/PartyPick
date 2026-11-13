import type { Game } from './index.js';
import { legacyCatalog } from './catalog/legacy.js';
import { cooperativeCatalog } from './catalog/cooperative.js';
import { survivalCatalog } from './catalog/survival.js';
import { horrorCatalog } from './catalog/horror.js';
import { partyCatalog } from './catalog/party.js';
import { puzzleCatalog } from './catalog/puzzle.js';
import { strategyCatalog } from './catalog/strategy.js';
import { racingCatalog } from './catalog/racing.js';

export { normalizeCatalogSearch, validateCatalog } from './catalog/validate.js';

export const catalog: Game[] = [
  ...legacyCatalog,
  ...cooperativeCatalog,
  ...survivalCatalog,
  ...horrorCatalog,
  ...partyCatalog,
  ...puzzleCatalog,
  ...strategyCatalog,
  ...racingCatalog,
];
