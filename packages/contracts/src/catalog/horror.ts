import { makeGame as g, makeProfile as p } from './factory.js';

export const horrorCatalog = [
  g({
    id: 'content-warning',
    name: 'Content Warning',
    aliases: ['контент ворнинг'],
    genres: ['horror', 'party'],
    description:
      'Снимайте совместные ролики в сетевом отряде от двух до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/2881650/',
    profiles: [p('film', 'Съёмка ролика', 'coop', 2, 4, 25, 5)],
  }),
  g({
    id: 'repo',
    name: 'R.E.P.O.',
    aliases: ['репо'],
    genres: ['horror', 'party'],
    description: 'Совместный сбор предметов в хорроре до шести игроков.',
    sourceUrl: 'https://store.steampowered.com/app/3241660/',
    profiles: [p('quota', 'Вылазка за предметами', 'coop', 1, 6, 35, 5)],
  }),
  g({
    id: 'devour',
    name: 'DEVOUR',
    aliases: ['девур', 'девоур'],
    genres: ['horror'],
    description: 'Совместное выживание в сетевом отряде до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1274570/',
    profiles: [p('ritual', 'Совместный ритуал', 'coop', 1, 4, 35, 5)],
  }),
  g({
    id: 'demonologist',
    name: 'Demonologist',
    aliases: ['демонолог'],
    genres: ['horror'],
    description: 'Поиск призрака в команде до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1929610/',
    profiles: [p('contract', 'Расследование', 'coop', 1, 4, 35, 5)],
  }),
  g({
    id: 'forewarned',
    name: 'FOREWARNED',
    aliases: ['форварнд'],
    genres: ['horror'],
    description: 'Исследование египетских гробниц в отряде до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1562420/',
    profiles: [p('tomb', 'Вылазка в гробницу', 'coop', 1, 4, 35, 5)],
  }),
  g({
    id: 'outlast-trials',
    name: 'The Outlast Trials',
    aliases: ['аутласт триалс'],
    genres: ['horror'],
    description:
      'Испытания можно проходить одному или командой из двух, трёх или четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1304930/',
    profiles: [p('trial', 'Совместное испытание', 'coop', 1, 4, 40, 10)],
  }),
  g({
    id: 'escape-backrooms',
    name: 'Escape the Backrooms',
    aliases: ['эскейп бекрумс', 'бекрумс'],
    genres: ['horror', 'puzzle'],
    description:
      'Исследование уровней Backrooms в сетевой команде до четырёх игроков.',
    sourceUrl: 'https://store.steampowered.com/app/1943950/',
    profiles: [p('levels', 'Совместное исследование', 'coop', 1, 4, 40, 5)],
  }),
  g({
    id: 'barotrauma',
    name: 'Barotrauma',
    aliases: ['баротравма'],
    genres: ['horror', 'survival'],
    description:
      'Совместное управление подлодкой до шестнадцати игроков; ботами можно закрыть роли.',
    sourceUrl: 'https://store.steampowered.com/app/602960/',
    profiles: [p('submarine', 'Рейс подлодки', 'coop', 2, 16, 50, 10)],
  }),
];
