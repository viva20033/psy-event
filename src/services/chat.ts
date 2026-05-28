import { supabase } from '@/lib/supabase/client';
import type { ChatMessage, ChatReaction } from '@/types';

const PAGE_SIZE = 50;

export type ChatMessageRow = ChatMessage & {
  author: { id: string; full_name: string } | null;
  reactions: ChatReaction[];
};

function mapRows(
  messages: Array<ChatMessage & { author?: { id: string; full_name: string } | null }>,
  reactions: ChatReaction[],
): ChatMessageRow[] {
  const byMessage = new Map<string, ChatReaction[]>();
  for (const r of reactions) {
    const list = byMessage.get(r.message_id) ?? [];
    list.push(r);
    byMessage.set(r.message_id, list);
  }
  return messages.map((m) => ({
    ...m,
    author: m.author ?? null,
    reactions: byMessage.get(m.id) ?? [],
  }));
}

export async function fetchChatMessages(before?: string): Promise<ChatMessageRow[]> {
  let query = supabase
    .from('chat_messages')
    .select('id, author_id, body, image_url, created_at, author:profiles!author_id(id, full_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data: messages, error } = await query;
  if (error) throw error;
  const raw = messages ?? [];
  const list = raw.map((row) => {
    const r = row as ChatMessage & {
      author?: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    };
    const author = Array.isArray(r.author) ? r.author[0] ?? null : r.author ?? null;
    return { ...r, author };
  });
  if (list.length === 0) return [];

  const ids = list.map((m) => m.id);
  const { data: reactions, error: rErr } = await supabase
    .from('chat_reactions')
    .select('id, message_id, profile_id, emoji, created_at')
    .in('message_id', ids);
  if (rErr) throw rErr;

  return mapRows(list, (reactions ?? []) as ChatReaction[]).reverse();
}

export async function sendChatMessage(
  authorId: string,
  body: string,
  imageUrl: string | null,
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed && !imageUrl) {
    throw new Error('Напишите текст или прикрепите фото');
  }
  const { error } = await supabase.from('chat_messages').insert({
    author_id: authorId,
    body: trimmed,
    image_url: imageUrl,
  });
  if (error) throw error;
}

export async function softDeleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function setReaction(
  messageId: string,
  profileId: string,
  emoji: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('chat_reactions')
    .select('id, emoji')
    .eq('message_id', messageId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existing?.emoji === emoji) {
    const { error } = await supabase.from('chat_reactions').delete().eq('id', existing.id);
    if (error) throw error;
    return;
  }

  if (existing) {
    const { error } = await supabase
      .from('chat_reactions')
      .update({ emoji })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('chat_reactions').insert({
    message_id: messageId,
    profile_id: profileId,
    emoji,
  });
  if (error) throw error;
}

export async function fetchReactionsForMessage(messageId: string): Promise<ChatReaction[]> {
  const { data, error } = await supabase
    .from('chat_reactions')
    .select('id, message_id, profile_id, emoji, created_at')
    .eq('message_id', messageId);
  if (error) throw error;
  return (data ?? []) as ChatReaction[];
}

export function subscribeChat(
  onMessage: () => void,
  onReaction: () => void,
): () => void {
  const channel = supabase
    .channel('chat-lounge')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      () => onMessage(),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
      () => onMessage(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_reactions' },
      () => onReaction(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
