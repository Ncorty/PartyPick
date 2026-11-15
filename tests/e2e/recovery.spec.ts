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
      path: `test-results/recovery-${state}-${width}.png`,
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

test('empty result gives a conditional plan, and only the named participant changes their answer', async ({
  page,
  browser,
}) => {
  const created = await page.request.post('/api/rooms', {
    headers: { origin },
    data: { displayName: 'Ведущий', title: 'Поиск выхода', maxMembers: 2 },
  });
  const room = await created.json();
  const guestContext = await browser.newContext();
  try {
    const joined = await guestContext.request.post(
      `${origin}/api/invites/${room.invitePath.split('/').pop()}/join`,
      { headers: { origin }, data: { displayName: 'Друг' } },
    );
    const guestRoom = await joined.json();
    const common = {
      availableMinutes: 100,
      mode: 'any',
      games: [
        { gameId: 'deep-rock', owned: true, installed: true, taste: 'okay' },
      ],
    };
    const hostSaved = await page.request.put(
      `/api/rooms/${room.id}/preferences`,
      {
        headers: { origin },
        data: { version: guestRoom.version, preferences: common },
      },
    );
    const hostState = await hostSaved.json();
    const guestSaved = await guestContext.request.put(
      `${origin}/api/rooms/${room.id}/preferences`,
      {
        headers: { origin },
        data: {
          version: hostState.version,
          preferences: {
            ...common,
            games: [{ ...common.games[0], installed: false }],
          },
        },
      },
    );
    expect(guestSaved.status()).toBe(200);
    const guest = await guestContext.newPage();
    await guest.goto(`/rooms/${room.id}`);
    await expect(
      guest.getByRole('heading', { name: 'Что можно обсудить' }),
    ).toBeVisible();
    await expect(
      guest.getByText('Друг: если действительно установит Deep Rock Galactic'),
    ).toBeVisible();
    await capture(guest, 'empty');
    await guest.getByRole('link', { name: 'К своим пожеланиям' }).click();
    const deepRock = guest.getByRole('group', {
      name: 'Deep Rock Galactic',
      exact: true,
    });
    await deepRock.getByRole('checkbox', { name: 'Установлена' }).check();
    await guest
      .getByRole('form', { name: 'Ваши пожелания' })
      .getByRole('button', { name: 'Сохранить пожелания' })
      .click();
    await expect(
      guest.getByRole('heading', { name: 'Deep Rock Galactic' }).first(),
    ).toBeVisible();
    const updated = await (
      await guestContext.request.get(`${origin}/api/rooms/${room.id}`)
    ).json();
    expect(
      updated.matching.eligible.some(
        (entry: { gameId: string }) => entry.gameId === 'deep-rock',
      ),
    ).toBe(true);
    await capture(guest, 'restored');
  } finally {
    await guestContext.close();
  }
});

