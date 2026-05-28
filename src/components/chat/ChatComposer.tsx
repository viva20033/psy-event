import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ChatEmojiPicker } from '@/components/chat/ChatEmojiPicker';
import { uploadChatImage } from '@/lib/supabase/chatImage';

interface ChatComposerProps {
  profileId: string;
  disabled?: boolean;
  onSend: (body: string, imageUrl: string | null) => Promise<void>;
}

export function ChatComposer({ profileId, disabled, onSend }: ChatComposerProps) {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadChatImage(file, profileId);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (sending || disabled) return;
    setSending(true);
    setEmojiOpen(false);
    setError(null);
    try {
      await onSend(text, imageUrl);
      setText('');
      setImageUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не отправилось');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white px-3 py-2 space-y-2 safe-bottom">
      {emojiOpen && (
        <ChatEmojiPicker
          onPick={(emoji) => {
            insertEmoji(emoji);
            textareaRef.current?.focus();
          }}
        />
      )}
      {imageUrl && (
        <div className="relative inline-block">
          <img src={imageUrl} alt="" className="h-20 rounded-lg object-cover" />
          <button
            type="button"
            className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5"
            onClick={() => setImageUrl(null)}
            aria-label="Убрать фото"
          >
            ×
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 items-end">
        <input
          ref={fileRef}
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/*"
          className="sr-only"
          disabled={disabled || uploading || sending}
          onChange={onPickFile}
        />
        <button
          type="button"
          onClick={() => setEmojiOpen((v) => !v)}
          disabled={disabled || sending}
          className={`shrink-0 text-xl p-2 rounded-xl border min-h-[44px] min-w-[44px] ${
            emojiOpen ? 'border-primary-400 bg-primary-50' : 'border-slate-200'
          }`}
          aria-label="Смайлики"
          aria-expanded={emojiOpen}
        >
          😊
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading || sending}
          className="shrink-0 text-xl p-2 rounded-xl border border-slate-200 min-h-[44px] min-w-[44px]"
          aria-label="Фото"
        >
          {uploading ? '…' : '📷'}
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение…"
          rows={1}
          disabled={disabled || sending}
          className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-base min-h-[44px] max-h-28"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={disabled || sending || uploading || (!text.trim() && !imageUrl)}
          className="shrink-0 min-h-[44px]"
        >
          {sending ? '…' : '→'}
        </Button>
      </div>
    </div>
  );
}
