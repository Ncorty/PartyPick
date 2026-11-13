import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  normalizeCatalogSearch,
  type Availability,
  type GameGenre,
  type LibrarySnapshot,
} from '@partypick/contracts';
import {
  catalogKey,
  getCatalog,
  getLibraryMonotonic,
  libraryKey,
  latestLibrarySnapshot,
  patchLibrary,
} from '@entities/library';
import { ApiError, errorMessage, request } from '@shares/api';
import { AppShell, Button, inputClass, Notice, Panel } from '@shares/ui';

const genreNames: Record<GameGenre, string> = {
  shooter: 'Шутеры',
  action: 'Экшен',
  moba: 'MOBA',
  survival: 'Выживание',
  party: 'Для вечеринки',
  sandbox: 'Песочницы',
  racing: 'Гонки',
  sports: 'Спорт',
  horror: 'Хоррор',
  strategy: 'Стратегии',
  puzzle: 'Головоломки',
  board: 'Настольные',
};
const availabilityNames: Record<Availability, string> = {
  unknown: 'Не указано',
  unavailable: 'Нет доступа',
  available: 'Доступна',
  installed: 'Установлена',
};
const asDraft = (snapshot: LibrarySnapshot) =>
  Object.fromEntries(
    snapshot.entries.map((entry) => [entry.gameId, entry.availability]),
  ) as Record<string, Availability>;
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export function LibraryPage() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ['guest-session'],
    queryFn: () =>
      request<{ expiresAt: string }>('/guest-session', { method: 'POST' }),
    staleTime: Infinity,
    retry: false,
  });
  const libraryQuery = useQuery({
    queryKey: libraryKey,
    queryFn: () => getLibraryMonotonic(queryClient),
    enabled: sessionQuery.isSuccess,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const catalogQuery = useQuery({
    queryKey: catalogKey,
    queryFn: getCatalog,
    staleTime: Infinity,
  });
  const [base, setBase] = useState<LibrarySnapshot | null>(null);
  const [draft, setDraft] = useState<Record<string, Availability>>({});
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('all');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (libraryQuery.data && !dirtyRef.current && !conflict) {
      setBase(libraryQuery.data);
      setDraft(asDraft(libraryQuery.data));
    }
  }, [libraryQuery.data, conflict]);

  const save = useMutation({
    mutationFn: async () => {
      if (!base) throw new Error('Library is not loaded');
      const old = asDraft(base);
      const changes = Object.keys({ ...old, ...draft })
        .filter(
          (gameId) =>
            (draft[gameId] ?? 'unknown') !== (old[gameId] ?? 'unknown'),
        )
        .map((gameId) => ({
          gameId,
          availability: draft[gameId] ?? 'unknown',
        }));
      return patchLibrary(base.version, changes);
    },
    onSuccess: async (snapshot) => {
      await queryClient.cancelQueries({ queryKey: libraryKey });
      const latest = latestLibrarySnapshot(
        queryClient.getQueryData(libraryKey),
        snapshot,
      );
      queryClient.setQueryData(libraryKey, latest);
      setBase(latest);
      setDraft(asDraft(latest));
      dirtyRef.current = false;
      setDirty(false);
      setConflict(false);
      setMessage(
        'Библиотека сохранена. Новые комнаты смогут использовать эти отметки.',
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) setConflict(true);
      if (error instanceof ApiError && error.status === 403) setExpired(true);
    },
  });

  function change(gameId: string, availability: Availability) {
    const next = { ...draft, [gameId]: availability };
    if (availability === 'unknown') delete next[gameId];
    const old = base ? asDraft(base) : {};
    const changed = Object.keys({ ...old, ...next }).some(
      (id) => (next[id] ?? 'unknown') !== (old[id] ?? 'unknown'),
    );
    setDraft(next);
    dirtyRef.current = changed;
    setDirty(changed);
    setMessage('');
  }
  async function reloadCurrent() {
    try {
      const result = await libraryQuery.refetch();
      if (!result.isSuccess || !result.data) return;
      setBase(result.data);
      setDraft(asDraft(result.data));
      dirtyRef.current = false;
      setDirty(false);
      setConflict(false);
      setMessage(
        'Загружена актуальная библиотека. Прежние несохранённые изменения отменены.',
      );
    } catch {
      /* Query error is displayed below. */
    }
  }
  async function beginNewSession() {
    try {
      const session = await request<{ expiresAt: string }>('/guest-session', {
        method: 'POST',
      });
      queryClient.removeQueries({ queryKey: libraryKey });
      queryClient.setQueryData(['guest-session'], session);
      setBase(null);
      setDraft({});
      setExpired(false);
      setConflict(false);
      dirtyRef.current = false;
      setDirty(false);
      await libraryQuery.refetch();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }
  async function retryLoad() {
    const session = await sessionQuery.refetch();
    if (!session.isSuccess) return;
    await libraryQuery.refetch();
    await catalogQuery.refetch();
  }

  const games = catalogQuery.data ?? [];
  const old = base ? asDraft(base) : {};
  const changedCount = Object.keys({ ...old, ...draft }).filter(
    (id) => (draft[id] ?? 'unknown') !== (old[id] ?? 'unknown'),
  ).length;
  const availableCount = Object.values(draft).filter(
    (value) => value === 'available' || value === 'installed',
  ).length;
  const installedCount = Object.values(draft).filter(
    (value) => value === 'installed',
  ).length;
  const query = normalizeCatalogSearch(search);
  const visible = games.filter((game) => {
    const value = draft[game.id] ?? 'unknown';
    return (
      (!query ||
        [game.name, ...(game.aliases ?? [])].some((name) =>
          normalizeCatalogSearch(name).includes(query),
        )) &&
      (genre === 'all' || game.genres.includes(genre as GameGenre)) &&
      (filter === 'all' ||
        (filter === 'known' && value !== 'unknown') ||
        (filter === 'available' &&
          (value === 'available' || value === 'installed')))
    );
  });
  const sessionExpired =
    expired ||
    (libraryQuery.error instanceof ApiError &&
      libraryQuery.error.status === 403);
  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#dfb768] sm:text-5xl">
            Моя библиотека
          </h1>
          <p className="mt-3 max-w-3xl text-xl leading-snug">
            Доступ и установка сохраняются для новых комнат. Желание играть
            выбирается отдельно на каждый вечер.
          </p>
        </div>
      </div>
      <Panel className="mb-6">
        <p className="text-xl leading-snug">
          {base
            ? `Гостевая сессия действует до ${dateLabel(base.sessionExpiresAt)}.`
            : 'Проверяем гостевую сессию…'}
        </p>
        <p className="mt-2 text-lg leading-snug text-[#bfc3cb]">
          Библиотека привязана к cookie этого браузера на 7 дней с создания
          сессии. После удаления cookie или истечения срока прежние отметки
          восстановить нельзя.
        </p>
      </Panel>
      {(sessionQuery.isPending ||
        (sessionQuery.isSuccess && libraryQuery.isPending) ||
        catalogQuery.isPending) && (
        <Notice>Загружаем библиотеку и каталог…</Notice>
      )}
      {sessionExpired ? (
        <Panel title="Сессия истекла">
          <Notice error>
            Прежняя библиотека недоступна. Можно начать новую гостевую сессию с
            пустой библиотекой.
          </Notice>
          <Button type="button" onClick={() => void beginNewSession()}>
            Начать новую сессию
          </Button>
        </Panel>
      ) : libraryQuery.isError ||
        catalogQuery.isError ||
        sessionQuery.isError ? (
        <Panel title="Не удалось загрузить библиотеку">
          <Notice error>
            {errorMessage(
              libraryQuery.error ?? catalogQuery.error ?? sessionQuery.error,
            )}
          </Notice>
          <Button type="button" onClick={() => void retryLoad()}>
            Повторить загрузку
          </Button>
        </Panel>
      ) : (
        base && (
          <Panel title="Отметки по играм">
            <p className="text-lg text-[#bfc3cb]">
              Доступно: {availableCount} · установлено: {installedCount} ·
              изменено: {changedCount}. Отсутствие отметки означает «Не
              указано».
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="text-xl">
                Найти игру
                <input
                  type="search"
                  className={`${inputClass} mt-2`}
                  placeholder="Например, кс или дота"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="text-xl">
                Жанр
                <select
                  className={`${inputClass} mt-2`}
                  value={genre}
                  onChange={(event) => setGenre(event.target.value)}
                >
                  <option value="all">Все жанры</option>
                  {Object.entries(genreNames).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xl">
                Показать
                <select
                  className={`${inputClass} mt-2`}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">Все игры</option>
                  <option value="known">С отметкой</option>
                  <option value="available">Доступные мне</option>
                </select>
              </label>
            </div>
            <p className="my-3 text-lg text-[#bfc3cb]" role="status">
              Найдено: {visible.length} из {games.length}
            </p>
            <div
              className="grid max-h-[38rem] gap-2 overflow-y-auto overscroll-contain pr-1"
              aria-label="Игры библиотеки"
            >
              {visible.map((game) => (
                <label
                  key={game.id}
                  className="grid min-w-0 gap-2 border border-[#536477] bg-[#101722] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] sm:items-center"
                >
                  <span className="break-words text-xl leading-snug text-[#f2d18c]">
                    {game.name}
                  </span>
                  <select
                    className={inputClass}
                    value={draft[game.id] ?? 'unknown'}
                    disabled={save.isPending || conflict}
                    onChange={(event) =>
                      change(game.id, event.target.value as Availability)
                    }
                    aria-label={`${game.name}: доступ и установка`}
                  >
                    {Object.entries(availabilityNames).map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {visible.length === 0 && (
              <Notice>
                По этим фильтрам игр нет. Отметки сохранены в форме.{' '}
                <button
                  type="button"
                  className="text-[#f2d18c] underline"
                  onClick={() => {
                    setSearch('');
                    setGenre('all');
                    setFilter('all');
                  }}
                >
                  Сбросить фильтры
                </button>
              </Notice>
            )}
            {dirty && (
              <p className="mt-4 text-lg text-[#dfb768]">
                Есть несохранённые изменения, включая игры вне текущего фильтра.
              </p>
            )}
            {conflict && (
              <Notice error>
                Библиотека изменилась в другой вкладке. Ваш черновик сохранён на
                этом экране. Чтобы загрузить актуальную версию, отмените свои
                изменения явно.
                <button
                  type="button"
                  className="mt-2 block min-h-11 text-left text-[#ffd4c2] underline"
                  onClick={() => void reloadCurrent()}
                >
                  Загрузить актуальную версию
                </button>
              </Notice>
            )}
            {save.isError && !conflict && (
              <Notice error>{errorMessage(save.error)}</Notice>
            )}
            {message && <Notice>{message}</Notice>}
            <Button
              type="button"
              className="mt-4"
              disabled={!dirty || save.isPending || conflict}
              onClick={() => save.mutate()}
            >
              {save.isPending
                ? 'Сохраняем…'
                : `Сохранить изменения (${changedCount})`}
            </Button>
          </Panel>
        )
      )}
    </AppShell>
  );
}
