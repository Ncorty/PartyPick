import { useEffect, useState, type FormEvent } from 'react';
import type { Game, Preferences, Taste } from '@partypick/contracts';
import { preferencesSchema } from '@partypick/contracts';
import { Button, Field, inputClass, Notice } from '@shares/ui';

function defaults(games: Game[]): Preferences {
  return {
    availableMinutes: 60,
    mode: 'any',
    games: games.map((game) => ({
      gameId: game.id,
      owned: false,
      installed: false,
      taste: 'okay',
    })),
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
  const [draft, setDraft] = useState<Preferences>(
    () => initial ?? defaults(catalog),
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!dirty) setDraft(initial ?? defaults(catalog));
  }, [initial, catalog, dirty]);
  function update(next: Preferences) {
    setDraft(next);
    setDirty(true);
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
      setMessage('Проверьте время и ответы по каждой игре.');
      return;
    }
    try {
      await onSave(parsed.data);
      setDirty(false);
      setMessage('Пожелания сохранены. Друзья увидят ваши ответы.');
    } catch {
      /* Server error is rendered by the room mutation. Preserve the draft. */
    }
  }
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => void submit(event)}
      aria-label="Ваши пожелания"
    >
      <p className="text-lg leading-snug text-[#bfc3cb]">
        Сейчас подбираем игры, которые уже есть и установлены у каждого. Время
        сессии в каталоге — ориентир, а не гарантия.
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
        <Field label="Настроение на вечер" htmlFor="preferred-mode">
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
            <option value="coop">Кооператив</option>
            <option value="competitive">Соревнование</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4">
        {catalog.map((game) => {
          const choice = draft.games.find((item) => item.gameId === game.id);
          if (!choice) return null;
          return (
            <fieldset
              key={game.id}
              className="min-w-0 border-2 border-[#536477] bg-[#101722] px-3 pb-4"
            >
              <legend className="max-w-full px-2 text-2xl leading-snug text-[#f2d18c]">
                {game.name}
              </legend>
              <h3 className="sr-only">{game.name}</h3>
              <p className="mt-1 text-lg leading-snug text-[#bfc3cb]">
                {game.minPlayers}–{game.maxPlayers} игроков · около{' '}
                {game.suggestedMinutes} мин.
              </p>
              <p className="mt-2 text-lg leading-snug text-[#bfc3cb]">
                {game.description}
              </p>
              <div className="my-3 flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-xl">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-[#dfb768]"
                    checked={choice.owned}
                    disabled={saving}
                    onChange={(event) =>
                      updateGame(game.id, {
                        owned: event.target.checked,
                        ...(!event.target.checked ? { installed: false } : {}),
                      })
                    }
                  />
                  Есть игра
                </label>
                <label
                  className={`flex min-h-11 items-center gap-3 text-xl ${choice.owned ? 'cursor-pointer' : 'opacity-60'}`}
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
              </div>
              <label className="block text-lg">
                Отношение к игре
                <select
                  className={`${inputClass} mt-2`}
                  disabled={saving}
                  value={choice.taste}
                  onChange={(event) =>
                    updateGame(game.id, { taste: event.target.value as Taste })
                  }
                >
                  <option value="want">Хочу играть</option>
                  <option value="okay">Не против</option>
                  <option value="veto">Сегодня не хочу</option>
                </select>
              </label>
            </fieldset>
          );
        })}
      </div>
      {dirty && (
        <p className="text-lg text-[#dfb768]">
          Есть несохранённые изменения. Обновление комнаты их не затронет.
        </p>
      )}
      {message && <Notice>{message}</Notice>}
      <Button type="submit" disabled={saving}>
        {saving ? 'Сохраняем…' : 'Сохранить пожелания'}
      </Button>
    </form>
  );
}
