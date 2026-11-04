import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import hallArt from '../assets/dungeon/hall.webp';
import goldFrame from '../assets/dungeon/gold-frame.webp';
import stoneFrame from '../assets/dungeon/stone-frame.webp';

export const inputClass =
  'w-full min-w-0 border-2 border-[#788594] bg-[#101722] px-3 py-2 text-xl text-[#f1e5c6] placeholder:text-[#b4b8bf] disabled:opacity-60';
export const menuClass =
  'inline-flex min-h-12 items-center justify-center border-[10px] border-transparent bg-[#352a20] px-3 py-1 text-center text-xl leading-tight text-[#f1e5c6] no-underline [border-image-source:var(--gold-frame)] [border-image-slice:190] [background-clip:padding-box] hover:brightness-125 focus-visible:brightness-125 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#111923] bg-cover bg-top bg-no-repeat [image-rendering:pixelated]"
      style={
        {
          backgroundImage: `url(${hallArt})`,
          '--gold-frame': `url(${goldFrame})`,
          '--stone-frame': `url(${stoneFrame})`,
        } as CSSProperties
      }
    >
      <a
        href="#main"
        className="absolute -top-24 left-4 z-20 bg-[#151e2a] p-3 focus:top-4"
      >
        К содержимому
      </a>
      <header className="flex min-h-20 items-center justify-between gap-4 border-b-2 border-[#a68953] bg-[#101722ed] px-5 py-4 sm:px-10">
        <Link
          to="/"
          className="shrink-0 whitespace-nowrap font-['Not_A_Bug','Pixelify_Sans',sans-serif] text-[18px] tracking-wide no-underline sm:text-3xl"
          aria-label="PartyPick — главная"
        >
          PARTY PICK
        </Link>
        <Link
          to="/create"
          className="max-w-[110px] py-2 text-right text-lg leading-tight underline sm:max-w-none sm:text-xl"
        >
          Создать комнату
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        {children}
      </main>
      <footer className="mt-8 bg-[#111923dd] px-5 py-5 text-center text-lg text-[#bfc3cb]">
        PartyPick · Комнаты по приглашению · MVP
      </footer>
    </div>
  );
}

export function Panel({
  children,
  title,
  className = '',
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 border-[18px] border-transparent bg-[#151e2af5] p-3 [border-image-source:var(--stone-frame)] [border-image-slice:256] [background-clip:padding-box] sm:border-[24px] sm:p-5 ${className}`}
    >
      {title && (
        <h2 className="mb-5 text-2xl font-bold text-[#dfb768] sm:text-3xl">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${menuClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-2 block text-xl text-[#f1e5c6]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-2 text-lg leading-snug text-[#bfc3cb]">{hint}</p>
      )}
    </div>
  );
}

export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`my-4 break-words border-2 px-4 py-3 text-xl leading-snug ${error ? 'border-[#d78c76] bg-[#351e24] text-[#ffd4c2]' : 'border-[#788594] bg-[#202b3b] text-[#f1e5c6]'}`}
    >
      {children}
    </p>
  );
}
