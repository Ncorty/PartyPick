import { makeGame as g, makeProfile as p } from './factory.js';

/** PC online cooperative modes; source links point to the publisher's Steam page unless specified. */
export const cooperativeCatalog = [
  g({
    id: 'payday-2',
    name: 'PAYDAY 2',
    aliases: ['пейдей 2'],
    genres: ['shooter'],
    description: 'Ограбление в сетевом отряде до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/218620/',
    profiles: [p('heist', 'Ограбление', 'coop', 1, 4, 35, 10)],
  }),
  g({
    id: 'payday-3',
    name: 'PAYDAY 3',
    aliases: ['пейдей 3'],
    genres: ['shooter'],
    description: 'Ограбление в сетевом отряде от одного до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1272080/',
    profiles: [p('heist', 'Ограбление', 'coop', 1, 4, 35, 10)],
  }),
  g({
    id: 'killing-floor-2',
    name: 'Killing Floor 2',
    aliases: ['киллинг флор 2'],
    genres: ['shooter', 'horror'],
    description:
      'Совместное отражение волн, до шести игроков. PvP-режим не включён.',
    sourceUrl: 'https://store.steampowered.com/app/232090/',
    profiles: [p('survival', 'Кооперативное выживание', 'coop', 1, 6, 30, 5)],
  }),
  g({
    id: 'vermintide-2',
    name: 'Warhammer: Vermintide 2',
    aliases: ['верминтайд 2'],
    genres: ['shooter'],
    description: 'Кооперативная вылазка с тремя друзьями.',
    sourceUrl: 'https://store.steampowered.com/app/552500/',
    profiles: [p('mission', 'Совместная вылазка', 'coop', 1, 4, 35, 10)],
  }),
  g({
    id: 'risk-of-rain-2',
    name: 'Risk of Rain 2',
    aliases: ['риск оф рейн 2', 'рор 2'],
    genres: ['shooter'],
    description:
      'Сетевой кооператив до четырёх игроков; продолжительность забега зависит от группы.',
    sourceUrl: 'https://store.steampowered.com/app/632360/',
    profiles: [p('run', 'Совместный забег', 'coop', 1, 4, 45, 5)],
  }),
  g({
    id: 'gunfire-reborn',
    name: 'Gunfire Reborn',
    aliases: ['ганфаер реборн'],
    genres: ['shooter'],
    description: 'Процедурные уровни в кооперативе до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1217060/',
    profiles: [p('run', 'Совместный забег', 'coop', 1, 4, 35, 5)],
  }),
  g({
    id: 'roboquest',
    name: 'Roboquest',
    aliases: ['робоквест'],
    genres: ['shooter'],
    description: 'Быстрый сетевой забег вдвоём.',
    sourceUrl: 'https://store.steampowered.com/app/692890/',
    profiles: [p('run', 'Забег вдвоём', 'coop', 2, 2, 30, 5)],
  }),
  g({
    id: 'borderlands-2',
    name: 'Borderlands 2',
    aliases: ['бордерлендс 2'],
    genres: ['shooter'],
    description: 'Совместная сюжетная вылазка до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/49520/',
    profiles: [p('story', 'Совместное задание', 'coop', 1, 4, 45, 5)],
  }),
  g({
    id: 'remnant-2',
    name: 'REMNANT II',
    aliases: ['ремнант 2'],
    genres: ['shooter', 'horror'],
    description: 'Совместное прохождение с двумя друзьями.',
    sourceUrl: 'https://store.steampowered.com/app/1282100/',
    profiles: [p('story', 'Совместное прохождение', 'coop', 1, 3, 45, 10)],
  }),
  g({
    id: 'sea-of-thieves',
    name: 'Sea of Thieves',
    aliases: ['си оф сивс', 'море воров'],
    genres: ['sandbox', 'survival'],
    description:
      'Совместное плавание на шлюпе, бригантине или галеоне. Встречаются другие команды.',
    sourceUrl: 'https://www.seaofthieves.com/sail-together',
    profiles: [
      p('sloop', 'Шлюп', 'pvpve', 1, 2, 45, 10, { intensity: 'relaxed' }),
      p('brigantine', 'Бригантина', 'pvpve', 2, 3, 45, 10, {
        intensity: 'relaxed',
      }),
      p('galleon', 'Галеон', 'pvpve', 4, 4, 45, 10, { intensity: 'relaxed' }),
    ],
  }),
  g({
    id: 'apex-legends',
    name: 'Apex Legends',
    aliases: ['апекс', 'апекс легендс'],
    genres: ['shooter'],
    freeToPlay: true,
    description:
      'Обычное Trios с командой до трёх игроков; недостающих союзников подбирает игра. Рейтинг не учитывается.',
    sourceUrl:
      'https://www.ea.com/games/apex-legends/apex-legends/news/matchmaking-test-results',
    profiles: [
      p('trios', 'Обычное Trios', 'competitive', 1, 3, 25, 10, {
        teamSize: 3,
        allowsRandoms: true,
      }),
    ],
  }),
  g({
    id: 'rainbow-six-siege',
    name: 'Tom Clancy’s Rainbow Six Siege',
    aliases: ['радуга 6', 'рейнбоу сикс', 'р6'],
    genres: ['shooter'],
    description:
      'Обычная нерейтинговая игра 5×5; ограничения аккаунта и состава проверяйте в игре.',
    sourceUrl: 'https://store.steampowered.com/app/359550/',
    profiles: [
      p('quick-match', 'Quick Match 5×5', 'competitive', 1, 5, 25, 10, {
        teamSize: 5,
        allowsRandoms: true,
      }),
    ],
  }),
  g({
    id: 'the-finals',
    name: 'THE FINALS',
    aliases: ['финалс', 'финалы'],
    genres: ['shooter'],
    freeToPlay: true,
    description:
      'Quick Cash — команда из трёх, Power Shift — команда из пяти; подбираются недостающие союзники.',
    sourceUrl:
      'https://id.embark.games/the-finals/support/faq/60-game-modes-1771944875',
    profiles: [
      p('quick-cash', 'Quick Cash, команда 3', 'competitive', 1, 3, 20, 5, {
        teamSize: 3,
        allowsRandoms: true,
      }),
      p('power-shift', 'Power Shift, команда 5', 'competitive', 1, 5, 20, 5, {
        teamSize: 5,
        allowsRandoms: true,
      }),
    ],
  }),
  g({
    id: 'warframe',
    name: 'Warframe',
    aliases: ['варфрейм'],
    genres: ['shooter', 'action'],
    freeToPlay: true,
    description:
      'Обычные совместные миссии до четырёх игроков; приватный отряд без случайного добора.',
    sourceUrl: 'https://www.warframe.com/en/news/multiplayer-guide-ko',
    profiles: [p('mission', 'Приватная миссия', 'coop', 1, 4, 30, 10)],
  }),
  g({
    id: 'destiny-2',
    name: 'Destiny 2',
    aliases: ['дестини 2', 'судьба 2'],
    genres: ['shooter'],
    freeToPlay: true,
    description:
      'Обычные Strikes — матчмейкинг для команды из трёх. Доступ к конкретной активности проверяйте в игре.',
    sourceUrl:
      'https://help.bungie.net/hc/en-us/articles/360048720992-Destiny-2-Activities',
    profiles: [
      p('strike', 'Strike, команда 3', 'coop', 1, 3, 25, 10, {
        teamSize: 3,
        allowsRandoms: true,
      }),
    ],
  }),
  g({
    id: 'halo-infinite',
    name: 'Halo Infinite',
    aliases: ['хало инфинит'],
    genres: ['shooter'],
    freeToPlay: true,
    description: 'Обычный Arena 4×4; в неполную команду подбираются союзники.',
    sourceUrl:
      'https://support.halowaypoint.com/hc/en-us/articles/4408367772948-How-to-Play-Halo-Infinite-Multiplayer-with-Friends',
    profiles: [
      p('arena', 'Arena 4×4', 'competitive', 1, 4, 15, 10, {
        teamSize: 4,
        allowsRandoms: true,
      }),
    ],
  }),
  g({
    id: 'darktide',
    name: 'Warhammer 40,000: Darktide',
    aliases: ['дарктайд'],
    genres: ['shooter', 'horror'],
    description: 'Приватная совместная миссия для двух–четырёх игроков.',
    sourceUrl:
      'https://forums.fatsharkgames.com/t/community-update-6-signal-update/68741/1',
    profiles: [p('private', 'Приватная миссия', 'coop', 2, 4, 30, 10)],
  }),
];
