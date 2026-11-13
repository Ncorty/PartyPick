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
  const profile = reason.params.profile ? ` (${reason.params.profile})` : '';
  switch (reason.code) {
    case 'all_owned':
      return 'Есть у всех';
    case 'all_installed':
      return 'Установлена у всех';
    case 'players_fit':
      return 'Подходит по числу игроков';
    case 'time_fit':
      return `Ориентир сессии подходит по времени: около ${reason.params.suggestedMinutes} мин.`;
    case 'mode_fit':
      return 'Режим подходит компании';
    case 'no_veto':
      return 'Никто не исключил игру';
    case 'player_count':
      return `Не подходит по числу игроков${profile}: нужно ${reason.params.min}–${reason.params.max} в компании`;
    case 'missing_ownership':
      return `Нет игры: ${names}`;
    case 'not_installed':
      return `Не установлена: ${names}`;
    case 'veto':
      return `Сегодня не хотят играть: ${names}`;
    case 'mode':
      return `Не подходит режим${profile}: ${names}`;
    case 'time':
      return `Недостаточно времени${profile}: ориентир ${reason.params.suggestedMinutes} мин., меньше доступно у ${names}`;
    case 'randoms_required':
      return `Нужен добор случайных игроков${profile}, против: ${names}`;
    case 'random_fill':
      return `Для полной команды нужен добор: ${reason.params.slots ?? 'несколько'} случайных игроков.`;
    case 'pvp_risk':
      return 'PvPvE: кроме окружения, в вылазке могут встретиться враждебные игроки.';
    case 'genre_fit':
      return 'Учтены пожелания по жанрам';
    case 'session_fit':
      return 'Учтено настроение на вечер';
    case 'preference_fit':
      return `Хотят играть: ${reason.params.want} из ${reason.params.total}; остальные не против`;
  }
}
