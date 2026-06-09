-- Центр управления: организатор может править связи напрямую (не ломает участнический UI)

CREATE POLICY connections_staff ON connections
  FOR ALL
  USING (auth_is_staff())
  WITH CHECK (auth_is_staff());
