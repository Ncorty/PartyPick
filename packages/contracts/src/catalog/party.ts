import { makeGame as g, makeProfile as p } from './factory.js';

export const partyCatalog = [
  g({
    id: 'among-us',
    name: 'Among Us',
    aliases: ['амонг ас', 'амогус'],
    genres: ['party'],
    description:
      'Сетевое социальное расследование для четырёх–пятнадцати игроков.',
    sourceUrl: 'https://store.steampowered.com/app/945360/',
    profiles: [
      p('classic', 'Классическая партия', 'competitive', 4, 15, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'human-fall-flat',
    name: 'Human: Fall Flat',
    aliases: ['хьюман фол флет', 'хуман фол флет'],
    genres: ['party', 'puzzle'],
    description:
      'Физические задачи в совместной онлайн-сессии до восьми игроков.',
    sourceUrl: 'https://store.steampowered.com/app/477160/',
    profiles: [
      p('levels', 'Совместные уровни', 'coop', 1, 8, 25, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'ultimate-chicken-horse',
    name: 'Ultimate Chicken Horse',
    aliases: ['ультимейт чикен хорс'],
    genres: ['party'],
    description:
      'Создайте полосу препятствий и соревнуйтесь онлайн до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/386940/',
    profiles: [
      p('race', 'Полоса препятствий', 'competitive', 2, 4, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'stick-fight',
    name: 'Stick Fight: The Game',
    aliases: ['стик файт'],
    genres: ['party'],
    description: 'Сетевые схватки фигурок для двух–четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/674940/',
    profiles: [
      p('fight', 'Сетевая схватка', 'competitive', 2, 4, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'move-or-die',
    name: 'Move or Die',
    aliases: ['мув ор дай'],
    genres: ['party'],
    description: 'Быстрая сетевая вечеринка до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/323850/',
    profiles: [
      p('party', 'Быстрые раунды', 'competitive', 2, 4, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'speedrunners',
    name: 'SpeedRunners',
    aliases: ['спидраннерс'],
    genres: ['party', 'racing'],
    description: 'Сетевой забег наперегонки до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/207140/',
    profiles: [
      p('race', 'Сетевой забег', 'competitive', 2, 4, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'brawlhalla',
    name: 'Brawlhalla',
    aliases: ['бравлхалла'],
    genres: ['party'],
    freeToPlay: true,
    description:
      'Сетевые бои; профиль учитывает свободную игру до восьми участников, не ранговую очередь.',
    sourceUrl: 'https://store.steampowered.com/app/291550/',
    profiles: [
      p('free-for-all', 'Свободный бой', 'competitive', 2, 8, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'golf-with-friends',
    name: 'Golf With Your Friends',
    aliases: ['гольф с друзьями'],
    genres: ['party', 'sports'],
    description:
      'Одновременный мини-гольф в сетевой компании до двенадцати игроков.',
    sourceUrl: 'https://store.steampowered.com/app/431240/',
    profiles: [
      p('minigolf', 'Сетевой мини-гольф', 'competitive', 2, 12, 20, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'duck-game',
    name: 'Duck Game',
    aliases: ['дак гейм'],
    genres: ['party'],
    description:
      'Сетевые схватки уток для двух–восьми игроков; зрители не считаются участниками.',
    sourceUrl: 'https://store.steampowered.com/app/312530/',
    profiles: [
      p('fight', 'Сетевая схватка', 'competitive', 2, 8, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'pico-park',
    name: 'PICO PARK',
    aliases: ['пико парк'],
    genres: ['party', 'puzzle'],
    description: 'Совместные онлайн-головоломки для двух–восьми игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1509960/',
    profiles: [
      p('levels', 'Совместные уровни', 'coop', 2, 8, 20, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'plateup',
    name: 'PlateUp!',
    aliases: ['плейт ап'],
    genres: ['party', 'strategy'],
    description: 'Совместная онлайн-кухня до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1599600/',
    profiles: [
      p('restaurant', 'Совместный ресторан', 'coop', 1, 4, 30, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'escapists-2',
    name: 'The Escapists 2',
    aliases: ['эскаписты 2'],
    genres: ['puzzle', 'party'],
    description: 'Совместный побег до четырёх игроков онлайн.',
    sourceUrl: 'https://www.team17.com/games/the-escapists-2',
    profiles: [p('escape', 'Совместный побег', 'coop', 1, 4, 35, 5)],
  }),
];
