# PartyPick

Сервис для компании друзей: подобрать игру под условия конкретного вечера,
объяснить результат и подтвердить совместный выбор.

## Состояние проекта

Подготовлен технический каркас: React-страница, Fastify API с health endpoint,
монорепозиторий, строгая проверка TypeScript и GitHub Actions.
Комнаты, подбор, база данных и Steam пока не реализованы.

## Локальный запуск

Требуются Node.js 22.12+ и npm 10+.

```sh
npm ci
npm run dev
```

Интерфейс: http://localhost:5173. API: http://127.0.0.1:3001/api/health.
Vite проксирует `/api` на локальный сервер. PostgreSQL для текущего каркаса не нужен.
Для API можно задать переменные процесса `PORT` (3001) и `HOST` (127.0.0.1).
При изменении порта API нужно обновить адрес proxy в `apps/web/vite.config.ts`.

```sh
npm run typecheck
npm test
npm run build
npm run format:check
npm run lint
npx playwright install chromium
npm run test:e2e
```

Сборка интерфейса: `apps/web/dist`. Сборка API: `apps/api/dist`;
запуск собранного API: `npm run start -w @partypick/api`.
Сервер API пока не раздаёт собранный интерфейс. Production-размещение — отдельный этап.

## Документация

- [Стек, границы и модель данных](docs/architecture.md)
- [Этапы разработки и критерии готовности](docs/roadmap.md)
- [Работа с Git](docs/git-workflow.md)
- [Правила FSD](docs/frontend-fsd.md)
- [Инструменты из существующих проектов](docs/existing-tools.md)
- [Визуальное направление](docs/visual-direction.md)
- [Известные ограничения](docs/known-limitations.md)

## Источники технических решений

- https://vite.dev/guide/
- https://fastify.dev/docs/latest/Reference/TypeScript/
- https://socket.io/docs/v4/delivery-guarantees/
