import { useApiHealth } from '@shares/api';
import adventureArt from '@shares/assets/dungeon/adventure.webp';
import hallArt from '@shares/assets/dungeon/hall.webp';
import partyArt from '@shares/assets/dungeon/party.webp';
import goldFrame from '@shares/assets/dungeon/gold-frame.webp';
import stoneFrame from '@shares/assets/dungeon/stone-frame.webp';
import type { CSSProperties } from 'react';

const goldBorder =
  'border-[18px] border-transparent [border-image-source:var(--gold-frame)] [border-image-slice:190] [border-image-repeat:stretch] [border-image-width:28px] [border-image-outset:6px] [background-clip:padding-box]';

function MenuLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className={`${goldBorder} relative flex min-h-[72px] items-center justify-center px-4 py-1 text-center text-[clamp(20px,2vw,27px)] leading-tight no-underline hover:brightness-125 focus-visible:brightness-125 active:translate-y-1 max-[850px]:text-[23px] max-[540px]:text-[25px] ${primary ? 'bg-[#352a20]' : 'bg-[#202b3b] [border-image-source:var(--stone-frame)] [border-image-slice:256]'}`}
    >
      {primary && (
        <span
          className="absolute left-1 size-0 border-y-8 border-l-[10px] border-y-transparent border-l-[#f1d895]"
          aria-hidden="true"
        />
      )}
      {children}
    </a>
  );
}

