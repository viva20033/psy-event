import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatRulesGate, hasAcceptedChatRules } from '@/components/chat/ChatRulesGate';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/stores/session';
import { isStaffRole } from '@/types';
import {
  fetchChatMessages,
  sendChatMessage,
  setReaction,
  softDeleteMessage,
  subscribeChat,
  type ChatMessageRow,
} from '@/services/chat';

export function ChatPage() {
  const profile = useSession((s) => s.profile);
  const [rulesOk, setRulesOk] = useState(hasAcceptedChatRules);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<ChatMessageRow[]>([]);
  messagesRef.current = messages;

  const scrollToBottom = (smooth: boolean) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  const refresh = useCallback(async () => {
    try {
      const batch = await fetchChatMessages();
      setMessages(batch);
      setHasMore(batch.length >= 50);
      if (atBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom(true));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!rulesOk || !profile) return;
    setLoading(true);
    fetchChatMessages()
      .then((batch) => {
        setMessages(batch);
        setHasMore(batch.length >= 50);
        requestAnimationFrame(() => scrollToBottom(false));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [rulesOk, profile]);

  useEffect(() => {
    if (!rulesOk || !profile) return;
    const unsub = subscribeChat(refresh, refresh);
    const poll = window.setInterval(refresh, 12_000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [rulesOk, profile, refresh]);

  async function loadOlder() {
    const current = messagesRef.current;
    if (current.length === 0 || loadingMore) return;
    setLoadingMore(true);
    try {
      const batch = await fetchChatMessages(current[0].created_at);
      setHasMore(batch.length >= 50);
      if (batch.length > 0) {
        setMessages((prev) => [...batch, ...prev]);
      } else {
        setHasMore(false);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 40 && hasMore && !loadingMore) {
      void loadOlder();
    }
  }

  if (!profile) return null;

  if (!rulesOk) {
    return (
      <AppShell title="Болталка">
        <ChatRulesGate onAccept={() => setRulesOk(true)} />
      </AppShell>
    );
  }

  const isStaff = isStaffRole(profile.role);

  return (
    <AppShell title="Болталка">
      <div className="-mx-4 -mt-4 flex flex-col min-h-[calc(100dvh-8rem)]">
        <div className="px-4 py-2 bg-primary-50 border-b border-primary-100 text-xs text-primary-900">
          Общий чат всех участников. Текст, фото, реакции. Работает без VPN — в том же приложении, что
          расписание.
        </div>

        <div
          ref={listRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-36"
        >
          {hasMore && messages.length > 0 && (
            <div className="text-center">
              <Button size="sm" variant="ghost" disabled={loadingMore} onClick={() => void loadOlder()}>
                {loadingMore ? 'Загрузка…' : 'Показать раньше'}
              </Button>
            </div>
          )}

          {loading ? (
            <p className="text-center text-slate-500 text-sm py-8">Загрузка…</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">
              Пока тихо. Напишите первым — поздоровайтесь с потоком.
            </p>
          ) : (
            messages.map((m) => (
              <ChatMessageBubble
                key={m.id}
                message={m}
                isOwn={m.author_id === profile.id}
                isStaff={isStaff}
                myProfileId={profile.id}
                onReact={(emoji) =>
                  setReaction(m.id, profile.id, emoji)
                    .then(refresh)
                    .catch(() => undefined)
                }
                onDelete={() =>
                  softDeleteMessage(m.id)
                    .then(refresh)
                    .catch(() => undefined)
                }
              />
            ))
          )}
        </div>

        <div className="fixed left-0 right-0 z-20 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] mx-auto w-full max-w-lg">
          <ChatComposer
            profileId={profile.id}
            onSend={(body, imageUrl) =>
              sendChatMessage(profile.id, body, imageUrl).then(() => {
                atBottomRef.current = true;
                return refresh();
              })
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
