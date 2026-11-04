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
    await captureState(page, 'collecting', false);
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