const participants = ['Лёша', 'Соня', 'Миша', 'Ты'];
type IconName = 'party' | 'time' | 'game' | 'check' | 'info' | 'list';
function PixelIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    party: 'M3 2h4v4H3zM11 2h4v4h-4zM1 8h8v6H1zM10 8h8v6h-8z',
    time: 'M3 1h12v2H3zM3 15h12v2H3zM5 3h8v3h-2v2H7V6H5zM7 10h4v2h2v3H5v-3h2z',
    game: 'M4 3h10v2h2v2h2v8h-4v-3H4v3H0V7h2V5h2zM4 6v2H2v2h2v2h2v-2h2V8H6V6zM12 7h2v2h-2zM14 9h2v2h-2z',
    check: 'M1 8h3v3h3V8h3V5h3V2h3v5h-3v3h-3v3H7v3H4v-3H1z',
    info: 'M6 0h6v2h4v4h2v6h-2v4h-4v2H6v-2H2v-4H0V6h2V2h4zM8 4v3h2V4zM8 9v5h2V9z',
    list: 'M3 0h12v2h3v14h-3v2H3v-2H0V2h3zM4 5v2h2V5zM8 5v2h6V5zM4 10v2h2v-2zM8 10v2h6v-2z',
  };
  return (
    <svg
      className="size-[25px] shrink-0 text-[#dfb768]"
      viewBox="0 0 18 18"
      fill="currentColor"
      fillRule="evenodd"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function DevelopmentStatus() {
  const health = useApiHealth();
  return (
    <details className="max-w-[350px] [&_summary]:cursor-pointer [&_summary]:py-2.5 [&_p]:mt-2.5">
      <summary>Статус разработки</summary>
      <p role="status">
        {health === 'loading'
          ? 'Проверяем соединение с API…'
          : health === 'online'
            ? 'API подключён. Технический каркас готов.'
            : 'API недоступен. Запустите сервер и обновите страницу.'}
      </p>
    </details>
  );
}
export function HomePage() {
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
        className="absolute -top-[100px] left-4 z-10 bg-[#151e2a] p-3.5 focus:top-4"
        href="#main"
      >
        К содержимому
      </a>
      <header className="flex min-h-[74px] items-center justify-between gap-6 border-b-[3px] border-[#a68953] bg-[#101722ed] px-[max(28px,calc((100vw-1400px)/2))] py-3 shadow-[0_3px_#342d24] max-[850px]:px-6 max-[540px]:min-h-16 max-[540px]:gap-3.5 max-[540px]:px-[18px] max-[540px]:py-2.5">
        <a
          href="/"
          className="flex items-center gap-[18px] font-['Not_A_Bug','Pixelify_Sans',sans-serif] text-[30px] tracking-[1px] no-underline max-[850px]:gap-3 max-[850px]:text-[26px] max-[540px]:gap-2 max-[540px]:text-xl max-[540px]:tracking-normal"
          aria-label="PartyPick — главная"
        >
          <span className="grid h-11 w-[42px] place-items-center border-[3px] border-[#bda67a] bg-[#263345] shadow-[inset_0_0_0_3px_#111923] max-[540px]:h-8 max-[540px]:w-7 max-[540px]:border-2 max-[540px]:[&_svg]:size-[18px]">
            <PixelIcon name="party" />
          </span>
          PARTY PICK
        </a>
        <a
          className="underline py-2.5 text-[23px] max-[850px]:text-[21px] max-[540px]:max-w-[100px] max-[540px]:text-right max-[540px]:text-[17px] max-[540px]:leading-[1.2]"
          href="#how"
        >
          Как это работает
        </a>
      </header>
      <main
        id="main"
        className="mx-auto max-w-[1440px] px-10 pt-9 pb-5 min-[1600px]:pt-[76px] max-[1100px]:px-[26px] max-[1100px]:pt-[54px] max-[540px]:px-5 max-[540px]:pt-[34px] max-[540px]:pb-2.5"
      >
        <section
          className="grid grid-cols-[minmax(280px,.8fr)_minmax(0,1.7fr)] items-start gap-[42px] max-[1100px]:grid-cols-[minmax(240px,.85fr)_minmax(0,1.7fr)] max-[1100px]:gap-7 max-[850px]:grid-cols-1 max-[850px]:gap-[58px] max-[540px]:gap-[54px]"
          aria-labelledby="headline"
        >
          <div className="bg-[#111923cc] pt-[42px] [&_h1]:mb-5 [&_h1]:text-[clamp(42px,4.8vw,70px)] [&_h1]:font-bold [&_h1]:leading-[1.02] [&_h1]:text-[#dfb768] [&_h1]:[text-shadow:3px_3px_#614321,5px_5px_#0c111a] max-[850px]:mx-auto max-[850px]:w-full max-[850px]:max-w-[560px] max-[850px]:pt-0 max-[850px]:[&_h1]:text-[60px] max-[540px]:[&_h1]:text-[52px]">
            <h1 id="headline">
              Собери
              <br />
              свой отряд.
            </h1>
            <p className="mb-9 max-w-[350px] text-[clamp(23px,2.1vw,29px)] leading-[1.3] max-[850px]:max-w-none max-[850px]:text-[27px] max-[540px]:mb-7 max-[540px]:text-[25px]">
              Подберём игру под время и пожелания каждого.
            </p>
            <nav
              className="grid gap-4 max-[850px]:grid-cols-2 max-[540px]:grid-cols-1"
              aria-label="Начать знакомство"
            >
              <MenuLink href="/create" primary>
                Создать комнату
              </MenuLink>
              <MenuLink href="#preview">Посмотреть пример</MenuLink>
            </nav>
            <p className="mt-[34px] flex items-center gap-4 text-[21px] leading-[1.25] text-[#bfc3cb] max-[850px]:mt-[25px] max-[850px]:[&_br]:hidden max-[540px]:text-[19px]">
              <PixelIcon name="info" />
              <span>
                Справа — пример. <br />
                Соберите свой отряд по ссылке.
              </span>
            </p>
          </div>
          <section
            className="relative min-w-0 border-[44px] border-transparent bg-[#151e2af5] px-3 pb-2 [border-image-source:var(--stone-frame)] [border-image-slice:256] [border-image-repeat:stretch] [background-clip:padding-box] max-[540px]:border-[22px] max-[540px]:px-1"
            id="preview"
            aria-labelledby="lobby-title"
          >
            <div
              className={`${goldBorder} relative mx-auto -mt-16 mb-2 w-fit max-w-full bg-[#1b2533] px-4 py-1 text-center text-[clamp(29px,3.3vw,45px)] font-bold leading-tight text-[#f2d18c] max-[540px]:-mt-12 max-[540px]:px-1 max-[540px]:text-[26px]`}
            >
              Пример комнаты
            </div>
            <h2
              className={`${goldBorder} mx-auto mb-3 w-fit max-w-full bg-[#1c2734] px-3 text-center text-[25px] font-normal leading-tight max-[540px]:text-[21px]`}
              id="lobby-title"
            >
              Пятница, свои
            </h2>
            <ul
              className="mb-4 grid list-none grid-cols-4 gap-3 p-0 max-[540px]:gap-1"
              aria-label="Пример участников"
            >
              {participants.map((name, index) => (
                <li
                  key={name}
                  className="min-w-0 border-[14px] border-transparent bg-[#111923] [border-image-source:var(--gold-frame)] [border-image-slice:190] [background-clip:padding-box] max-[540px]:border-[6px] max-[360px]:border-[4px]"
                >
                  <div
                    className="mx-1 mt-1 aspect-[1.18/1] overflow-hidden max-[540px]:mx-0.5 max-[540px]:mt-[3px] max-[540px]:aspect-[1/1.2]"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full w-full bg-size-[400%_auto] bg-no-repeat"
                      style={{
                        backgroundImage: `url(${partyArt})`,
                        backgroundPosition: `${(index * 100) / 3}% center`,
                      }}
                    />
                  </div>
                  <span className="block border-t-[3px] border-[#aa8a50] bg-[#1b2531] px-1 py-1.5 text-center text-2xl leading-none max-[540px]:border-t-2 max-[540px]:px-px max-[540px]:py-[5px] max-[540px]:text-xl max-[360px]:px-0 max-[360px]:text-[16px]">
                    {name}
                  </span>
                </li>
              ))}
            </ul>
            <ul
              className="mb-4 flex list-none flex-wrap justify-around gap-2.5 border-[3px] border-[#788594] bg-[#222b39] px-2 py-3 shadow-[inset_2px_2px_#a2a7a3,inset_-2px_-2px_#354252] [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li]:text-[23px] [&_li]:leading-[1.2] max-[1100px]:[&_li]:gap-1.5 max-[1100px]:[&_li]:text-[19px] max-[1100px]:[&_svg]:size-[21px] max-[850px]:[&_li]:text-[23px] max-[540px]:mb-[18px] max-[540px]:gap-x-3 max-[540px]:gap-y-[9px] max-[540px]:px-1.5 max-[540px]:py-2.5 max-[540px]:[&_li]:text-[19px] max-[540px]:[&_svg]:size-[19px]"
              aria-label="Условия вечера"
            >
              <li>
                <PixelIcon name="time" />
                60 минут
              </li>
              <li>
                <PixelIcon name="party" />
                Кооператив
              </li>
              <li>
                <PixelIcon name="game" />
                Без покупок
              </li>
            </ul>
            <div
              className={`${goldBorder} grid grid-cols-[minmax(100px,31%)_minmax(0,1fr)] bg-[#18212d] max-[1100px]:grid-cols-[28%_minmax(0,1fr)] max-[540px]:grid-cols-1`}
            >
              <img
                className="h-[190px] w-full object-cover max-[540px]:h-[150px] max-[540px]:min-h-0 max-[540px]:object-[center_52%]"
                src={adventureArt}
                alt="Четверо искателей приключений перед входом в подземелье"
              />
              <div className="px-3.5 pt-4 pb-3 [&_h3]:mb-3 [&_h3]:text-[clamp(25px,2.6vw,36px)] [&_h3]:leading-[1.05] max-[540px]:px-3 max-[540px]:py-3.5 max-[540px]:[&_h3]:text-[30px] max-[360px]:px-2 max-[360px]:[&_h3]:text-[24px] [&_h3]:break-words">
                <h3>Вечер приключений</h3>
                <p className="mb-4 flex items-center gap-2.5 text-[clamp(20px,2vw,26px)] leading-[1.1] text-[#a8dc83] [&_svg]:size-[22px] [&_svg]:text-[#a8dc83] max-[540px]:text-[23px]">
                  <PixelIcon name="check" />
                  Подходит всем четверым
                </p>
                <ul className="m-0 flex list-none flex-wrap justify-between gap-x-3.5 gap-y-1.5 border-t-2 border-[#5e6872] pt-3 text-[18px] leading-[1.2] max-[540px]:text-[19px]">
                  <li>Есть у всех</li>
                  <li>На четверых</li>
                  <li>Никто не против</li>
                </ul>
              </div>
            </div>
            <p className="mt-[18px] text-center text-[18px] text-[#b5bac5] max-[540px]:text-[17px] max-[540px]:leading-[1.3]">
              Вымышленные участники и игра
            </p>
          </section>
        </section>
        <section
          className="mt-5 max-[540px]:mt-[30px]"
          id="how"
          aria-labelledby="how-title"
        >
          <h2 id="how-title" className="sr-only">
            Как это работает
          </h2>
          <ol className="m-0 grid list-none grid-cols-3 gap-8 p-0 [&_p]:mx-2.5 [&_p]:mt-4 [&_p]:text-[19px] [&_p]:leading-[1.4] [&_p]:text-[#d5d1c7] max-[850px]:gap-[18px] max-[540px]:grid-cols-1 max-[540px]:gap-6 max-[540px]:[&_p]:mt-3 max-[540px]:[&_p]:text-xl">
            <li>
              <div className="flex min-h-[62px] items-center justify-center gap-3.5 border-[3px] border-[#a98a52] bg-[#1c2735] p-2.5 shadow-[inset_2px_2px_#d6bc82,inset_-2px_-2px_#51412d] [&_h3]:m-0 [&_h3]:text-[25px] [&_h3]:font-normal [&_h3]:leading-[1.1] max-[1100px]:gap-[9px] max-[1100px]:[&_h3]:text-[22px] max-[850px]:flex-col max-[850px]:text-center max-[850px]:[&_h3]:text-[23px] max-[540px]:min-h-14 max-[540px]:flex-row max-[540px]:[&_h3]:text-[25px]">
                <PixelIcon name="party" />
                <h3>Соберите компанию</h3>
              </div>
              <p>
                Одна ссылка для друзей. Каждый присоединяется со своего
                устройства.
              </p>
            </li>
            <li>
              <div className="flex min-h-[62px] items-center justify-center gap-3.5 border-[3px] border-[#a98a52] bg-[#1c2735] p-2.5 shadow-[inset_2px_2px_#d6bc82,inset_-2px_-2px_#51412d] [&_h3]:m-0 [&_h3]:text-[25px] [&_h3]:font-normal [&_h3]:leading-[1.1] max-[1100px]:gap-[9px] max-[1100px]:[&_h3]:text-[22px] max-[850px]:flex-col max-[850px]:text-center max-[850px]:[&_h3]:text-[23px] max-[540px]:min-h-14 max-[540px]:flex-row max-[540px]:[&_h3]:text-[25px]">
                <PixelIcon name="time" />
                <h3>Задайте условия</h3>
              </div>
              <p>
                Укажите доступные игры, время и то, во что хочется играть
                сегодня.
              </p>
            </li>
            <li>
              <div className="flex min-h-[62px] items-center justify-center gap-3.5 border-[3px] border-[#a98a52] bg-[#1c2735] p-2.5 shadow-[inset_2px_2px_#d6bc82,inset_-2px_-2px_#51412d] [&_h3]:m-0 [&_h3]:text-[25px] [&_h3]:font-normal [&_h3]:leading-[1.1] max-[1100px]:gap-[9px] max-[1100px]:[&_h3]:text-[22px] max-[850px]:flex-col max-[850px]:text-center max-[850px]:[&_h3]:text-[23px] max-[540px]:min-h-14 max-[540px]:flex-row max-[540px]:[&_h3]:text-[25px]">
                <PixelIcon name="list" />
                <h3>Выберите вместе</h3>
              </div>
              <p>
                Получите короткий список игр с объяснением, почему они подходят.
              </p>
            </li>
          </ol>
        </section>
      </main>
      <footer className="mx-auto mt-6 flex max-w-[1360px] flex-wrap items-baseline justify-between gap-[18px] bg-[#111923dd] px-10 pt-5 pb-[26px] text-[17px] text-[#bfc3cb] [&_p]:m-0 max-[540px]:mt-5 max-[540px]:p-5">
        <p>Хорошая компания. Хороший вечер.</p>
        <span>Версия 0.1</span>
        {import.meta.env.DEV && <DevelopmentStatus />}
      </footer>
    </div>
  );
}
