import { makeGame as g, makeProfile as p } from './factory.js';

export const survivalCatalog = [
  g({
    id: 'stardew-valley',
    name: 'Stardew Valley',
    aliases: ['стар дью', 'стардью валли'],
    genres: ['sandbox'],
    description: 'Совместная ферма до восьми игроков на PC.',
    sourceUrl: 'https://store.steampowered.com/app/413150/',
    profiles: [
      p('farm', 'Совместная ферма', 'coop', 1, 8, 50, 10, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'palworld',
    name: 'Palworld',
    aliases: ['палворлд'],
    genres: ['survival', 'sandbox'],
    description:
      'Обычный совместный мир до четырёх игроков. Выделенный сервер — другой сценарий.',
    sourceUrl: 'https://store.steampowered.com/app/1623730/',
    profiles: [
      p('world', 'Совместный мир', 'coop', 1, 4, 50, 10, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'ark-survival-ascended',
    name: 'ARK: Survival Ascended',
    aliases: ['арк сурвайвал', 'арк'],
    genres: ['survival', 'sandbox'],
    description:
      'Частная сетевая сессия до восьми игроков, без публичных PvP-серверов.',
    sourceUrl: 'https://store.steampowered.com/app/2399830/',
    profiles: [p('private', 'Частная сессия', 'coop', 1, 8, 50, 10)],
  }),
  g({
    id: 'enshrouded',
    name: 'Enshrouded',
    aliases: ['эншраудед'],
    genres: ['survival', 'sandbox'],
    description: 'Совместный мир PC до шестнадцати игроков.',
    sourceUrl: 'https://enshrouded.com/en-US/faq',
    profiles: [p('world', 'Совместный мир', 'coop', 1, 16, 50, 10)],
  }),
  g({
    id: 'core-keeper',
    name: 'Core Keeper',
    aliases: ['кор кипер'],
    genres: ['survival', 'sandbox'],
    description: 'Исследование и строительство в одном мире до восьми игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1621690/',
    profiles: [
      p('world', 'Совместный мир', 'coop', 1, 8, 50, 10, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'astroneer',
    name: 'ASTRONEER',
    aliases: ['астронир', 'астронер'],
    genres: ['survival', 'sandbox'],
    description: 'Исследование планет вдвоём, втроём или вчетвером онлайн.',
    sourceUrl: 'https://store.steampowered.com/app/361420/',
    profiles: [
      p('world', 'Совместное исследование', 'coop', 2, 4, 50, 10, {
        intensity: 'relaxed',
      }),
    ],
  }),
  g({
    id: 'grounded',
    name: 'Grounded',
    aliases: ['граундед'],
    genres: ['survival', 'sandbox'],
    description:
      'Сетевое выживание с тремя друзьями. На Steam есть отдельный режим без учётной записи Microsoft.',
    sourceUrl: 'https://grounded.obsidian.net/game',
    profiles: [p('world', 'Совместный двор', 'coop', 1, 4, 50, 10)],
  }),
];
