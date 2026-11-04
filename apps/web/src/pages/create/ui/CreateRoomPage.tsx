import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createRoomSchema, type RoomSnapshot } from '@partypick/contracts';
import { errorMessage, request } from '@shares/api';
import { AppShell, Button, Field, inputClass, Notice, Panel } from '@shares/ui';

export function CreateRoomPage() {
  const navigate = useNavigate();
  const [validation, setValidation] = useState('');
  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      request<RoomSnapshot>('/rooms', { method: 'POST', body }),
    onSuccess: (room) => void navigate(`/rooms/${room.id}`),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = createRoomSchema.safeParse({
      displayName: data.get('displayName'),
      title: data.get('title'),
      maxMembers: Number(data.get('maxMembers')),
    });
    if (!result.success) {
      setValidation('Проверьте имя, название и размер компании.');
      return;
    }
    setValidation('');
    mutation.mutate(result.data);
  }
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-5 text-4xl font-bold leading-tight text-[#dfb768] sm:text-5xl">
          Соберите свой отряд
        </h1>
        <p className="mb-7 text-xl leading-snug">
          Создайте закрытую комнату и отправьте ссылку друзьям. Вход без
          регистрации: участник сохраняется в этом браузере.
        </p>
        <Panel title="Новая комната">
          <form onSubmit={submit} className="grid gap-5">
            <Field
              label="Ваше имя"
              htmlFor="create-name"
              hint="От 2 до 24 символов. Его увидят участники комнаты."
            >
              <input
                id="create-name"
                name="displayName"
                className={inputClass}
                autoComplete="nickname"
                minLength={2}
                maxLength={24}
                required
              />
            </Field>
            <Field label="Название комнаты" htmlFor="create-title">
              <input
                id="create-title"
                name="title"
                className={inputClass}
                placeholder="Пятница, свои"
                minLength={3}
                maxLength={60}
                required
              />
            </Field>
            <Field label="Максимум участников" htmlFor="create-size">
              <select
                id="create-size"
                name="maxMembers"
                className={inputClass}
                defaultValue="4"
              >
                {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-lg leading-snug text-[#bfc3cb]">
              Комната действует 24 часа. Если удалить cookie или сменить
              браузер, доступ гостя не восстановится автоматически.
            </p>
            {validation && <Notice error>{validation}</Notice>}
            {mutation.isError && (
              <Notice error>{errorMessage(mutation.error)}</Notice>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Создаём комнату…' : 'Создать комнату'}
            </Button>
            <Link to="/" className="py-2 text-center text-lg underline">
              Вернуться на главную
            </Link>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
