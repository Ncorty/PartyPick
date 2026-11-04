import { expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

it('serves the API health endpoint', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'partypick-api' });
  } finally {
    await app.close();
  }
});
