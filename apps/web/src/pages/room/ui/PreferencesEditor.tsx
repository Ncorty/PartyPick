import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Game, GameGenre, Preferences, Taste } from '@partypick/contracts';
import {
  normalizeCatalogSearch,
  preferencesSchema,
} from '@partypick/contracts';
import { Button, Field, inputClass, Notice } from '@shares/ui';

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

function defaults(catalog: Game[], initial: Preferences | null): Preferences {
  return {
    availableMinutes: initial?.availableMinutes ?? 60,
    mode: initial?.mode ?? 'any',
    allowRandoms: initial?.allowRandoms ?? true,
    sessionStyle: initial?.sessionStyle ?? 'any',
    genres: initial?.genres ?? [],
    games: catalog.map(
      (game) =>
        initial?.games.find((choice) => choice.gameId === game.id) ?? {
          gameId: game.id,
          owned: false,
          installed: false,
          taste: 'okay',
        },
    ),
  };
}

export function PreferencesEditor({
  catalog,
  initial,
  saving,
  onSave,
}: {
  catalog: Game[];
  initial: Preferences | null;
  saving: boolean;
  onSave: (preferences: Preferences) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<Preferences>(() =>
    defaults(catalog, initial),
  );
  const [saved, setSaved] = useState<Preferences>(() =>
    defaults(catalog, initial),
  );
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  useEffect(() => {
    if (!dirtyRef.current) {
      const next = defaults(catalog, initial);
      setDraft(next);
      setSaved(next);
    }
  }, [initial, catalog]);
  function update(next: Preferences) {
    setDraft(next);
    setDirty(true);
    dirtyRef.current = true;
    setMessage('');
  }
  function updateGame(
    id: string,
    patch: Partial<Preferences['games'][number]>,
  ) {
    update({
      ...draft,
      games: draft.games.map((choice) =>
        choice.gameId === id ? { ...choice, ...patch } : choice,
      ),
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = preferencesSchema.safeParse(draft);
    if (!parsed.success) {
      setMessage(
        'Проверьте время и ответы по играм. Изменения сохранены в форме.',
      );
      return;
    }
    try {
      await onSave(parsed.data);
      setSaved(parsed.data);
      setDirty(false);
      dirtyRef.current = false;
      setMessage('Пожелания сохранены. Друзья увидят ваши ответы.');
    } catch {
      // Keep the draft; the room renders the server error.
    }
  }
  const availableCount = draft.games.filter((choice) => choice.owned).length;
  const savedById = new Map(
    saved.games.map((choice) => [choice.gameId, choice]),
  );
  const changedCount = draft.games.filter((choice) => {
    const previous = savedById.get(choice.gameId);
    return (
      previous &&
      (choice.owned !== previous.owned ||
        choice.installed !== previous.installed ||
        choice.taste !== previous.taste)
    );
  }).length;
  const choices = new Map(draft.games.map((choice) => [choice.gameId, choice]));
  const query = normalizeCatalogSearch(search);
  const visibleGames = catalog.filter((game) => {
    const choice = choices.get(game.id);
    return (
      (!query ||
        [game.name, ...(game.aliases ?? [])].some((name) =>
          normalizeCatalogSearch(name).includes(query),
        )) &&
      (genre === 'all' || game.genres.includes(genre as GameGenre)) &&
      (!ownedOnly || choice?.owned)
    );
  });
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => void submit(event)}
      aria-label="Ваши пожелания"
    >
      <p className="text-lg leading-snug text-[#bfc3cb]">
        Отметьте доступные и установленные игры. Время, состав и «Сегодня не
        хочу» — обязательные условия; жанры и настроение помогут расставить
        подходящие варианты.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Сколько минут можете играть" htmlFor="available-minutes">
          <input
            id="available-minutes"
            type="number"
            min={15}
            max={240}
            step={1}
            className={inputClass}
            value={
              Number.isNaN(draft.availableMinutes) ? '' : draft.availableMinutes
            }
            disabled={saving}
            required
            onChange={(event) =>
              update({ ...draft, availableMinutes: event.target.valueAsNumber })
            }
          />
        </Field>
        <Field label="Режим игры" htmlFor="preferred-mode">
          <select
            id="preferred-mode"
            className={inputClass}
            disabled={saving}
            value={draft.mode}
            onChange={(event) =>
              update({
                ...draft,
                mode: event.target.value as Preferences['mode'],
              })
            }
          >
            <option value="any">Любой режим</option>
            <option value="coop">Кооператив без PvP</option>
            <option value="competitive">Соревнование</option>
            <option value="pvpve">PvPvE: игроки и окружение</option>
          </select>
        </Field>
        <Field label="Настроение на вечер" htmlFor="session-style">
          <select
            id="session-style"
            className={inputClass}
            disabled={saving}
            value={draft.sessionStyle ?? 'any'}
            onChange={(event) =>
              update({
                ...draft,
                sessionStyle: event.target.value as NonNullable<
                  Preferences['sessionStyle']
                >,
              })
            }
          >
            <option value="any">Без предпочтений</option>
            <option value="relaxed">Расслабиться</option>
            <option value="focused">Сосредоточиться на игре</option>
          </select>
        </Field>
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-xl leading-snug">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[#dfb768]"
          checked={draft.allowRandoms ?? true}
          disabled={saving}
          onChange={(event) =>
            update({ ...draft, allowRandoms: event.target.checked })
          }
        />
        Можно добрать случайных игроков в нашу команду
      </label>
      <fieldset className="min-w-0">
        <legend className="text-xl text-[#f2d18c]">
          Какие жанры хочется сегодня
        </legend>
        <p className="mt-1 text-lg text-[#bfc3cb]">
          Необязательно. Другие жанры останутся в подборе.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {Object.entries(genreNames).map(([id, name]) => (
            <label
              key={id}
              className="flex min-h-11 cursor-pointer items-center gap-2 text-lg"
            >
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-[#dfb768]"
                disabled={saving}
                checked={draft.genres?.includes(id as GameGenre) ?? false}
                onChange={(event) =>
                  update({
                    ...draft,
                    genres: event.target.checked
                      ? [...(draft.genres ?? []), id as GameGenre]
                      : (draft.genres ?? []).filter((item) => item !== id),
                  })
                }
              />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="border-t-2 border-[#536477] pt-5">
        <h3 className="text-2xl text-[#f2d18c]">Ваши игры</h3>
        <p className="mt-2 text-lg leading-snug text-[#bfc3cb]">
          Доступно: {availableCount} из {catalog.length}. Изменено с последнего
          сохранения: {changedCount}. Бесплатную игру тоже нужно установить.
          Каталог рассчитан на PC; доступ к режимам, ранги и ограничения
          аккаунта проверяйте в игре.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Найти игру" htmlFor="game-search">
            <input
              id="game-search"
              type="search"
              className={inputClass}
              value={search}
              placeholder="Например, кс или дота"
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <Field label="Жанр в каталоге" htmlFor="catalog-genre">
            <select
              id="catalog-genre"
              className={inputClass}
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
          </Field>
        </div>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-lg">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-[#dfb768]"
            checked={ownedOnly}
            onChange={(event) => setOwnedOnly(event.target.checked)}
          />
          Только доступные мне
        </label>
        <p className="my-2 text-lg text-[#bfc3cb]" role="status">
          Найдено: {visibleGames.length} из {catalog.length} · доступно:{' '}
          {availableCount} · изменено: {changedCount}
        </p>
        <div
          className="grid max-h-[36rem] gap-3 overflow-y-auto overscroll-contain pr-1"
          aria-label="Каталог игр"
        >
          {visibleGames.map((game) => {
            const choice = choices.get(game.id);
            if (!choice) return null;
            return (
              <fieldset
                key={game.id}
                className="min-w-0 border border-[#536477] bg-[#101722] px-3 pb-3"
              >
                <legend className="max-w-full break-words px-2 text-xl leading-snug text-[#f2d18c]">
                  {game.name}
                </legend>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-lg">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-[#dfb768]"
                      checked={choice.owned}
                      disabled={saving}
                      onChange={(event) =>
                        updateGame(game.id, {
                          owned: event.target.checked,
                          ...(!event.target.checked
                            ? { installed: false }
                            : {}),
                        })
                      }
                    />
                    Есть игра
                  </label>
                  <label
                    className={`flex min-h-11 items-center gap-2 text-lg ${choice.owned ? 'cursor-pointer' : 'opacity-60'}`}
                  >
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-[#dfb768]"
                      checked={choice.installed}
                      disabled={!choice.owned || saving}
                      onChange={(event) =>
                        updateGame(game.id, { installed: event.target.checked })
                      }
                    />
                    Установлена
                  </label>
                  {game.freeToPlay && (
                    <span className="self-center text-base text-[#a8dc83]">
                      Бесплатная
                    </span>
                  )}
                </div>
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-lg underline">
                    Пожелания и режимы: {game.name}
                  </summary>
                  <p className="mb-3 text-lg leading-snug text-[#bfc3cb]">
                    {game.description}
                  </p>
                  <ul className="mb-4 grid gap-2 text-lg leading-snug text-[#bfc3cb]">
                    {game.profiles.map((profile) => (
                      <li key={profile.id}>
                        {profile.name} ·{' '}
                        {profile.allowedPartySizes?.join(', ') ??
                          `${profile.minParty}–${profile.maxParty}`}{' '}
                        в компании · ориентир {profile.estimatedMinutes} мин.
                        {profile.playMinutes !== undefined &&
                          profile.setupMinutes !== undefined &&
                          ` (игра ${profile.playMinutes} + сбор ${profile.setupMinutes})`}
                      </li>
                    ))}
                  </ul>
                  <label className="block text-lg">
                    Отношение к игре
                    <select
                      className={`${inputClass} mt-2`}
                      disabled={saving}
                      value={choice.taste}
                      onChange={(event) =>
                        updateGame(game.id, {
                          taste: event.target.value as Taste,
                        })
                      }
                    >
                      <option value="want">Хочу играть</option>
                      <option value="okay">Не против</option>
                      <option value="veto">Сегодня не хочу</option>
                    </select>
                  </label>
                </details>
              </fieldset>
            );
          })}
        </div>
        {visibleGames.length === 0 && (
          <Notice>
            По этим фильтрам игр нет. Ваши ответы остались в форме.{' '}
            <button
              type="button"
              className="min-h-11 text-[#f2d18c] underline"
              onClick={() => {
                setSearch('');
                setGenre('all');
                setOwnedOnly(false);
              }}
            >
              Сбросить фильтры
            </button>
          </Notice>
        )}
      </div>
      {dirty && (
        <p className="text-lg text-[#dfb768]">
          Есть несохранённые изменения. Фильтры и обновление комнаты их не
          затронут.
        </p>
      )}
      {message && <Notice>{message}</Notice>}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t-2 border-[#536477] bg-[#151e2a] py-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить пожелания'}
        </Button>
        {!dirty && initial && (
          <a
            href="#matching-results"
            className="inline-flex min-h-11 items-center text-xl text-[#f2d18c] underline"
            onClick={() => document.getElementById('matching-results')?.focus()}
          >
            Перейти к подбору
          </a>
        )}
      </div>
    </form>
  );
}
