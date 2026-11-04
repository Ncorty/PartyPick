import type { MatchReason, RoomMember } from '@partypick/contracts';

export function describeReason(
  reason: MatchReason,
  members: RoomMember[],
): string {
  const names = reason.memberIds
    .map(
      (id) =>
        members.find((member) => member.id === id)?.displayName ?? 'Участник',
    )
    .join(', ');
  switch (reason.code) {
    case 'all_owned':
      return 'Есть у всех';
    case 'all_installed':
      return 'Установлена у всех';
    case 'players_fit':
      return 'Подходит по числу игроков';
    case 'time_fit':
      return 'Ориентир сессии подходит по времени';
    case 'mode_fit':
      return 'Режим подходит компании';
    case 'no_veto':
      return 'Никто не исключил игру';
    case 'player_count':
      return 'Не подходит по числу игроков';
    case 'missing_ownership':
      return `Нет игры: ${names}`;
    case 'not_installed':
      return `Не установлена: ${names}`;
    case 'veto':
      return `Сегодня не хотят играть: ${names}`;
    case 'mode':
      return `Не подходит режим: ${names}`;
    case 'time':
      return `Недостаточно времени: ${names}`;
  }
}
