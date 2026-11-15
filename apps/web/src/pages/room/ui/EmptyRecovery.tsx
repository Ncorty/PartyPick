import { Link } from 'react-router-dom';
import type { RecoveryChange, RoomSnapshot } from '@partypick/contracts';
import { Notice } from '@shares/ui';
import { describeReason } from './match-reasons';

const groupNames = {
  missing_ownership: 'Доступ не подтверждён',
  not_installed: 'Не установлена',
  veto: 'Запрет участника',
  time: 'Время',
  mode: 'Режим',
  party: 'Состав / добор',
};
const modeNames = {
  any: 'любой',
  coop: 'кооператив',
  competitive: 'соревнование',
  pvpve: 'PvPvE',
};

export function EmptyRecovery({ room }: { room: RoomSnapshot }) {
  const diagnostics = room.matching.emptyDiagnostics;
  const gameName = (id: string) =>
    room.catalog.find((game) => game.id === id)?.name ?? id;
  const memberName = (id: string) =>
    room.members.find((member) => member.id === id)?.displayName ?? 'Участник';
  const changeText = (change: RecoveryChange) => {
    const person = memberName(change.memberId);
    switch (change.field) {
      case 'availableMinutes':
        return `${person}: увеличить время с ${change.from} до ${change.to} мин.`;
      case 'mode':
        return `${person}: изменить выбранный режим с «${modeNames[change.from]}» на «${modeNames[change.to]}».`;
      case 'allowRandoms':
        return `${person}: разрешить добор случайных игроков.`;
      case 'installed':
        return `${person}: если действительно установит ${gameName(change.gameId)}, отметить установку.`;
    }
  };
  if (!diagnostics) return <Notice>Общих вариантов пока нет.</Notice>;
  return (
    <div className="grid gap-5">
      <Notice>
        Общих вариантов пока нет. Причины ниже пересекаются: одна игра может
        входить сразу в несколько групп.
      </Notice>
      <div>
        <h3 className="text-2xl text-[#f2d18c]">Что мешает подбору</h3>
        <ul className="mt-3 grid gap-2 text-lg leading-snug">
          {diagnostics.groups.map((group) => (
            <li
              key={group.code}
              className="min-w-0 border-b border-[#536477] pb-2"
            >
              <strong className="text-[#dfb768]">
                {groupNames[group.code]}: {group.gameIds.length}
              </strong>
              {group.memberIds.length > 0 && (
                <span> · {group.memberIds.map(memberName).join(', ')}</span>
              )}
              <details className="mt-1">
                <summary className="min-h-11 cursor-pointer py-2 underline">
                  Показать игры
                </summary>
                <p className="break-words text-[#bfc3cb]">
                  {group.gameIds.map(gameName).join(', ')}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-2xl text-[#f2d18c]">Что можно обсудить</h3>
        {diagnostics.plans.length ? (
          <>
            <p className="mt-2 text-lg leading-snug text-[#bfc3cb]">
              Это условные варианты. Если все перечисленные участники подтвердят
              изменения, указанный режим станет доступен для подбора. Установку
              нужно проверить в действительности.
            </p>
            <ul className="mt-4 grid gap-4">
              {diagnostics.plans.map((plan) => (
                <li
                  key={`${plan.gameId}:${plan.profileId}`}
                  className="min-w-0 border-2 border-[#a68953] bg-[#101722] p-4"
                >
                  <h4 className="break-words text-2xl text-[#f2d18c]">
                    {gameName(plan.gameId)}
                  </h4>
                  <p className="mt-1 text-xl">
                    {plan.profileName} · ориентир {plan.estimatedMinutes} мин.
                  </p>
                  <ul className="mt-3 list-inside list-disc space-y-1 text-lg leading-snug">
                    {plan.changes.map((change) => (
                      <li key={`${change.memberId}:${change.field}`}>
                        {changeText(change)}
                      </li>
                    ))}
                  </ul>
                  {plan.warnings.map((warning, index) => (
                    <p
                      key={`${warning.code}-${index}`}
                      className="mt-2 text-lg text-[#dfb768]"
                    >
                      {describeReason(warning, room.members)}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-lg leading-snug text-[#bfc3cb]">
            Без подтверждённого доступа, согласия всех участников и подходящего
            состава безопасного плана нет. Обсудите ответы и проверьте
            библиотеку.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xl text-[#f2d18c]">
          <a href="#preferences-editor" className="min-h-11 py-2 underline">
            К своим пожеланиям
          </a>
          <Link to="/library" className="min-h-11 py-2 underline">
            К своей библиотеке
          </Link>
        </div>
        <p className="mt-2 text-lg text-[#bfc3cb]">
          Каждый меняет и сохраняет только собственные ответы. Подсказки ничего
          не изменяют автоматически.
        </p>
      </div>
    </div>
  );
}
