-- Общая болталка интенсива: текст, фото, реакции

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id),
  CHECK (char_length(body) <= 4000),
  CHECK (body <> '' OR image_url IS NOT NULL)
);

CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, profile_id),
  CHECK (char_length(emoji) BETWEEN 1 AND 8)
);

CREATE INDEX idx_chat_reactions_message ON chat_reactions(message_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- Читать сообщения: любой вошедший участник
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT
  USING (auth_profile_id() IS NOT NULL AND deleted_at IS NULL);

-- Писать: от своего имени, активный профиль
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT
  WITH CHECK (
    auth_profile_id() IS NOT NULL
    AND author_id = auth_profile_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth_profile_id() AND is_active = true
    )
  );

-- Удалять (мягко): автор или staff
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE
  USING (
    auth_profile_id() IS NOT NULL
    AND (
      author_id = auth_profile_id()
      OR auth_is_staff()
    )
  )
  WITH CHECK (
    auth_profile_id() IS NOT NULL
    AND (
      author_id = auth_profile_id()
      OR auth_is_staff()
    )
  );

CREATE POLICY chat_reactions_select ON chat_reactions
  FOR SELECT
  USING (auth_profile_id() IS NOT NULL);

CREATE POLICY chat_reactions_insert ON chat_reactions
  FOR INSERT
  WITH CHECK (
    profile_id = auth_profile_id()
    AND auth_profile_id() IS NOT NULL
  );

CREATE POLICY chat_reactions_update ON chat_reactions
  FOR UPDATE
  USING (profile_id = auth_profile_id())
  WITH CHECK (profile_id = auth_profile_id());

CREATE POLICY chat_reactions_delete ON chat_reactions
  FOR DELETE
  USING (profile_id = auth_profile_id());

-- Storage: фото в болталке (читать все, писать участники)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS chat_images_select ON storage.objects;
DROP POLICY IF EXISTS chat_images_insert ON storage.objects;
DROP POLICY IF EXISTS chat_images_delete ON storage.objects;

CREATE POLICY chat_images_select ON storage.objects
  FOR SELECT
  USING (bucket_id = 'chat-images');

CREATE POLICY chat_images_insert ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'chat-images'
    AND auth_profile_id() IS NOT NULL
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'gif'))
  );

CREATE POLICY chat_images_delete ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'chat-images' AND auth_is_staff());

-- Realtime (в Dashboard: Database → Replication — включить chat_messages, chat_reactions)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
