import { expect, test, type Page } from '@playwright/test';

const origin = 'http://127.0.0.1:5175';
async function capture(page: Page, state: string) {
  const original = page.viewportSize();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `test-results/library-${state}-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  if (original) await page.setViewportSize(original);
}

test('library saves hidden entries, detects a second-tab conflict, and prefills two room drafts', async ({
  page,
  context,
}) => {
  let sessionPosts = 0;
  await page.route('**/api/guest-session', async (route) => {
    sessionPosts += 1;
    await route.continue();
  });
  await page.goto('/library');
  await expect(
    page.getByRole('heading', { name: 'Моя библиотека' }),
  ).toBeVisible();
  await expect(page.getByText('Найдено: 81 из 81')).toBeVisible();
  expect(sessionPosts).toBe(1);
  await capture(page, 'empty');
  await page
    .getByRole('combobox', { name: 'Deep Rock Galactic: доступ и установка' })
    .selectOption('installed');
  await page
    .getByRole('combobox', { name: 'Valheim: доступ и установка' })
    .selectOption('available');
  await page.getByRole('combobox', { name: 'Показать' }).selectOption('known');
  await expect(page.getByText('Найдено: 2 из 81')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Найти игру' }).fill('кс');
  await expect(page.getByText('По этим фильтрам игр нет.')).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await page.getByRole('button', { name: 'Сохранить изменения (2)' }).click();
  await expect(page.getByText('Библиотека сохранена.')).toBeVisible();
  await capture(page, 'filled');
  await page.reload();
  await expect(
    page.getByRole('combobox', {
      name: 'Deep Rock Galactic: доступ и установка',
    }),
  ).toHaveValue('installed');
  const otherTab = await context.newPage();
  await otherTab.goto('/library');
  await expect(
    otherTab.getByRole('combobox', {
      name: 'Deep Rock Galactic: доступ и установка',
    }),
  ).toHaveValue('installed');
  await page
    .getByRole('combobox', { name: 'Valheim: доступ и установка' })
    .selectOption('installed');
  await otherTab
    .getByRole('combobox', { name: 'Deep Rock Galactic: доступ и установка' })
    .selectOption('unavailable');
  await otherTab
    .getByRole('button', { name: 'Сохранить изменения (1)' })
    .click();
  await expect(otherTab.getByText('Библиотека сохранена.')).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить изменения (1)' }).click();
  await expect(
    page.getByText('Библиотека изменилась в другой вкладке.'),
  ).toBeVisible();
  await capture(page, 'conflict');
  await page
    .getByRole('button', { name: 'Загрузить актуальную версию' })
    .click();
  await expect(
    page.getByRole('combobox', {
      name: 'Deep Rock Galactic: доступ и установка',
    }),
  ).toHaveValue('unavailable');
  await otherTab.close();

  for (const title of ['Первая компания', 'Вторая компания']) {
    const created = await page.request.post('/api/rooms', {
      headers: { origin },
      data: { displayName: 'Ведущий', title, maxMembers: 2 },
    });
    expect(created.status()).toBe(201);
    const room = await created.json();
    await page.goto(`/rooms/${room.id}`);
    const valheim = page.getByRole('group', { name: 'Valheim', exact: true });
    await expect(
      valheim.getByRole('checkbox', { name: 'Есть игра' }),
    ).toBeChecked();
    const before = await (
      await page.request.get(`/api/rooms/${room.id}`)
    ).json();
    expect(
      before.members.find(
        (member: { id: string }) => member.id === before.viewerMemberId,
      ).preferences,
    ).toBeNull();
    await page
      .getByRole('form', { name: 'Ваши пожелания' })
      .getByRole('button', { name: 'Сохранить пожелания' })
      .click();
    await expect(page.getByText('Пожелания сохранены.')).toBeVisible();
  }
});

test('a delayed library response preserves manual room edits', async ({
  page,
}) => {
  const session = await page.request.post('/api/guest-session', {
    headers: { origin },
  });
  expect(session.status()).toBe(200);
  const catalog = await (await page.request.get('/api/catalog')).json();
  const valheim = catalog.find(
    (game: { name: string }) => game.name === 'Valheim',
  );
  await page.request.patch('/api/me/library', {
    headers: { origin },
    data: {
      version: 0,
      changes: [{ gameId: valheim.id, availability: 'installed' }],
    },
  });
  const created = await page.request.post('/api/rooms', {
    headers: { origin },
    data: {
      displayName: 'Ведущий',
      title: 'Поздняя библиотека',
      maxMembers: 2,
    },
  });
  const room = await created.json();
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/me/library', async (route) => {
    await hold;
    await route.continue();
  });
  await page.goto(`/rooms/${room.id}`);
  const form = page.getByRole('form', { name: 'Ваши пожелания' });
  await form
    .getByRole('group', { name: 'Deep Rock Galactic', exact: true })
    .getByRole('checkbox', { name: 'Есть игра' })
    .check();
  release();
  await expect(
    form.getByRole('button', { name: 'Подставить сохранённую библиотеку' }),
  ).toBeEnabled();
  await expect(
    form
      .getByRole('group', { name: 'Deep Rock Galactic', exact: true })
      .getByRole('checkbox', { name: 'Есть игра' }),
  ).toBeChecked();
  await expect(
    form
      .getByRole('group', { name: 'Valheim', exact: true })
      .getByRole('checkbox', { name: 'Есть игра' }),
  ).not.toBeChecked();
  const stored = await (await page.request.get(`/api/rooms/${room.id}`)).json();
  expect(stored.members[0].preferences).toBeNull();
});

test('session creation recovers after an initial request error', async ({
  page,
}) => {
  let failed = false;
  await page.route('**/api/guest-session', async (route) => {
    if (!failed) {
      failed = true;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Временная ошибка' },
        }),
      });
    } else await route.continue();
  });
  await page.goto('/library');
  await expect(
    page.getByRole('heading', { name: 'Не удалось загрузить библиотеку' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(page.getByText('Найдено: 81 из 81')).toBeVisible();
});

test('a new guest never receives the previous session library from cache', async ({
  page,
  context,
}) => {
  await page.goto('/library');
  await expect(
    page.getByRole('combobox', { name: 'Valheim: доступ и установка' }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Valheim: доступ и установка' })
    .selectOption('installed');
  await page.getByRole('button', { name: 'Сохранить изменения (1)' }).click();
  await expect(page.getByText('Библиотека сохранена.')).toBeVisible();
  await context.clearCookies();
  await page
    .getByRole('navigation', { name: 'Основная навигация' })
    .getByRole('link', { name: 'Создать комнату' })
    .click();
  await page.getByLabel('Ваше имя', { exact: true }).fill('Новый гость');
  await page
    .getByLabel('Название комнаты', { exact: true })
    .fill('Новая библиотека');
  await page
    .getByRole('button', { name: 'Создать комнату', exact: true })
    .click();
  const form = page.getByRole('form', { name: 'Ваши пожелания' });
  await expect(
    form.getByRole('button', { name: 'Подставить сохранённую библиотеку' }),
  ).toBeEnabled();
  await expect(
    form
      .getByRole('group', { name: 'Valheim', exact: true })
      .getByRole('checkbox', { name: 'Есть игра' }),
  ).not.toBeChecked();
});

test('host sees explicit apply preview and resets an active room', async ({
  page,
  browser,
}) => {
  await page.goto('/library');
  await expect(
    page.getByRole('combobox', { name: 'Valheim: доступ и установка' }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Valheim: доступ и установка' })
    .selectOption('installed');
  await page.getByRole('button', { name: 'Сохранить изменения (1)' }).click();
  const created = await page.request.post('/api/rooms', {
    headers: { origin },
    data: {
      displayName: 'Ведущий',
      title: 'Библиотечный вечер',
      maxMembers: 2,
    },
  });
  const room = await created.json();
  const guestContext = await browser.newContext();
  try {
    const joined = await guestContext.request.post(
      `/api/invites/${room.invitePath.split('/').pop()}/join`,
      { headers: { origin }, data: { displayName: 'Друг' } },
    );
    expect(joined.status()).toBe(200);
    const joinedRoom = await joined.json();
    const game = room.catalog.find(
      (entry: { name: string }) => entry.name === 'Valheim',
    ).id;
    const preferences = {
      availableMinutes: 120,
      mode: 'any',
      games: [{ gameId: game, owned: true, installed: true, taste: 'okay' }],
    };
    const hostAnswer = await page.request.put(
      `/api/rooms/${room.id}/preferences`,
      {
        headers: { origin },
        data: { version: joinedRoom.version, preferences },
      },
    );
    const hostRoom = await hostAnswer.json();
    const guestAnswer = await guestContext.request.put(
      `/api/rooms/${room.id}/preferences`,
      { headers: { origin }, data: { version: hostRoom.version, preferences } },
    );
    const guestRoom = await guestAnswer.json();
    const active = await page.request.post(`/api/rooms/${room.id}/voting`, {
      headers: { origin },
      data: { version: guestRoom.version },
    });
    expect(active.status()).toBe(200);
    const activeRoom = await active.json();
    await page.goto('/library');
    await page
      .getByRole('combobox', { name: 'Valheim: доступ и установка' })
      .selectOption('unavailable');
    await page.getByRole('button', { name: 'Сохранить изменения (1)' }).click();
    await page.goto(`/rooms/${room.id}`);
    await expect(
      page.getByRole('button', { name: 'Посмотреть применение (1)' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Посмотреть применение (1)' })
      .click();
    await capture(page, 'room-apply');
    await page
      .getByRole('button', { name: 'Применить и начать новый раунд' })
      .click();
    await expect(
      page.getByText(`Собираем пожелания · Раунд ${activeRoom.round + 1}`),
    ).toBeVisible();
    const result = await (
      await page.request.get(`/api/rooms/${room.id}`)
    ).json();
    expect(result.status).toBe('collecting');
    expect(
      result.members
        .find((member: { id: string }) => member.id === result.viewerMemberId)
        .preferences.games.find(
          (entry: { gameId: string }) => entry.gameId === game,
        ).owned,
    ).toBe(false);
  } finally {
    await guestContext.close();
  }
});
