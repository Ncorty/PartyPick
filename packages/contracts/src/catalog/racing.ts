import { makeGame as g, makeProfile as p } from './factory.js';

export const racingCatalog = [
  g({
    id: 'golf-gang',
    name: 'Golf Gang',
    aliases: ['гольф ганг'],
    genres: ['racing', 'sports', 'party'],
    description: 'Одновременные сетевые мини-гольф гонки до восьми игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1151050/',
    profiles: [
      p('race', 'Сетевой мини-гольф', 'competitive', 2, 8, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'hotshot-racing',
    name: 'Hotshot Racing',
    aliases: ['хотшот рейсинг'],
    genres: ['racing', 'sports'],
    description:
      'Сетевые аркадные заезды до восьми игроков. Time Trial остаётся одиночным режимом.',
    sourceUrl: 'https://store.steampowered.com/app/609920/',
    profiles: [
      p('race', 'Сетевая гонка', 'competitive', 2, 8, 15, 5, {
        intensity: 'relaxed',
      }),
    ],
  }),
];
