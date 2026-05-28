/** Реакции в болталке — одна на человека, повторное нажатие снимает */
export const CHAT_REACTIONS = ['❤️', '👍', '😂', '😮', '🙏', '🔥'] as const;

export type ChatReactionEmoji = (typeof CHAT_REACTIONS)[number];

export const CHAT_RULES_KEY = 'psy-event-chat-rules-v1';

export const CHAT_RULES_TEXT = [
  'Общая болталка интенсива — без VPN, для всех участников с кодом входа.',
  'Можно писать текст, делиться фото и ставить реакции.',
  'Не публикуйте содержание групп и личной терапии. Уважайте границы.',
  'Организаторы могут удалять неуместные сообщения.',
] as const;
