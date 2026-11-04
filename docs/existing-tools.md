# Инструменты в существующих проектах

Просмотрены package.json через подключённый GitHub пользователя Ncorty.

| Проект                            | Обнаружено                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| react-users-dashboard             | React, TypeScript, Webpack, TanStack Query, React Router, Ant Design, styled-components, Axios |
| habit-tracker                     | React, TypeScript, Vite, Zustand, Ant Design, Vitest, Testing Library, ESLint, Prettier        |
| task_vehicles (корень и frontend) | React, TypeScript, Radix UI, Zustand, Tailwind CSS, Axios, concurrently; react-scripts         |

Содержимое package.json показывает зависимости, но само по себе не подтверждает
качество или полноту их применения. Avito_test: package.json в корне не найден;
из этого не делаем выводов о стеке вложенных приложений.

Для PartyPick берём знакомые Vite, React, TypeScript, Vitest, Prettier,
Testing Library и TanStack Query. Radix подключаем по необходимости.
Webpack/react-scripts не нужны при использовании Vite. Ant Design не включаем:
пиксельное оформление удобнее выразить своими CSS Modules.
Zustand оставляем возможностью, но пока не добавляем.

Источники: package.json в репозиториях
https://github.com/Ncorty/react-users-dashboard,
https://github.com/Ncorty/task_vehicles и доступный через подключение habit-tracker.
