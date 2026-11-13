import type { Game, LibrarySnapshot, RoomSnapshot } from '@partypick/contracts';
import type { QueryClient } from '@tanstack/react-query';
import { request } from '@shares/api';

export const libraryKey = ['library'] as const;
export const catalogKey = ['catalog'] as const;
export const getLibrary = () => request<LibrarySnapshot>('/me/library');
export function latestLibrarySnapshot(
  current: LibrarySnapshot | undefined,
  next: LibrarySnapshot,
): LibrarySnapshot {
  return current &&
    current.sessionExpiresAt === next.sessionExpiresAt &&
    current.version > next.version
    ? current
    : next;
}
export async function getLibraryMonotonic(client: QueryClient) {
  const snapshot = await getLibrary();
  const current = client.getQueryData<LibrarySnapshot>(libraryKey);
  return latestLibrarySnapshot(current, snapshot);
}
export const getCatalog = () => request<Game[]>('/catalog');
export const patchLibrary = (
  version: number,
  changes: { gameId: string; availability: string }[],
) =>
  request<LibrarySnapshot>('/me/library', {
    method: 'PATCH',
    body: { version, changes },
  });
export const applyLibrary = (
  id: string,
  version: number,
  libraryVersion: number,
) =>
  request<RoomSnapshot>(`/rooms/${encodeURIComponent(id)}/apply-library`, {
    method: 'POST',
    body: { version, libraryVersion, resetRound: true },
  });
