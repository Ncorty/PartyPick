import { makeGame as g, makeProfile as p } from './factory.js';

export const puzzleCatalog = [
  g({
    id: 'it-takes-two',
    name: 'It Takes Two',
    aliases: ['ит тейкс ту'],
    genres: ['puzzle', 'party'],
    description:
      'Совместная онлайн-история строго для двоих; Friend’s Pass может помочь с доступом, но его наличие проверяют сами игроки.',
    sourceUrl: 'https://store.steampowered.com/app/1426210/',
    profiles: [
      p('story', 'История вдвоём', 'coop', 2, 2, 50, 10, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'a-way-out',
    name: 'A Way Out',
    aliases: ['эвей аут', 'а вей аут'],
    genres: ['puzzle'],
    description: 'Сюжетное совместное прохождение строго для двоих.',
    sourceUrl: 'https://store.steampowered.com/app/1222700/',
    profiles: [p('story', 'Побег вдвоём', 'coop', 2, 2, 50, 10)],
  }),
  g({
    id: 'split-fiction',
    name: 'Split Fiction',
    aliases: ['сплит фикшн'],
    genres: ['puzzle'],
    description: 'Совместное сетевое приключение строго для двоих.',
    sourceUrl: 'https://store.steampowered.com/app/2001120/',
    profiles: [p('story', 'История вдвоём', 'coop', 2, 2, 50, 10)],
  }),
  g({
    id: 'portal-2',
    name: 'Portal 2',
    aliases: ['портал 2'],
    genres: ['puzzle'],
    description: 'Отдельная сетевая кооперативная кампания для двоих.',
    sourceUrl: 'https://store.steampowered.com/app/620/',
    profiles: [
      p('coop', 'Кооперативная кампания', 'coop', 2, 2, 35, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'we-were-here-together',
    name: 'We Were Here Together',
    aliases: ['ви веа хир тугезер'],
    genres: ['puzzle'],
    description: 'Сетевая головоломка с разными ролями для двух игроков.',
    sourceUrl: 'https://store.steampowered.com/app/865360/',
    profiles: [p('story', 'Приключение вдвоём', 'coop', 2, 2, 45, 5)],
  }),
  g({
    id: 'we-were-here-forever',
    name: 'We Were Here Forever',
    aliases: ['ви веа хир форевер'],
    genres: ['puzzle'],
    description: 'Совместные онлайн-головоломки для двух игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1341290/',
    profiles: [p('story', 'Приключение вдвоём', 'coop', 2, 2, 45, 5)],
  }),
  g({
    id: 'escape-simulator',
    name: 'Escape Simulator',
    aliases: ['эскейп симулятор'],
    genres: ['puzzle'],
    description:
      'Встроенные комнаты разработчик рекомендует проходить в компании до трёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1435790/',
    profiles: [
      p('built-in', 'Встроенные комнаты', 'coop', 1, 3, 25, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'trine-5',
    name: 'Trine 5: A Clockwork Conspiracy',
    aliases: ['трин 5'],
    genres: ['puzzle', 'action'],
    description: 'Совместное сетевое приключение от одного до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1436700/',
    profiles: [
      p('story', 'Совместная история', 'coop', 1, 4, 40, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'trine-4',
    name: 'Trine 4: The Nightmare Prince',
    aliases: ['трин 4'],
    genres: ['puzzle', 'action'],
    description: 'Сетевые кооперативные уровни до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/690640/',
    profiles: [
      p('story', 'Совместные уровни', 'coop', 1, 4, 40, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'battleblock-theater',
    name: 'BattleBlock Theater',
    aliases: ['батлблок театр'],
    genres: ['puzzle', 'party'],
    description: 'Сетевая история для двоих или арена до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/238460/',
    profiles: [
      p('story', 'История вдвоём', 'coop', 2, 2, 30, 5, {
        intensity: 'relaxed',
      }),
      p('arena', 'Арена', 'competitive', 2, 4, 15, 5, { intensity: 'relaxed' }),
    ],
  }),
];
