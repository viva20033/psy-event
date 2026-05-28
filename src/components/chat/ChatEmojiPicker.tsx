import { CHAT_EMOJIS } from '@/config/chat';

interface ChatEmojiPickerProps {
  onPick: (emoji: string) => void;
}

export function ChatEmojiPicker({ onPick }: ChatEmojiPickerProps) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm"
      role="listbox"
      aria-label="Смайлики"
    >
      <div className="grid grid-cols-8 gap-0.5">
        {CHAT_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="option"
            className="text-xl leading-none p-1.5 rounded-lg hover:bg-white active:bg-primary-50 min-h-[40px] min-w-[36px]"
            onClick={() => onPick(emoji)}
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
