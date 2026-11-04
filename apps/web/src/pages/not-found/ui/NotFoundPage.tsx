import { Link } from 'react-router-dom';
import { AppShell, Panel } from '@shares/ui';
export function NotFoundPage() {
  return (
    <AppShell>
      <Panel>
        <h1 className="mb-4 text-4xl text-[#dfb768]">Здесь пока пусто</h1>
        <p className="mb-6 text-xl">
          Такой страницы нет. Проверьте ссылку или начните с главной.
        </p>
        <Link to="/" className="text-xl underline">
          На главную
        </Link>
      </Panel>
    </AppShell>
  );
}
