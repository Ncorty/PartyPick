import { makeGame as g, makeProfile as p } from './factory.js';

export const strategyCatalog = [
  g({
    id: 'aoe-4',
    name: 'Age of Empires IV',
    aliases: ['аое 4', 'эйдж оф эмпайрс 4'],
    genres: ['strategy'],
    description:
      'Сетевая пользовательская стратегия до восьми игроков в одной партии.',
    sourceUrl:
      'https://www.ageofempires.com/news/age-of-empires-iv-achievements-revealed/',
    profiles: [
      p('custom', 'Пользовательский матч', 'competitive', 2, 8, 50, 10),
    ],
  }),
  g({
    id: 'northgard',
    name: 'Northgard',
    aliases: ['нортгард'],
    genres: ['strategy'],
    description:
      'Сетевая свободная партия до восьми игроков; команда 4×4 — отдельный вариант.',
    sourceUrl:
      'https://store.steampowered.com/news/posts/?appids=466560&enddate=1530036048',
    profiles: [
      p('free-for-all', 'Свободная партия', 'competitive', 2, 8, 40, 10),
    ],
  }),
  g({
    id: 'stellaris',
    name: 'Stellaris',
    aliases: ['стелларис'],
    genres: ['strategy', 'sandbox'],
    description:
      'Сетевая партия с отдельной империей у каждого. Профиль ограничен восемью участниками комнаты; игра поддерживает больше.',
    sourceUrl:
      'https://store.steampowered.com/news/posts/?appids=281990&enddate=1457343741&feed=steam_community_announcements',
    profiles: [p('empires', 'Отдельные империи', 'competitive', 2, 8, 90, 10)],
  }),
  g({
    id: 'factorio',
    name: 'Factorio',
    aliases: ['факторио'],
    genres: ['strategy', 'sandbox'],
    description:
      'Совместная фабрика на частном сервере. Профиль ограничен восемью участниками комнаты; лимит сервера настраивается.',
    sourceUrl: 'https://wiki.factorio.com/Multiplayer',
    profiles: [
      p('factory', 'Совместная фабрика', 'coop', 1, 8, 50, 10, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'tabletop-simulator',
    name: 'Tabletop Simulator',
    aliases: ['тейблтоп симулятор', 'настольный симулятор'],
    genres: ['board', 'strategy'],
    description:
      'Встроенные шахматы для двух либо покерный стол до восьми участников; Workshop и моды не нужны.',
    sourceUrl: 'https://store.steampowered.com/app/286160/',
    profiles: [
      p('chess', 'Встроенные шахматы', 'competitive', 2, 2, 30, 5, {
        intensity: 'relaxed',
      }),
      p('poker', 'Встроенный покер', 'competitive', 2, 8, 35, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'for-the-king',
    name: 'For The King',
    aliases: ['фор зе кинг'],
    genres: ['strategy', 'board'],
    description: 'Сетевая совместная партия до трёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/527230/',
    profiles: [p('adventure', 'Совместное приключение', 'coop', 1, 3, 50, 10)],
  }),
  g({
    id: 'for-the-king-2',
    name: 'For The King II',
    aliases: ['фор зе кинг 2'],
    genres: ['strategy', 'board'],
    description: 'Сетевое совместное приключение до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1676840/',
    profiles: [p('adventure', 'Совместное приключение', 'coop', 1, 4, 50, 10)],
  }),
  g({
    id: 'across-obelisk',
    name: 'Across the Obelisk',
    aliases: ['экрос зе обелиск'],
    genres: ['strategy', 'board'],
    description: 'Карточное сетевое приключение для двух–четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1385380/',
    profiles: [p('run', 'Совместное приключение', 'coop', 2, 4, 50, 10)],
  }),
  g({
    id: 'divinity-os-2',
    name: 'Divinity: Original Sin 2',
    aliases: ['дивинити 2'],
    genres: ['strategy'],
    description: 'Совместное сетевое прохождение кампании до четырёх игроков.',
    sourceUrl:
      'https://cdn.akamai.steamstatic.com/steam/apps/435150/manuals/DOS2_Game_Manual.pdf',
    profiles: [p('campaign', 'Совместная кампания', 'coop', 1, 4, 50, 10)],
  }),
  g({
    id: 'baldurs-gate-3',
    name: 'Baldur’s Gate 3',
    aliases: ['балдурс гейт 3', 'бг3'],
    genres: ['strategy'],
    description: 'Совместное сетевое прохождение кампании до четырёх игроков.',
    sourceUrl: 'https://baldursgate3.game/about/',
    profiles: [p('campaign', 'Совместная кампания', 'coop', 1, 4, 50, 10)],
  }),
];
