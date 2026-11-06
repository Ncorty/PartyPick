# Игровой каталог

Исходный набор находится в `src/catalog.ts`. API загружает его версионированным
seed в таблицу `game_catalog`; `GET /api/catalog` читает таблицу.
Новые комнаты получают собственный снимок каталога. Уже созданная комната
не меняет доступные игры вслед за редактированием глобального каталога.

Это поддерживаемые PC-профили, а не полный справочник всех режимов каждой игры.
Рейтинговые профили VALORANT, Dota и Overwatch, модификации и временные события
не включены. В CS доступность очереди и ограничения аккаунтов остаются ручной проверкой.

## Источники и редакционные поля

Проверено 6 ноября 2026 года. Размеры отрядов и описания берутся из страниц
разработчиков/издателей. У каждой записи есть `sourceUrl`.
Ориентиры времени и relaxed/focused — наши редакционные оценки; жанры также
служат простыми тегами предпочтений, а не официальной классификацией.
Источники не подтверждают численные оценки времени, баллы подбора или совместимость аккаунтов.

| Игра                  | Учтённые профили                         | Источник                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deep Rock Galactic    | Совместная миссия, до 4                  | [Steam](https://store.steampowered.com/app/548430/)                                                                                                                                                            |
| Valheim               | Совместный мир, до 10                    | [Steam](https://store.steampowered.com/app/892970/)                                                                                                                                                            |
| Overcooked! 2         | Кооператив, до 4                         | [Steam](https://store.steampowered.com/app/728880/)                                                                                                                                                            |
| Pummel Party          | Настольная партия, 2–8, возможны боты    | [Steam](https://store.steampowered.com/app/880940/)                                                                                                                                                            |
| Don't Starve Together | Мир с выбранным лимитом 6                | [Steam](https://store.steampowered.com/app/322330/)                                                                                                                                                            |
| Unrailed!             | Совместный заезд, 2–4                    | [Steam](https://store.steampowered.com/app/1016920/)                                                                                                                                                           |
| Counter-Strike 2      | Напарники 2×2, матч 5×5                  | [Valve: режимы](https://blog.counter-strike.net/about/), [CS2](https://store.steampowered.com/app/730/)                                                                                                        |
| VALORANT              | Swiftplay, Unrated, партия до 5          | [Riot: Swiftplay](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-5-12/), [ограничения Competitive](https://support.riotgames.com/en-us/valorant/gameplay/valorant-competitive-mode-faq) |
| Dota 2                | Turbo и All Pick без рейтинга, команда 5 | [Dota 2](https://store.steampowered.com/app/570/), [Valve: Turbo](https://store.steampowered.com/oldnews/34837)                                                                                                |
| ARC Raiders           | Экспедиция PvPvE, отряд до 3             | [Embark в Steam](https://store.steampowered.com/app/1808500/)                                                                                                                                                  |
| Overwatch             | Поддерживаемый профиль Quick Play 5×5    | [Blizzard: форматы](https://news.blizzard.com/en-us/article/24289101/director-s-take-future-formats)                                                                                                           |
| HELLDIVERS 2          | Совместная миссия, до 4                  | [PlayStation](https://www.playstation.com/en-us/games/helldivers-2/)                                                                                                                                           |
| Phasmophobia          | Совместное расследование, до 4           | [Steam](https://store.steampowered.com/app/739630/)                                                                                                                                                            |
| Lethal Company        | Обычный отряд без модов, до 4            | [Steam](https://store.steampowered.com/app/1966720/)                                                                                                                                                           |
| Rocket League         | Casual 2×2 и 3×3                         | [Psyonix: режимы](https://www.rocketleague.com/news/first-look-play-menu-changes-coming-to-rocket-league)                                                                                                      |

Ротации и правила игр меняются. Перед изменением профиля обновляйте источник,
версию seed и тесты на размер партии/время/добор. Изменение seed обновляет
поставляемые записи с меньшей версией, сохраняя строки с текущей или более новой версией.
