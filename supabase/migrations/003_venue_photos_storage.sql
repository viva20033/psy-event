-- Venue photos: public read, upload/delete for staff (organizer/admin via x-access-code)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'venue-photos',
  'venue-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS venue_photos_select ON storage.objects;
DROP POLICY IF EXISTS venue_photos_insert ON storage.objects;
DROP POLICY IF EXISTS venue_photos_update ON storage.objects;
DROP POLICY IF EXISTS venue_photos_delete ON storage.objects;

CREATE POLICY venue_photos_select ON storage.objects
  FOR SELECT
  USING (bucket_id = 'venue-photos');

CREATE POLICY venue_photos_insert ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'venue-photos'
    AND auth_is_staff()
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'gif'))
  );

CREATE POLICY venue_photos_update ON storage.objects
  FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'venue-photos' AND auth_is_staff())
  WITH CHECK (bucket_id = 'venue-photos' AND auth_is_staff());

CREATE POLICY venue_photos_delete ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'venue-photos' AND auth_is_staff());
