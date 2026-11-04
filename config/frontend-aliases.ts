import { fileURLToPath } from 'node:url';

const sourceRoot = new URL('../apps/web/src/', import.meta.url);

export const frontendAliases = Object.fromEntries(
  Object.entries({
    '@': '.',
    '@app': 'app',
    '@pages': 'pages',
    '@widgets': 'widgets',
    '@features': 'features',
    '@entities': 'entities',
    '@shares': 'shared',
  }).map(([alias, directory]) => [
    alias,
    fileURLToPath(new URL(directory, sourceRoot)),
  ]),
);
