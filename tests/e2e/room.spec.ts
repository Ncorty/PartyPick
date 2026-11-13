import { expect, test, type Page } from '@playwright/test';

async function captureState(page: Page, state: string, fullPage = true) {
  const original = page.viewportSize();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `test-results/mvp-${state}-${width}.png`,
      fullPage,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  if (original) await page.setViewportSize(original);
}

async function answer(page: Page, wanted: string) {
  const form = page.getByRole('form', { name: 'Ваши пожелания' });
  await expect(form).toBeVisible();
  for (const name of ['Deep Rock Galactic', 'Valheim']) {
    const game = form.getByRole('group', { name, exact: true });
    await game
      .getByRole('checkbox', { name: 'Есть игра', exact: true })
      .check();
    await game
      .getByRole('checkbox', { name: 'Установлена', exact: true })
      .check();
    await game
      .getByText(`Пожелания и режимы: ${name}`, { exact: true })
      .click();
    await game
      .getByLabel('Отношение к игре')
      .selectOption(name === wanted ? 'want' : 'okay');
  }
  await form.getByRole('button', { name: 'Сохранить пожелания' }).click();
  await expect(
    page.getByText('Пожелания сохранены. Друзья увидят ваши ответы.'),
  ).toBeVisible();
}

test('two guests create, join, choose, vote and confirm a real room', async ({
  page,
  browser,
}) => {
  await page.goto('/create');
  await page.getByLabel('Ваше имя', { exact: true }).fill('Арсений');
  await page
    .getByLabel('Название комнаты', { exact: true })
    .fill('Вечер с друзьями');
  await page
    .getByLabel('Максимум участников', { exact: true })
    .selectOption('2');
  await captureState(page, 'create');
  await page
    .getByRole('button', { name: 'Создать комнату', exact: true })
    .click();
  await expect(page).toHaveURL(/\/rooms\//);
  const roomUrl = page.url();
  const invite = await page.getByLabel('Приглашение для друзей').inputValue();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  try {
    await guest.goto(invite);
    await guest.getByLabel('Ваше имя', { exact: true }).fill('Друг');
    await captureState(guest, 'join');
    await guest
      .getByRole('button', { name: 'Войти в комнату', exact: true })
      .click();
    await expect(guest).toHaveURL(roomUrl);
    await expect(
      page.getByRole('list', { name: 'Участники комнаты' }),
    ).toContainText('Друг');
    await captureState(page, 'collecting');
    await answer(page, 'Deep Rock Galactic');
    await answer(guest, 'Deep Rock Galactic');
    const start = page.getByRole('button', {
      name: 'Начать голосование',
      exact: true,
    });
    await expect(start).toBeEnabled();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Вечер с друзьями', exact: true }),
    ).toBeVisible();
    await expect(start).toBeEnabled();
    await start.click();
    await page
      .getByRole('button', {
        name: 'Голосовать за Deep Rock Galactic',
        exact: true,
      })
      .click();
    await expect(
      guest.getByRole('button', {
        name: 'Голосовать за Deep Rock Galactic',
        exact: true,
      }),
    ).toBeVisible();
    await guest
      .getByRole('button', {
        name: 'Голосовать за Deep Rock Galactic',
        exact: true,
      })
      .click();
    const finish = page.getByRole('button', {
      name: 'Завершить голосование',
      exact: true,
    });
    await expect(finish).toBeEnabled();
    await captureState(page, 'voting');
    await finish.click();
    await page
      .getByRole('button', { name: 'Готов играть', exact: true })
      .click();
    await guest
      .getByRole('button', { name: 'Готов играть', exact: true })
      .click();
    await expect(
      page.getByText('Весь отряд готов. Можно начинать игру!'),
    ).toBeVisible();
    await expect(
      guest.getByText('Весь отряд готов. Можно начинать игру!'),
    ).toBeVisible();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `test-results/room-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page
      .getByRole('button', { name: 'Изменить условия', exact: true })
      .click();
    await expect(
      guest.getByRole('form', { name: 'Ваши пожелания' }),
    ).toBeVisible();
    await expect(guest.getByText('Ваш голос: Deep Rock Galactic')).toHaveCount(
      0,
    );
  } finally {
    await guestContext.close();
  }
});

test('catalog search preserves hidden answers and a short Valorant session requires consent to random teammates', async ({
  page,
  browser,
}) => {
  const origin = 'http://127.0.0.1:5175';
  const created = await page.request.post('/api/rooms', {
    headers: { origin },
    data: { displayName: 'Арсений', title: 'Короткий вечер', maxMembers: 2 },
  });
  expect(created.status()).toBe(201);
  const room = await created.json();
  const guestContext = await browser.newContext();
  try {
    const joined = await guestContext.request.post(
      `${origin}/api/invites/${room.invitePath.split('/').pop()}/join`,
      {
        headers: { origin },
        data: { displayName: 'Друг' },
      },
    );
    expect(joined.status()).toBe(200);
    const guestRoom = await joined.json();
    const guestAnswer = await guestContext.request.put(
      `${origin}/api/rooms/${room.id}/preferences`,
      {
        headers: { origin },
        data: {
          version: guestRoom.version,
          preferences: {
            availableMinutes: 25,
            mode: 'competitive',
            allowRandoms: true,
            games: [
              {
                gameId: 'valorant',
                owned: true,
                installed: true,
                taste: 'want',
              },
            ],
          },
        },
      },
    );
    expect(guestAnswer.status()).toBe(200);
    await page.goto(`/rooms/${room.id}`);
    const form = page.getByRole('form', { name: 'Ваши пожелания' });
    await captureState(page, 'catalog-unfiltered');
    await form.getByLabel('Сколько минут можете играть').fill('25');
    await form
      .getByLabel('Режим игры', { exact: true })
      .selectOption('competitive');
    await form
      .getByRole('checkbox', {
        name: 'Можно добрать случайных игроков в нашу команду',
      })
      .uncheck();
    await form.getByLabel('Найти игру').fill('Deep Rock');
    await form
      .getByRole('group', { name: 'Deep Rock Galactic', exact: true })
      .getByRole('checkbox', { name: 'Есть игра', exact: true })
      .check();
    await form.getByLabel('Найти игру').fill('  вАлОрАнТ  ');
    const valorant = form.getByRole('group', { name: 'VALORANT', exact: true });
    await expect(valorant).toBeVisible();
    await valorant
      .getByRole('checkbox', { name: 'Есть игра', exact: true })
      .check();
    await valorant
      .getByRole('checkbox', { name: 'Установлена', exact: true })
      .check();
    await valorant
      .getByText('Пожелания и режимы: VALORANT', { exact: true })
      .click();
    await valorant.getByLabel('Отношение к игре').selectOption('want');
    await form.getByLabel('Найти игру').fill('  КС  ');
    await expect(
      form.getByRole('group', { name: 'Counter-Strike 2', exact: true }),
    ).toBeVisible();
    await expect(valorant).toHaveCount(0);
    await form.getByLabel('Найти игру').fill('ВАЛОРАНТ');
    await expect(form.getByRole('status')).toContainText('Найдено: 1 из');
    await captureState(page, 'catalog-alias-filtered');
    await form.getByLabel('Найти игру').fill('нет такой игры');
    await expect(
      form.getByText('По этим фильтрам игр нет.', { exact: false }),
    ).toBeVisible();
    await form.getByRole('button', { name: 'Сбросить фильтры' }).click();
    await form.getByLabel('Найти игру').fill('ВАЛОРАНТ');
    await expect(
      valorant.getByRole('checkbox', { name: 'Есть игра' }),
    ).toBeChecked();
    await captureState(page, 'matching-preferences');
    await form
      .getByRole('button', { name: 'Сохранить пожелания', exact: true })
      .click();
    await expect(
      page.getByText('Общих вариантов пока нет.', { exact: false }),
    ).toBeVisible();
    const storedResponse = await page.request.get(`/api/rooms/${room.id}`);
    const stored = await storedResponse.json();
    const host = stored.members.find(
      (member: { id: string }) => member.id === stored.viewerMemberId,
    );
    expect(
      host.preferences.games.find(
        (game: { gameId: string }) => game.gameId === 'deep-rock',
      ).owned,
    ).toBe(true);
    expect(host.preferences.games.length).toBeGreaterThanOrEqual(80);
    expect(
      stored.matching.excluded.find(
        (game: { gameId: string }) => game.gameId === 'valorant',
      ).reasons,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'randoms_required' }),
      ]),
    );
    await form
      .getByRole('checkbox', {
        name: 'Можно добрать случайных игроков в нашу команду',
      })
      .check();
    await form
      .getByRole('button', { name: 'Сохранить пожелания', exact: true })
      .click();
    const recommendations = page.getByRole('list', { name: 'Подходящие игры' });
    await expect(
      recommendations.getByRole('heading', { name: 'VALORANT', exact: true }),
    ).toBeVisible();
    await expect(recommendations).toContainText('Swiftplay');
    await expect(recommendations).toContainText('около 20 мин.');
    await expect(recommendations).toContainText('случайные игроки: 3');
    await form.getByRole('link', { name: 'Перейти к подбору' }).click();
    await expect(page.locator('#matching-results')).toBeFocused();
    await expect(
      recommendations.getByRole('heading', { name: 'VALORANT', exact: true }),
    ).toBeInViewport();
    await captureState(page, 'matching-result');
  } finally {
    await guestContext.close();
  }
});

test('unknown rooms and invitations provide recovery instead of phantom membership', async ({
  page,
}) => {
  await page.goto('/rooms/not-a-real-room');
  await expect(
    page.getByRole('heading', { name: 'Комната недоступна' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Создать свою комнату' }),
  ).toBeVisible();
  await page.goto('/join/not-a-real-token');
  await expect(
    page.getByRole('button', { name: 'Войти в комнату' }),
  ).toHaveCount(0);
});
