export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(
  path: string,
  options?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options?.method ?? 'GET',
    credentials: 'same-origin',
    ...(options?.body !== undefined
      ? {
          body: JSON.stringify(options.body),
          headers: { 'Content-Type': 'application/json' },
        }
      : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'error' in payload
        ? payload.error
        : null;
    const code =
      detail &&
      typeof detail === 'object' &&
      'code' in detail &&
      typeof detail.code === 'string'
        ? detail.code
        : 'NETWORK_ERROR';
    const message =
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof detail.message === 'string'
        ? detail.message
        : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
    throw new ApiError(code, message, response.status);
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'CONFLICT')
      return 'Комната уже изменилась. Данные обновлены — повторите действие.';
    return error.message;
  }
  return 'Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.';
}
