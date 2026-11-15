import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CatalogFieldChange,
  CatalogUpdatePreview,
  RoomSnapshot,
} from '@partypick/contracts';
import { ApiError, errorMessage, request } from '@shares/api';
import { Button, Notice, Panel } from '@shares/ui';

const fieldNames: Record<string, string> = {
  name: 'Название',
  description: 'Описание',
  aliases: 'Поисковые названия',
  genres: 'Жанры',
  freeToPlay: 'Бесплатная игра',
  modes: 'Режимы',
  minPlayers: 'Минимум игроков',
  maxPlayers: 'Максимум игроков',
  suggestedMinutes: 'Ориентир времени',
  sourceUrl: 'Источник',
  verifiedAt: 'Дата проверки',
  mode: 'Режим',
  minParty: 'Минимум участников',
  maxParty: 'Максимум участников',
  allowedPartySizes: 'Размер компании',
  teamSize: 'Размер команды',
  estimatedMinutes: 'Время сессии',
  playMinutes: 'Время игры',
  setupMinutes: 'Сбор и очередь',
  intensity: 'Настроение',
  allowsRandoms: 'Случайные игроки',
};
const valueNames: Record<string, string> = {
  coop: 'кооператив',
  competitive: 'соревнование',
  pvpve: 'PvPvE',
  focused: 'сосредоточиться',
  relaxed: 'расслабиться',
  shooter: 'шутеры',
  action: 'экшен',
  moba: 'MOBA',
  survival: 'выживание',
  party: 'вечеринка',
  sandbox: 'песочницы',
  racing: 'гонки',
  sports: 'спорт',
  horror: 'хоррор',
  strategy: 'стратегия',
  puzzle: 'головоломки',
  board: 'настольные',
};
const humanValue = (field: string, value: string) =>
  ['mode', 'modes', 'genres', 'intensity'].includes(field)
    ? value
        .split(', ')
        .map((part) => valueNames[part] ?? part)
        .join(', ')
    : value;
function FieldList({ fields }: { fields: CatalogFieldChange[] }) {
  return (
    <ul className="mt-1 grid gap-1 text-base text-[#bfc3cb]">
      {fields.map((change) => (
        <li key={change.field} className="break-words">
          {fieldNames[change.field] ?? 'Данные игры'}:{' '}
          {change.before === change.after
            ? 'обновлены'
            : `${humanValue(change.field, change.before)} → ${humanValue(change.field, change.after)}`}
        </li>
      ))}
    </ul>
  );
}

export function CatalogUpdateControl({ room }: { room: RoomSnapshot }) {
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const roomKey = ['room', room.id];
  const previewQuery = useQuery({
    queryKey: ['catalog-update', room.id],
    queryFn: ({ signal }) =>
      request<CatalogUpdatePreview>(
        `/rooms/${encodeURIComponent(room.id)}/catalog-update`,
        { signal },
      ),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const preview = previewQuery.data;
  const stale = !!preview && preview.roomVersion !== room.version;
  const changed =
    !!preview && preview.currentRevision !== preview.targetRevision;
  const mutation = useMutation({
    mutationFn: () =>
      request<RoomSnapshot>(
        `/rooms/${encodeURIComponent(room.id)}/catalog-update`,
        {
          method: 'POST',
          body: {
            version: preview!.roomVersion,
            targetRevision: preview!.targetRevision,
            confirmReset: true,
          },
        },
      ),
    onSuccess: (result) => {
      queryClient.setQueryData<RoomSnapshot>(roomKey, (current) =>
        current && current.version > result.version ? current : result,
      );
      setConfirmed(false);
      void previewQuery.refetch();
    },
  });
  const conflict =
    mutation.error instanceof ApiError && mutation.error.status === 409;
  const refresh = () => {
    setConfirmed(false);
    mutation.reset();
    void previewQuery.refetch();
  };
  const count = (kind: 'added' | 'removed' | 'changed') =>
    preview?.changes.filter((game) => game.kind === kind).length ?? 0;
  return (
    <Panel title="Каталог комнаты">
      <p className="text-lg leading-snug text-[#bfc3cb]">
        Комната использует снимок каталога с момента создания или последнего
        обновления. Ведущий может явно перейти на текущий каталог.
      </p>
      {previewQuery.isPending ? (
        <Notice>Проверяем каталог…</Notice>
      ) : previewQuery.isError ? (
        <Notice error>
          {previewQuery.error instanceof ApiError
            ? previewQuery.error.message
            : errorMessage(previewQuery.error)}
        </Notice>
      ) : !changed ? (
        <p className="mt-3 text-xl text-[#a8dc83]">Каталог актуален.</p>
      ) : (
        <>
          <p className="mt-3 text-xl text-[#f2d18c]">
            Доступно обновление: добавлено {count('added')}, удалено{' '}
            {count('removed')}, изменено {count('changed')} игр.
          </p>
          <details className="mt-2">
            <summary className="min-h-11 cursor-pointer py-2 text-lg underline">
              Показать изменения игр и режимов
            </summary>
            <ul className="mt-2 grid max-h-80 gap-3 overflow-y-auto text-lg leading-snug">
              {preview?.changes.map((game) => (
                <li
                  key={game.gameId}
                  className="min-w-0 border-b border-[#536477] pb-2"
                >
                  <strong className="break-words text-[#dfb768]">
                    {game.name}
                  </strong>{' '}
                  ·{' '}
                  {game.kind === 'added'
                    ? 'добавлена'
                    : game.kind === 'removed'
                      ? 'удалена'
                      : 'изменена'}
                  <FieldList fields={game.fields} />
                  {game.profiles.map((profile) => (
                    <div
                      key={profile.profileId}
                      className="mt-2 pl-3 text-base"
                    >
                      <span className="break-words">
                        {profile.name} ·{' '}
                        {profile.kind === 'added'
                          ? 'режим добавлен'
                          : profile.kind === 'removed'
                            ? 'режим удалён'
                            : 'режим изменён'}
                      </span>
                      <FieldList fields={profile.fields} />
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-3 text-lg leading-snug text-[#dfb768]">
            Обновление начнёт новый раунд: голоса, готовность и победитель
            сбросятся. Ответы для общих игр сохранятся; удалённые игры исчезнут
            из ответов, новые нужно отметить каждому участнику.
          </p>
          {stale && (
            <Notice>
              Комната изменилась после предпросмотра. Обновите его перед
              применением.
            </Notice>
          )}
          <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-lg leading-snug">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-[#dfb768]"
              checked={confirmed}
              disabled={stale || conflict || mutation.isPending}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Подтверждаю новый раунд и сброс голосов, готовности и выбранной
            игры.
          </label>
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={!confirmed || stale || conflict || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Обновляем каталог…'
              : 'Обновить каталог комнаты'}
          </Button>
        </>
      )}
      {mutation.isError && (
        <Notice error>
          {conflict ? 'Предпросмотр устарел.' : errorMessage(mutation.error)}{' '}
          Обновите предпросмотр и проверьте изменения.
        </Notice>
      )}
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={previewQuery.isFetching || mutation.isPending}
        onClick={refresh}
      >
        {previewQuery.isFetching ? 'Проверяем…' : 'Обновить предпросмотр'}
      </Button>
    </Panel>
  );
}
