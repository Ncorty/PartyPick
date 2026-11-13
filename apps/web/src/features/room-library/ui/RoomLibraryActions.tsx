import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  applyLibraryToPreferences,
  type LibrarySnapshot,
  type RoomSnapshot,
} from '@partypick/contracts';
import {
  applyLibrary,
  getLibraryMonotonic,
  libraryKey,
  latestLibrarySnapshot,
  patchLibrary,
} from '@entities/library';
import { ApiError, errorMessage } from '@shares/api';
import { Button, Notice, Panel } from '@shares/ui';

export function RoomLibraryActions({ room }: { room: RoomSnapshot }) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<{
    version: number;
    libraryVersion: number;
    count: number;
  } | null>(null);
  const [importConflict, setImportConflict] = useState(false);
  const libraryQuery = useQuery({
    queryKey: libraryKey,
    queryFn: () => getLibraryMonotonic(queryClient),
    refetchOnWindowFocus: true,
  });
  const member = room.members.find((entry) => entry.id === room.viewerMemberId);
  const host = room.hostMemberId === room.viewerMemberId;
  const library =
    libraryQuery.isFetchedAfterMount &&
    libraryQuery.data &&
    Date.parse(libraryQuery.data.sessionExpiresAt) > Date.now()
      ? libraryQuery.data
      : null;
  const applicable =
    library?.entries.filter((entry) =>
      room.catalog.some((game) => game.id === entry.gameId),
    ) ?? [];
  const next = member?.preferences
    ? applyLibraryToPreferences(member.preferences, applicable)
    : null;
  const changeCount =
    next && member?.preferences
      ? next.games.filter((game) => {
          const old = member.preferences?.games.find(
            (entry) => entry.gameId === game.gameId,
          );
          return (
            game.owned !== (old?.owned ?? false) ||
            game.installed !== (old?.installed ?? false)
          );
        }).length
      : 0;
  const owned = member?.preferences?.games.filter((game) => game.owned) ?? [];
  const importMutation = useMutation({
    mutationFn: () => {
      if (!library) throw new Error('Library is not loaded');
      return patchLibrary(
        library.version,
        owned.map((game) => ({
          gameId: game.gameId,
          availability: game.installed ? 'installed' : 'available',
        })),
      );
    },
    onSuccess: async (snapshot) => {
      await queryClient.cancelQueries({ queryKey: libraryKey });
      queryClient.setQueryData<LibrarySnapshot>(libraryKey, (current) =>
        latestLibrarySnapshot(current, snapshot),
      );
      setImportConflict(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409)
        setImportConflict(true);
    },
  });
  const applyMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('Preview is not ready');
      return applyLibrary(room.id, preview.version, preview.libraryVersion);
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData<RoomSnapshot>(['room', room.id], (current) =>
        current && current.version > snapshot.version ? current : snapshot,
      );
      setPreview(null);
    },
  });
  async function refreshPreview() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['room', room.id] }),
      queryClient.invalidateQueries({ queryKey: libraryKey }),
    ]);
    setPreview(null);
    applyMutation.reset();
  }
  async function refreshImport() {
    const result = await libraryQuery.refetch();
    if (!result.isSuccess) return;
    setImportConflict(false);
    importMutation.reset();
  }
  return (
    <Panel title="Сохранённая библиотека">
      <p className="text-lg leading-snug text-[#bfc3cb]">
        Библиотека хранит доступ и установку для новых комнат. Желание играть и
        условия вечера остаются только здесь.{' '}
        <Link to="/library" className="text-[#f2d18c] underline">
          Открыть библиотеку
        </Link>
      </p>
      {libraryQuery.isPending && <Notice>Загружаем библиотеку…</Notice>}
      {libraryQuery.isError && (
        <Notice error>
          Не удалось загрузить библиотеку. Ручные пожелания доступны.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void libraryQuery.refetch()}
          >
            Повторить
          </button>
        </Notice>
      )}
      {library && (
        <p className="mt-3 text-lg">
          Сохранено отметок: {library.entries.length}. Игры для обновления:{' '}
          {changeCount}.
        </p>
      )}
      {member?.preferences && (
        <div className="mt-5 border-t-2 border-[#536477] pt-4">
          <p className="mb-3 text-lg leading-snug text-[#bfc3cb]">
            Сохранить доступные игры из своих ответов в библиотеку:{' '}
            {owned.length}. Заменим только эти записи; игры без отметки доступа
            не переносим.
          </p>
          <Button
            type="button"
            disabled={
              !library ||
              owned.length === 0 ||
              importMutation.isPending ||
              importConflict
            }
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending
              ? 'Сохраняем…'
              : 'Сохранить доступные игры в библиотеку'}
          </Button>
          {importMutation.isSuccess && (
            <Notice>
              Доступные игры сохранены в библиотеке. Комната не изменилась.
            </Notice>
          )}
          {importConflict && (
            <Notice error>
              Библиотека изменилась в другой вкладке. Проверьте её перед
              повторным импортом.{' '}
              <Link to="/library" className="underline">
                Открыть библиотеку
              </Link>
              {' · '}
              <button
                type="button"
                className="underline"
                onClick={() => void refreshImport()}
              >
                Обновить данные для импорта
              </button>
            </Notice>
          )}
          {importMutation.isError && !importConflict && (
            <Notice error>{errorMessage(importMutation.error)}</Notice>
          )}
        </div>
      )}
      {room.status !== 'collecting' && (
        <div className="mt-5 border-t-2 border-[#536477] pt-4">
          {!host ? (
            <p className="text-lg leading-snug">
              Применить новые отметки к комнате можно в следующем раунде,
              который открывает ведущий.
            </p>
          ) : (
            <>
              <p className="text-lg leading-snug">
                Применение изменит только вашу доступность. Голосование и
                готовность сбросятся, если есть изменения.
              </p>
              {!preview ? (
                <Button
                  type="button"
                  className="mt-3"
                  disabled={!library || changeCount === 0}
                  onClick={() => {
                    if (library)
                      setPreview({
                        version: room.version,
                        libraryVersion: library.version,
                        count: changeCount,
                      });
                  }}
                >
                  Посмотреть применение ({changeCount})
                </Button>
              ) : (
                <div className="mt-3 border-2 border-[#a68953] bg-[#101722] p-3">
                  <p className="mb-3 text-lg">
                    Игры для обновления: {preview.count}. Начнётся новый раунд;
                    чужие ответы и ваши запреты останутся.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      disabled={applyMutation.isPending}
                      onClick={() => applyMutation.mutate()}
                    >
                      {applyMutation.isPending
                        ? 'Применяем…'
                        : 'Применить и начать новый раунд'}
                    </Button>
                    <Button type="button" onClick={() => setPreview(null)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
              {applyMutation.isError && (
                <Notice error>
                  {applyMutation.error instanceof ApiError &&
                  applyMutation.error.status === 409 ? (
                    <>
                      Комната или библиотека изменилась после предпросмотра.{' '}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => void refreshPreview()}
                      >
                        Обновить предпросмотр
                      </button>{' '}
                      и подтвердите действие заново.
                    </>
                  ) : (
                    errorMessage(applyMutation.error)
                  )}
                </Notice>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
