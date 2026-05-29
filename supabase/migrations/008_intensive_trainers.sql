-- Справочник тренеров интенсива (карточка привязана к участнику profiles)

CREATE TABLE intensive_trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  gestalt_url text,
  full_name text NOT NULL,
  photo_url text,
  status_line text,
  bio text,
  specializations text,
  phone text,
  email text,
  city text,
  sort_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intensive_trainers_sort ON intensive_trainers(sort_order, full_name);
CREATE INDEX idx_intensive_trainers_visible ON intensive_trainers(is_visible) WHERE is_visible = true;

COMMENT ON TABLE intensive_trainers IS 'Публичные карточки тренеров интенсива; profile_id = участник с кодом входа';
COMMENT ON COLUMN intensive_trainers.gestalt_url IS 'Страница на gestalt.ru/author/... для повторного импорта';

CREATE OR REPLACE FUNCTION intensive_trainers_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER intensive_trainers_updated_at
  BEFORE UPDATE ON intensive_trainers
  FOR EACH ROW
  EXECUTE FUNCTION intensive_trainers_touch_updated_at();

-- Storage: фото тренеров
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trainer-photos',
  'trainer-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS trainer_photos_select ON storage.objects;
DROP POLICY IF EXISTS trainer_photos_insert ON storage.objects;
DROP POLICY IF EXISTS trainer_photos_update ON storage.objects;
DROP POLICY IF EXISTS trainer_photos_delete ON storage.objects;

CREATE POLICY trainer_photos_select ON storage.objects
  FOR SELECT
  USING (bucket_id = 'trainer-photos');

CREATE POLICY trainer_photos_insert ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'trainer-photos'
    AND (
      auth_is_staff()
      OR EXISTS (
        SELECT 1 FROM intensive_trainers t
        WHERE t.profile_id = auth_profile_id()
      )
    )
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'gif'))
  );

CREATE POLICY trainer_photos_update ON storage.objects
  FOR UPDATE
  TO anon, authenticated
  USING (
    bucket_id = 'trainer-photos'
    AND (
      auth_is_staff()
      OR EXISTS (
        SELECT 1 FROM intensive_trainers t
        WHERE t.profile_id = auth_profile_id()
      )
    )
  )
  WITH CHECK (bucket_id = 'trainer-photos');

CREATE POLICY trainer_photos_delete ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'trainer-photos' AND auth_is_staff());

-- RLS
ALTER TABLE intensive_trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY intensive_trainers_select ON intensive_trainers
  FOR SELECT
  USING (
    auth_profile_id() IS NOT NULL
    AND is_visible = true
  );

CREATE POLICY intensive_trainers_select_own ON intensive_trainers
  FOR SELECT
  USING (profile_id = auth_profile_id());

CREATE POLICY intensive_trainers_staff ON intensive_trainers
  FOR ALL
  USING (auth_is_staff())
  WITH CHECK (auth_is_staff());

-- Владелец карточки может править свой текст и контакты (не sort_order / gestalt_url / profile_id)
CREATE POLICY intensive_trainers_self_update ON intensive_trainers
  FOR UPDATE
  USING (profile_id = auth_profile_id())
  WITH CHECK (profile_id = auth_profile_id());
