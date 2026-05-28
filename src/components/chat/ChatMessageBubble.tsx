import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CHAT_REACTIONS } from '@/config/chat';
import type { ChatMessageRow } from '@/services/chat';
import { cn } from '@/lib/utils/cn';

interface ChatMessageBubbleProps {
  message: ChatMessageRow;
  isOwn: boolean;
  isStaff: boolean;
  myProfileId: string;
  onReact: (emoji: string) => void;
  onDelete: () => void;
}

function reactionSummary(reactions: ChatMessageRow['reactions']): { emoji: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of reactions) {
    map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
  }
  return [...map.entries()].map(([emoji, count]) => ({ emoji, count }));
}

export function ChatMessageBubble({
  message,
  isOwn,
  isStaff,
  myProfileId,
  onReact,
  onDelete,
}: ChatMessageBubbleProps) {
  const name = message.author?.full_name ?? 'Участник';
  const time = format(parseISO(message.created_at), 'd MMM HH:mm', { locale: ru });
  const summary = reactionSummary(message.reactions);
  const myReaction = message.reactions.find((r) => r.profile_id === myProfileId)?.emoji;

  return (
    <article
      className={cn(
        'rounded-2xl px-3 py-2 max-w-[92%]',
        isOwn ? 'ml-auto bg-primary-700 text-white' : 'mr-auto bg-white border border-slate-200',
      )}
    >
      {!isOwn && (
        <p className={cn('text-xs font-semibold mb-0.5', isOwn ? 'text-primary-100' : 'text-primary-800')}>
          {name}
        </p>
      )}
      {message.body ? (
        <p className={cn('text-sm whitespace-pre-wrap break-words', isOwn ? 'text-white' : 'text-slate-800')}>
          {message.body}
        </p>
      ) : null}
      {message.image_url ? (
        <a href={message.image_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <img
            src={message.image_url}
            alt=""
            className="rounded-xl max-h-64 w-full object-cover"
          />
        </a>
      ) : null}
      <p className={cn('text-[10px] mt-1', isOwn ? 'text-primary-200' : 'text-slate-400')}>{time}</p>

      {summary.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {summary.map(({ emoji, count }) => (
            <span
              key={emoji}
              className={cn(
                'text-xs rounded-full px-1.5 py-0.5',
                isOwn ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700',
              )}
            >
              {emoji} {count > 1 ? count : ''}
            </span>
          ))}
        </div>
      )}

      <div className={cn('flex flex-wrap gap-0.5 mt-2 pt-1 border-t', isOwn ? 'border-primary-600' : 'border-slate-100')}>
        {CHAT_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            className={cn(
              'text-base leading-none p-1 rounded-lg min-w-[32px] min-h-[32px]',
              myReaction === emoji && 'ring-2 ring-amber-400 bg-amber-50/20',
            )}
            aria-label={`Реакция ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {(isOwn || isStaff) && (
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            'text-[11px] mt-1 underline opacity-70',
            isOwn ? 'text-primary-200' : 'text-red-600',
          )}
        >
          Удалить
        </button>
      )}
    </article>
  );
}
