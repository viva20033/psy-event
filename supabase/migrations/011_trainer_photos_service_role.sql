-- Service role (edge functions, batch scripts) — загрузка фото тренеров без RLS-ограничений anon

DROP POLICY IF EXISTS trainer_photos_service ON storage.objects;

CREATE POLICY trainer_photos_service ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'trainer-photos')
  WITH CHECK (bucket_id = 'trainer-photos');