test('host catalog preview and another participant’s dirty draft survive a changed catalog snapshot', async ({
  page,
  browser,
}) => {
  // The browser fixture simulates a global catalog edit while retaining production API contracts.
  // Direct writes to the running E2E server are intentionally unavailable.
  const created = await page.request.post('/api/rooms', {
    headers: { origin },
    data: { displayName: 'Ведущий', title: 'Смена каталога', maxMembers: 2 },
  });
  const room = await created.json();
  const guestContext = await browser.newContext();
  try {
    const joined = await guestContext.request.post(
      `${origin}/api/invites/${room.invitePath.split('/').pop()}/join`,
      { headers: { origin }, data: { displayName: 'Друг' } },
    );
    const state = await joined.json();
    const removed = state.catalog[0];
    const changed = state.catalog.find(
      (game: { id: string }) => game.id === 'deep-rock',
    );
    expect(changed).toBeTruthy();
    const originalProfile = changed.profiles[0];
    const changedProfile = {
      ...originalProfile,
      mode: 'competitive',
      estimatedMinutes: originalProfile.estimatedMinutes + 5,
      ...(originalProfile.playMinutes !== undefined
        ? { playMinutes: originalProfile.playMinutes + 5 }
        : {}),
    };
    const changedGame = {
      ...changed,
      genres: ['horror'],
      modes: ['competitive'],
      profiles: [changedProfile],
      suggestedMinutes: changedProfile.estimatedMinutes,
    };
    const added = {
      ...removed,
      id: 'fixture-new-game',
      name: 'Новая игра',
      aliases: ['новая игра'],
    };
    let current = state;
    const next = {
      ...state,
      version: state.version + 1,
      round: state.round + 1,
      catalogRevision: 'b'.repeat(64),
      catalog: [
        ...state.catalog
          .slice(1)
          .map((game: { id: string }) =>
            game.id === changed.id ? changedGame : game,
          ),
        added,
      ],
      members: state.members.map((member: (typeof state.members)[number]) => ({
        ...member,
        preferences: member.preferences && {
          ...member.preferences,
          games: member.preferences.games.filter(
            (choice: { gameId: string }) => choice.gameId !== removed.id,
          ),
        },
      })),
    };
    const preview = {
      roomVersion: state.version,
      currentRevision: state.catalogRevision,
      targetRevision: next.catalogRevision,
      currentRulesVersion: 1,
      targetRulesVersion: 1,
      changes: [
        {
          gameId: removed.id,
          name: removed.name,
          kind: 'removed',
          fields: [],
          profiles: [],
        },
        {
          gameId: added.id,
          name: added.name,
          kind: 'added',
          fields: [],
          profiles: [],
        },
        {
          gameId: changed.id,
          name: changed.name,
          kind: 'changed',
          fields: [
            {
              field: 'genres',
              before: changed.genres.join(', '),
              after: 'horror',
            },
          ],
          profiles: [
            {
              profileId: originalProfile.id,
              name: originalProfile.name,
              kind: 'changed',
              fields: [
                {
                  field: 'mode',
                  before: originalProfile.mode,
                  after: 'competitive',
                },
                {
                  field: 'estimatedMinutes',
                  before: String(originalProfile.estimatedMinutes),
                  after: String(changedProfile.estimatedMinutes),
                },
              ],
            },
          ],
        },
      ],
    };
    await page.route(`**/api/rooms/${room.id}`, async (route) => {
      if (route.request().method() === 'GET')
        await route.fulfill({
          json: { ...current, viewerMemberId: state.hostMemberId },
        });
      else await route.continue();
    });
    await page.route(
      `**/api/rooms/${room.id}/catalog-update`,
      async (route) => {
        if (route.request().method() === 'GET')
          await route.fulfill({ json: preview });
        else {
          current = next;
          await route.fulfill({
            json: { ...next, viewerMemberId: state.hostMemberId },
          });
        }
      },
    );
    let savedDraft: unknown;
    await guestContext.route(`**/api/rooms/${room.id}`, async (route) => {
      if (route.request().method() === 'GET')
        await route.fulfill({
          json: { ...current, viewerMemberId: state.viewerMemberId },
        });
      else await route.continue();
    });
    await guestContext.route(
      `**/api/rooms/${room.id}/preferences`,
      async (route) => {
        savedDraft = route.request().postDataJSON();
        const body = savedDraft as { preferences: unknown };
        current = {
          ...current,
          version: current.version + 1,
          members: current.members.map(
            (member: (typeof state.members)[number]) =>
              member.id === state.viewerMemberId
                ? { ...member, preferences: body.preferences }
                : member,
          ),
        };
        await route.fulfill({
          json: { ...current, viewerMemberId: state.viewerMemberId },
        });
      },
    );
    await page.goto(`/rooms/${room.id}`);
    const guest = await guestContext.newPage();
    await guest.goto(`/rooms/${room.id}`);
    const form = guest.getByRole('form', { name: 'Ваши пожелания' });
    await form.getByLabel('Сколько минут можете играть').fill('95');
    await form
      .getByRole('group', { name: removed.name, exact: true })
      .getByRole('checkbox', { name: 'Есть игра' })
      .check();
    const control = page
      .getByRole('heading', { name: 'Каталог комнаты' })
      .locator('..');
    await expect(
      control.getByText('Доступно обновление: добавлено 1, удалено 1'),
    ).toBeVisible();
    await control.getByText('Показать изменения игр и режимов').click();
    await expect(
      control.getByText('Режим: кооператив → соревнование'),
    ).toBeVisible();
    await expect(control.getByText('Жанры: шутеры → хоррор')).toBeVisible();
    await expect(
      control.getByText(
        `Время сессии: ${originalProfile.estimatedMinutes} → ${changedProfile.estimatedMinutes}`,
      ),
    ).toBeVisible();
    await capture(page, 'catalog-preview');
    await control
      .getByRole('checkbox', { name: /Подтверждаю новый раунд/ })
      .check();
    await control
      .getByRole('button', { name: 'Обновить каталог комнаты' })
      .click();
    await expect(
      guest.getByText(/Каталог комнаты обновился. Ваш черновик сохранён/),
    ).toBeVisible();
    await expect(form.getByLabel('Сколько минут можете играть')).toHaveValue(
      '95',
    );
    await expect(
      form.getByRole('group', { name: removed.name, exact: true }),
    ).toHaveCount(0);
    await expect(
      form
        .getByRole('group', { name: added.name, exact: true })
        .getByRole('checkbox', { name: 'Есть игра' }),
    ).not.toBeChecked();
    await capture(guest, 'after-update');
    await form.getByRole('button', { name: 'Сохранить пожелания' }).click();
    await expect(
      guest.getByText('Пожелания сохранены. Друзья увидят ваши ответы.'),
    ).toBeVisible();
    const payload = savedDraft as {
      preferences: {
        games: { gameId: string; owned: boolean }[];
        availableMinutes: number;
      };
    };
    expect(payload.preferences.availableMinutes).toBe(95);
    expect(
      payload.preferences.games.some((choice) => choice.gameId === removed.id),
    ).toBe(false);
    expect(
      payload.preferences.games.find((choice) => choice.gameId === added.id)
        ?.owned,
    ).toBe(false);
  } finally {
    await guestContext.close();
  }
});
