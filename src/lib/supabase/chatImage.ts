import { uploadImage } from '@/lib/supabase/uploadImage';

const BUCKET = 'chat-images';
const MIGRATION = 'supabase/migrations/006_chat_lounge.sql';

export async function uploadChatImage(file: File, profileId: string): Promise<string> {
  const prefix = `posts/${profileId.slice(0, 8)}-${Date.now()}`;
  return uploadImage(BUCKET, prefix, file, MIGRATION);
}
