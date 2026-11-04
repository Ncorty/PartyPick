import { expect, test } from '@playwright/test';

test('desktop and mobile preserve the preview and have no horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
      const backgroundElements = document.querySelectorAll<HTMLElement>(
        '[style*="background-image"]',
      );
      await Promise.all(
        [...backgroundElements].map(async (element) => {
          const url = getComputedStyle(element).backgroundImage.slice(5, -2);
          const image = new Image();
          image.src = url;
          await image.decode();
        }),
      );
    });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Посмотреть пример' }).click();
    await expect(page).toHaveURL(/#preview$/);
    await expect(
      page.getByRole('heading', { name: 'Пятница, свои' }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const names = page
      .getByRole('list', { name: 'Пример участников' })
      .locator('li > span');
    for (const name of await names.all()) {
      expect(
        await name.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
    }
    const gameTitle = page.getByRole('heading', { name: 'Вечер приключений' });
    expect(
      await gameTitle.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/partypick-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test('dev indicator reports the real API and handles invalid responses', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByText('Статус разработки', { exact: true }).click();
  await expect(page.getByRole('status')).toContainText('API подключён');
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'unexpected' } }),
  );
  await page.reload();
  await page.getByText('Статус разработки', { exact: true }).click();
  await expect(page.getByRole('status')).toContainText('API недоступен');
});
