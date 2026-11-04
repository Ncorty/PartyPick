# Frontend: Feature-Sliced Design

Базовый стек: React + TypeScript + Vite. Все новые продуктовые сценарии размещаем
по FSD. Пустые слои заранее не создаём.

```text
src/
  app/                    # запуск, providers, router, глобальные стили
  pages/
    home/                 # стартовая страница
    room/                 # появится со сценарием комнаты
  widgets/                # только при необходимости крупных составных блоков
  features/               # join-room, set-preferences, cast-vote по мере реализации
  entities/               # game, room, participant по мере появления общего кода
  shared/                 # ui, api, lib, config — без бизнес-правил
  main.tsx                # только React bootstrap
```

Направление зависимостей: app → pages → widgets → features → entities → shared.
Импортировать можно нижележащий слой. Соседние слайсы не импортируют друг друга.
Слайс имеет public API `index.ts`; внешний код не обращается к его внутренним файлам.
У shared отдельный public API для каждого сегмента. Внутри слайса используем
прямые относительные импорты, а не собственный barrel.

Сегменты создаём по необходимости: ui, model, api, lib, config.
Логику отдельной страницы сначала оставляем в её слайсе; перенос в feature/entity
обосновываем повторным использованием или самостоятельным бизнес-сценарием.
Алгоритм matching находится в общем доменном пакете, не в React-компонентах.

Серверное состояние — TanStack Query. Локальное состояние — React.
Zustand подключаем только при появлении общего клиентского состояния,
которое неудобно выражать локальным state или URL. Копию серверной комнаты
в Zustand не храним. Диалоги и сложные доступные элементы можно строить на Radix.

Основание: https://feature-sliced.design/docs/get-started/overview
и https://feature-sliced.design/docs/concepts/low-coupling.

ESLint проверяет TS и hooks. Границы FSD сейчас проверяются review;
автоматический контроль импортов необходимо добавить при расширении структуры.
