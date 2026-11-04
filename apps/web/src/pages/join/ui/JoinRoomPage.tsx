import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  joinRoomSchema,
  type InviteInfo,
  type RoomSnapshot,
} from '@partypick/contracts';
import { errorMessage, request } from '@shares/api';
import { AppShell, Button, Field, inputClass, Notice, Panel } from '@shares/ui';

export function JoinRoomPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [validation, setValidation] = useState('');
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: ({ signal }) =>
      request<InviteInfo>(`/invites/${encodeURIComponent(token)}`, { signal }),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      request<RoomSnapshot>(`/invites/${encodeURIComponent(token)}/join`, {
        method: 'POST',
        body,
      }),
    onSuccess: (room) => void navigate(`/rooms/${room.id}`),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = joinRoomSchema.safeParse({
      displayName: new FormData(event.currentTarget).get('displayName'),
    });
    if (!result.success) {
      setValidation('Введите имя от 2 до 24 символов.');
      return;
    }
    setValidation('');
    mutation.mutate(result.data);
  }
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-4xl font-bold text-[#dfb768]">
          Вас ждёт компания
        </h1>
        {invite.isPending ? (
          <Notice>Проверяем приглашение…</Notice>
        ) : invite.isError ? (
          <Panel title="Приглашение недоступно">
            <Notice error>{errorMessage(invite.error)}</Notice>
            <p className="mb-5 text-xl">
              Попросите ведущего отправить действующую ссылку или создайте свою
              комнату.
            </p>
            <Link to="/create" className="py-3 text-xl underline">
              Создать комнату
            </Link>
          </Panel>
        ) : (
          <Panel title={invite.data.title}>
            <p className="mb-6 text-xl">
              В комнате {invite.data.memberCount} из {invite.data.maxMembers}{' '}
              участников.
            </p>
            <form className="grid gap-5" onSubmit={submit}>
              <Field
                label="Ваше имя"
                htmlFor="join-name"
                hint="Вход сохранится в этом браузере. После удаления cookie потребуется новое приглашение."
              >
                <input
                  id="join-name"
                  name="displayName"
                  className={inputClass}
                  autoComplete="nickname"
                  minLength={2}
                  maxLength={24}
                  required
                />
              </Field>
              {validation && <Notice error>{validation}</Notice>}
              {mutation.isError && (
                <Notice error>{errorMessage(mutation.error)}</Notice>
              )}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Входим…' : 'Войти в комнату'}
              </Button>
            </form>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
