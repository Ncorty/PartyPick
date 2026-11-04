import { useApiHealth } from '../../../shared/api';
import styles from './HomePage.module.css';

const participants = ['Лёша', 'Соня', 'Миша', 'Ты'];

function DevelopmentStatus() {
  const health = useApiHealth();
  return (
    <details className={styles.technical}>
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
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main">
        К содержимому
      </a>
      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="PartyPick — главная">
          <svg
            className={styles.logo}
            viewBox="0 0 24 20"
            aria-hidden="true"
            shapeRendering="crispEdges"
          >
            <path
              d="M4 0h16v4h4v12h-4v4h-4v-4H8v4H4v-4H0V4h4z"
              fill="currentColor"
            />
            <path
              d="M5 5h3v3h3v3H8v3H5v-3H2V8h3zM16 6h3v3h-3zM19 10h3v3h-3z"
              fill="#f4efdf"
            />
          </svg>
          PARTY<span>PICK</span>
        </a>
        <nav className={styles.nav} aria-label="Главная навигация">
          <a href="#how">Как это работает</a>
          <span className={styles.version}>ВЕРСИЯ 0.1</span>
        </nav>
      </header>
      <main id="main">
        <section className={styles.hero} aria-labelledby="headline">
          <div className={styles.pitch}>
            <p className={styles.eyebrow}>
              <span aria-hidden="true">■</span> ДЛЯ ВАШЕЙ ПАТИ
            </p>
            <h1 id="headline">
              Все в сборе.
              <br />
              Во что <span>играем?</span>
            </h1>
            <p className={styles.intro}>
              Один вечер, разные пожелания. Найдите игру, которая подходит всей
              компании.
            </p>
            <a className={styles.primaryLink} href="#preview">
              Посмотреть пример <span aria-hidden="true">↘</span>
            </a>
            <p className={styles.stage}>
              Проект в разработке. Комнаты скоро появятся.
            </p>
          </div>
          <section
            className={styles.lobby}
            id="preview"
            aria-labelledby="lobby-title"
          >
            <div className={styles.windowBar}>
              <span>PARTY_01</span>
              <span className={styles.demo}>ПРИМЕР ЛОББИ</span>
              <span aria-hidden="true">▪ ▪ ▪</span>
            </div>
            <div className={styles.lobbyBody}>
              <div className={styles.lobbyHeading}>
                <h2 id="lobby-title">Пятница, свои</h2>
                <span className={styles.playerCount}>4 ИГРОКА</span>
              </div>
              <ul className={styles.players} aria-label="Пример участников">
                {participants.map((name, index) => (
                  <li key={name}>
                    <span
                      className={`${styles.avatar} ${styles[`avatar${index}`]}`}
                      aria-hidden="true"
                    >
                      <span>▪ ▪</span>
                      <span>━</span>
                    </span>
                    <span>{name}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.conditions}>
                <span>~ 60 минут</span>
                <span>Кооператив</span>
                <span>Без покупок</span>
              </div>
              <div className={styles.match}>
                <div className={styles.gameArt} aria-hidden="true">
                  <span>★</span>
                  <i />
                  <b />
                </div>
                <div>
                  <p className={styles.matchLabel}>ПОДХОДИТ КОМПАНИИ</p>
                  <h3>Вечер приключений</h3>
                  <p className={styles.matchReason}>
                    Есть у всех · На четверых · Никто не против
                  </p>
                </div>
              </div>
              <p className={styles.previewNote}>
                Вымышленные участники и игра — так будет выглядеть совместный
                выбор.
              </p>
            </div>
          </section>
        </section>
        <section className={styles.how} id="how" aria-labelledby="how-title">
          <div className={styles.sectionHeading}>
            <h2 id="how-title">От «я не знаю» до «погнали».</h2>
            <span>ТРИ ПРОСТЫХ ШАГА</span>
          </div>
          <ol className={styles.steps}>
            <li>
              <span className={styles.stepNumber}>01</span>
              <h3>Соберите своих</h3>
              <p>
                Одна ссылка для всей компании. Каждый присоединяется со своего
                устройства.
              </p>
            </li>
            <li>
              <span className={styles.stepNumber}>02</span>
              <h3>Задайте условия</h3>
              <p>
                Сколько есть времени, какие игры доступны и чего хочется именно
                сегодня.
              </p>
            </li>
            <li>
              <span className={styles.stepNumber}>03</span>
              <h3>Выберите вместе</h3>
              <p>
                Короткий список подходящих игр с понятным объяснением для
                каждого варианта.
              </p>
            </li>
          </ol>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>Хорошая компания. Хороший вечер.</p>
        {import.meta.env.DEV && <DevelopmentStatus />}
      </footer>
    </div>
  );
}
