-- Announcement images + Web Push subscriptions
-- Если ошибка schema cache про image_url — выполните этот файл целиком в SQL Editor.

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS image_url text;

-- Быстрая проверка: SELECT image_url FROM announcements LIMIT 1;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON push_subscriptions(profile_id);

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_own ON push_subscriptions;
CREATE POLICY push_subscriptions_own ON push_subscriptions
  FOR ALL
  USING (profile_id = auth_profile_id())
  WITH CHECK (profile_id = auth_profile_id());

-- Storage: announcement images (public read, staff upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcement-images',
  'announcement-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS announcement_images_select ON storage.objects;
DROP POLICY IF EXISTS announcement_images_insert ON storage.objects;
DROP POLICY IF EXISTS announcement_images_update ON storage.objects;
DROP POLICY IF EXISTS announcement_images_delete ON storage.objects;

CREATE POLICY announcement_images_select ON storage.objects
  FOR SELECT
  USING (bucket_id = 'announcement-images');

CREATE POLICY announcement_images_insert ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'announcement-images'
    AND auth_is_staff()
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'gif'))
  );

CREATE POLICY announcement_images_update ON storage.objects
  FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'announcement-images' AND auth_is_staff())
  WITH CHECK (bucket_id = 'announcement-images' AND auth_is_staff());

CREATE POLICY announcement_images_delete ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'announcement-images' AND auth_is_staff());
