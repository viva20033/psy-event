import { uploadImage } from '@/lib/supabase/uploadImage';

const BUCKET = 'announcement-images';
const MIGRATION = 'supabase/migrations/004_announcements_push.sql';

export async function uploadAnnouncementImage(file: File): Promise<string> {
  return uploadImage(BUCKET, `items/${Date.now()}`, file, MIGRATION);
}
