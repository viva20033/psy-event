import { uploadImage } from '@/lib/supabase/uploadImage';

const BUCKET = 'venue-photos';
const MIGRATION = 'supabase/migrations/003_venue_photos_storage.sql';

export async function uploadVenuePhoto(file: File, slug: string): Promise<string> {
  const safeSlug = slug.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').toLowerCase() || 'venue';
  return uploadImage(BUCKET, `venues/${safeSlug}-${Date.now()}`, file, MIGRATION);
}
