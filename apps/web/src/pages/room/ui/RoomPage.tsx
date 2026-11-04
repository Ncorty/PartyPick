import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Game, RoomSnapshot } from '@partypick/contracts';
import { ApiError, errorMessage, request } from '@shares/api';
import { AppShell, Button, inputClass, Notice, Panel } from '@shares/ui';
import partyArt from '@shares/assets/dungeon/party.webp';
import { PreferencesEditor } from './PreferencesEditor';
import { describeReason } from './match-reasons';

type Command = { endpoint: string; method?: string; body: unknown };
const phaseNames = {
  collecting: 'Собираем пожелания',
  voting: 'Выбираем игру',
  confirmed: 'Готовимся играть',
};

export function RoomPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copyMessage, setCopyMessage] = useState('');
  const key = ['room', id];
  const roomQuery = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const snapshot = await request<RoomSnapshot>(
        `/rooms/${encodeURIComponent(id)}`,
        { signal },
      );
      const current = queryClient.getQueryData<RoomSnapshot>(key);
      return current && current.version > snapshot.version ? current : snapshot;
    },
    refetchInterval: (query) => {
      const error = query.state.error;
      if (error instanceof ApiError && [403, 404, 410].includes(error.status))
        return false;
      return error instanceof ApiError && error.status === 429 ? 30_000 : 1000;
    },
    refetchOnWindowFocus: true,
    retry: false,
  });
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => request<Game[]>('/catalog', { signal }),
    staleTime: Infinity,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: ({ endpoint, method = 'POST', body }: Command) =>
      request<RoomSnapshot | { left: true }>(
        `/rooms/${encodeURIComponent(id)}${endpoint}`,
        { method, body },
      ),
    onSuccess: (result) => {
      if ('left' in result) {
        queryClient.removeQueries({ queryKey: key });
        void navigate('/');
        return;
      }
      queryClient.setQueryData<RoomSnapshot>(key, (current) =>
        current && current.version > result.version ? current : result,
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409)
        void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const room = roomQuery.data;
  const inaccessible =
    roomQuery.error instanceof ApiError &&
    [403, 404, 410].includes(roomQuery.error.status);
  if (!room || inaccessible)
    return (
      <AppShell>
        {roomQuery.isPending ? (
          <Notice>Открываем комнату…</Notice>
        ) : (
          <Panel title="Комната недоступна">
            <Notice error>{errorMessage(roomQuery.error)}</Notice>
            <p className="mb-5 text-xl leading-snug">
              Если вы ещё не вступали, откройте приглашение ведущего. Гостевой
              доступ привязан к cookie этого браузера.
            </p>
            <Button type="button" onClick={() => void roomQuery.refetch()}>
              Попробовать ещё раз
            </Button>
            <Link
              to="/create"
              className="ml-4 inline-block py-3 text-xl underline"
            >
              Создать свою комнату
            </Link>
          </Panel>
        )}
      </AppShell>
    );
  const viewer = room.members.find(
    (member) => member.id === room.viewerMemberId,
  );
  if (!viewer)
    return (
      <AppShell>
        <Notice error>
          Не удалось определить участника. Откройте приглашение ведущего заново.
        </Notice>
      </AppShell>
    );
  const games = catalogQuery.data ?? [];
  const gameById = (gameId: string | null) =>
    games.find((game) => game.id === gameId);
  const host = room.hostMemberId === viewer.id;
  const busy = mutation.isPending || roomQuery.isError;
  const allVoted = room.members.every((member) => member.voteGameId !== null);
  const readyCount = room.members.filter((member) => member.ready).length;
  const winner = gameById(room.winnerGameId);
  const inviteUrl = room.invitePath
    ? new URL(room.invitePath, window.location.origin).href
    : null;
  const versioned = { version: room.version };
  const round = { ...versioned, round: room.round };

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyMessage('Ссылка скопирована. Отправьте её друзьям.');
    } catch {
      setCopyMessage(
        'Не удалось скопировать автоматически. Выделите ссылку в поле и скопируйте её вручную.',
      );
    }
  }

  return (
    <AppShell>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-4xl font-bold leading-tight text-[#dfb768] sm:text-5xl">
            {room.title}
          </h1>
          <p className="mt-3 text-xl">
            {phaseNames[room.status]} · Раунд {room.round}
          </p>
        </div>
        <p className="text-lg text-[#bfc3cb]">
          {room.members.length} из {room.maxMembers} участников
          <br />
          Действует до{' '}
          {new Intl.DateTimeFormat('ru', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(room.expiresAt))}
        </p>
      </div>
      {mutation.isError && (
        <Notice error>{errorMessage(mutation.error)}</Notice>
      )}
      {roomQuery.isError && (
        <Notice error>
          Соединение прервано. Показаны последние данные; действия временно
          недоступны. Пробуем восстановить связь.
        </Notice>
      )}
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="grid min-w-0 gap-7">
          <Panel title="Ваш отряд">
            <ul className="grid gap-3" aria-label="Участники комнаты">
              {room.members.map((member, index) => (
                <li
                  key={member.id}
                  className="flex min-w-0 items-center gap-3 border-b border-[#536477] pb-3 last:border-0 last:pb-0"
                >
                  <div
                    className="size-14 shrink-0 border-2 border-[#a68953] bg-[#101722] bg-no-repeat [image-rendering:pixelated]"
                    style={{
                      backgroundImage: `url(${partyArt})`,
                      backgroundSize: '400% auto',
                      backgroundPosition: `${((index % 4) * 100) / 3}% center`,
                    }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="break-words text-2xl">
                      {member.displayName}
                      {member.id === viewer.id ? ' · Вы' : ''}
                    </p>
                    <p className="text-lg text-[#bfc3cb]">
                      {member.id === room.hostMemberId ? 'Ведущий · ' : ''}
                      {room.status === 'collecting'
                        ? member.preferences
                          ? 'Пожелания сохранены'
                          : 'Заполняет пожелания'
                        : room.status === 'voting'
                          ? member.voteGameId
                            ? 'Проголосовал'
                            : 'Выбирает игру'
                          : member.ready
                            ? 'Готов играть'
                            : 'Ещё не готов'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {host && inviteUrl && (
              <div className="mt-6 border-t-2 border-[#536477] pt-5">
                <label htmlFor="invite-link" className="mb-2 block text-xl">
                  Приглашение для друзей
                </label>
                <input
                  id="invite-link"
                  className={`${inputClass} text-base`}
                  readOnly
                  value={inviteUrl}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  type="button"
                  className="mt-3 w-full"
                  onClick={() => void copyInvite()}
                >
                  Скопировать приглашение
                </Button>
                <p className="mt-3 text-lg text-[#bfc3cb]">
                  Комната закрытая: ссылка даёт возможность вступить. Не
                  публикуйте её открыто.
                </p>
                {copyMessage && <Notice>{copyMessage}</Notice>}
              </div>
            )}
            {!host && (
              <Button
                type="button"
                className="mt-6 w-full"
                disabled={busy}
                onClick={() =>
                  mutation.mutate({
                    endpoint: '/membership',
                    method: 'DELETE',
                    body: versioned,
                  })
                }
              >
                Покинуть комнату
              </Button>
            )}
          </Panel>
          <Panel title="Ход вечера">
            <ol className="grid gap-3 text-xl leading-snug">
              <li>Сохраните время и пожелания по всем играм.</li>
              <li>Когда все ответят, ведущий откроет голосование.</li>
              <li>Выберите игру и подтвердите готовность.</li>
            </ol>
            <p className="mt-5 text-lg text-[#bfc3cb]">
              Новое вступление, выход участника или изменение условий начинает
              новый раунд. Старые голоса сбрасываются.
            </p>
          </Panel>
        </div>
        <div className="grid min-w-0 gap-7">
          {room.status === 'collecting' && (
            <Panel title="Ваши пожелания">
              {catalogQuery.isPending ? (
                <Notice>Загружаем каталог…</Notice>
              ) : catalogQuery.isError ? (
                <>
                  <Notice error>{errorMessage(catalogQuery.error)}</Notice>
                  <Button
                    type="button"
                    onClick={() => void catalogQuery.refetch()}
                  >
                    Загрузить каталог ещё раз
                  </Button>
                </>
              ) : (
                <PreferencesEditor
                  catalog={games}
                  initial={viewer.preferences}
                  saving={busy}
                  onSave={(preferences) =>
                    mutation.mutateAsync({
                      endpoint: '/preferences',
                      method: 'PUT',
                      body: { version: room.version, preferences },
                    })
                  }
                />
              )}
            </Panel>
          )}
          {room.status !== 'confirmed' && (
            <Panel
              title={
                room.status === 'voting'
                  ? 'Голосование'
                  : 'Что подходит компании'
              }
            >
              {room.matching.status === 'pending' ? (
                <Notice>
                  Ждём пожелания:{' '}
                  {room.matching.pendingMemberIds
                    .map(
                      (memberId) =>
                        room.members.find((member) => member.id === memberId)
                          ?.displayName ?? 'участник',
                    )
                    .join(', ')}
                  .
                </Notice>
              ) : room.matching.eligible.length === 0 ? (
                <Notice>
                  Общих вариантов пока нет. Посмотрите причины ниже и обсудите,
                  какие условия готовы изменить.
                </Notice>
              ) : (
                <ul className="grid gap-4" aria-label="Подходящие игры">
                  {room.matching.eligible.map((match) => {
                    const game = gameById(match.gameId);
                    return (
                      <li
                        key={match.gameId}
                        className="min-w-0 border-2 border-[#a68953] bg-[#101722] p-4"
                      >
                        <h3 className="break-words text-2xl text-[#f2d18c]">
                          {game?.name ?? match.gameId}
                        </h3>
                        <ul className="mt-3 grid gap-1 text-lg leading-snug text-[#bfc3cb]">
                          {match.reasons.map((reason, index) => (
                            <li key={`${reason.code}-${index}`}>
                              {describeReason(reason, room.members)}
                            </li>
                          ))}
                        </ul>
                        {room.status === 'voting' && (
                          <div className="mt-4">
                            <Button
                              type="button"
                              className="w-full"
                              disabled={busy}
                              aria-pressed={viewer.voteGameId === match.gameId}
                              onClick={() =>
                                mutation.mutate({
                                  endpoint: '/vote',
                                  method: 'PUT',
                                  body: { ...round, gameId: match.gameId },
                                })
                              }
                            >
                              {viewer.voteGameId === match.gameId
                                ? `Ваш голос: ${game?.name ?? match.gameId}`
                                : `Голосовать за ${game?.name ?? match.gameId}`}
                            </Button>
                            <p className="mt-2 text-lg text-[#bfc3cb]">
                              Голосов:{' '}
                              {
                                room.members.filter(
                                  (member) =>
                                    member.voteGameId === match.gameId,
                                ).length
                              }
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {room.status === 'collecting' && host && (
                <>
                  <Button
                    type="button"
                    className="mt-5 w-full"
                    disabled={
                      busy ||
                      room.members.length < 2 ||
                      room.matching.status !== 'ready'
                    }
                    onClick={() =>
                      mutation.mutate({ endpoint: '/voting', body: versioned })
                    }
                  >
                    Начать голосование
                  </Button>
                  <p className="mt-3 text-lg text-[#bfc3cb]">
                    Нужно минимум двое участников, все ответы и хотя бы одна
                    подходящая игра.
                  </p>
                </>
              )}
              {room.status === 'collecting' &&
                !host &&
                room.matching.status === 'ready' && (
                  <Notice>
                    Подбор готов. Ведущий откроет голосование, когда компания
                    соберётся.
                  </Notice>
                )}
              {room.status === 'voting' && host && (
                <Button
                  type="button"
                  className="mt-5 w-full"
                  disabled={busy || !allVoted}
                  onClick={() =>
                    mutation.mutate({ endpoint: '/finalize', body: round })
                  }
                >
                  Завершить голосование
                </Button>
              )}
              {room.status === 'voting' && (
                <p className="mt-4 text-lg text-[#bfc3cb]">
                  Проголосовали{' '}
                  {
                    room.members.filter((member) => member.voteGameId !== null)
                      .length
                  }{' '}
                  из {room.members.length}. Победит игра с наибольшим числом
                  голосов; при равенстве — с более высоким местом в подборе.
                </p>
              )}
              {room.matching.excluded.length > 0 && (
                <details className="mt-6">
                  <summary className="min-h-11 cursor-pointer py-2 text-xl underline">
                    Почему другие игры не подошли (
                    {room.matching.excluded.length})
                  </summary>
                  <ul className="mt-4 grid gap-4">
                    {room.matching.excluded.map((excluded) => (
                      <li
                        key={excluded.gameId}
                        className="border-t border-[#536477] pt-3"
                      >
                        <h3 className="text-xl text-[#dfb768]">
                          {gameById(excluded.gameId)?.name ?? excluded.gameId}
                        </h3>
                        <ul className="mt-2 grid gap-1 text-lg leading-snug text-[#bfc3cb]">
                          {excluded.reasons.map((reason, index) => (
                            <li key={`${reason.code}-${index}`}>
                              {describeReason(reason, room.members)}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Panel>
          )}
          {room.status === 'confirmed' && (
            <Panel title="Игра выбрана">
              <h2 className="break-words text-3xl font-bold text-[#dfb768] sm:text-4xl">
                {winner?.name ?? 'Выбранная игра'}
              </h2>
              <p className="my-5 text-xl">
                Готовы играть: {readyCount} из {room.members.length}.
              </p>
              <Button
                type="button"
                className="w-full"
                disabled={busy}
                aria-pressed={viewer.ready}
                onClick={() =>
                  mutation.mutate({
                    endpoint: '/ready',
                    method: 'PUT',
                    body: { ...round, ready: !viewer.ready },
                  })
                }
              >
                {viewer.ready ? 'Пока не готов' : 'Готов играть'}
              </Button>
              {readyCount === room.members.length && (
                <Notice>Весь отряд готов. Можно начинать игру!</Notice>
              )}
              {winner && (
                <a
                  href={winner.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-5 inline-block py-3 text-xl underline"
                >
                  Открыть страницу игры
                </a>
              )}
              <p className="mt-3 text-lg text-[#bfc3cb]">
                PartyPick помог выбрать. Саму игру запускайте привычным
                способом.
              </p>
            </Panel>
          )}
          {room.status !== 'collecting' &&
            (host ? (
              <Panel>
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    mutation.mutate({ endpoint: '/reopen', body: versioned })
                  }
                >
                  Изменить условия
                </Button>
                <p className="mt-3 text-lg text-[#bfc3cb]">
                  Начнётся новый раунд. Ответы останутся, голоса и готовность
                  сбросятся.
                </p>
              </Panel>
            ) : (
              <p className="px-4 text-lg leading-snug text-[#bfc3cb]">
                Хотите изменить пожелания? Попросите ведущего открыть новый
                раунд.
              </p>
            ))}
        </div>
      </div>
    </AppShell>
  );
}
