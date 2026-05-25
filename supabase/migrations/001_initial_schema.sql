-- Psy Event: Gestalt Intensive PWA
-- Run in Supabase SQL Editor or via supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM (
  'client',
  'therapist',
  'supervisor',
  'hypervisor',
  'organizer',
  'admin'
);

CREATE TYPE group_type AS ENUM (
  'therapy',
  'supervision',
  'process'
);

CREATE TYPE connection_type AS ENUM (
  'client_therapist',
  'therapist_supervisor',
  'process_group'
);

CREATE TYPE connection_status AS ENUM (
  'pending',
  'confirmed',
  'rejected'
);

CREATE TYPE announcement_priority AS ENUM (
  'normal',
  'important',
  'urgent'
);

-- Helper: access code from request header (PostgREST passes as header)
CREATE OR REPLACE FUNCTION auth_access_code()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.headers', true)::json->>'x-access-code',
    ''
  );
$$;

-- Profiles (participants)
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_access_code ON profiles(access_code);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Auth helpers (must be after profiles table — SQL functions validate relations at create time)
CREATE OR REPLACE FUNCTION auth_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles
  WHERE access_code = auth_access_code()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth_profile_id()
      AND role IN ('organizer', 'admin')
  );
$$;

-- Venues (territory places)
CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  landmark text,
  route_hint text,
  photo_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event days
CREATE TABLE event_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_index int NOT NULL UNIQUE,
  label text NOT NULL,
  event_date date,
  is_rest_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Global settings
CREATE TABLE event_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO event_settings (key, value) VALUES
  ('rain_mode', 'false'::jsonb),
  ('organizer_contact', '"+7 (XXX) XXX-XX-XX"'::jsonb);

-- Groups
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  group_type group_type NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_leader boolean NOT NULL DEFAULT false,
  UNIQUE (group_id, profile_id)
);

CREATE INDEX idx_group_members_profile ON group_members(profile_id);

-- Schedule events
CREATE TABLE schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id uuid NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  venue_id uuid REFERENCES venues(id),
  backup_venue_id uuid REFERENCES venues(id),
  facilitator_id uuid REFERENCES profiles(id),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_events_day ON schedule_events(event_day_id);
CREATE INDEX idx_schedule_events_starts ON schedule_events(starts_at);

-- Who sees which event
CREATE TABLE event_audience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
  target_role user_role,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  for_everyone boolean NOT NULL DEFAULT false,
  CHECK (
    for_everyone = true
    OR target_role IS NOT NULL
    OR group_id IS NOT NULL
  )
);

CREATE INDEX idx_event_audience_event ON event_audience(event_id);

-- Connection requests (therapist, supervisor, process group)
CREATE TABLE connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_type connection_type NOT NULL,
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  target_group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  status connection_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CHECK (
    (target_profile_id IS NOT NULL AND target_group_id IS NULL)
    OR (target_profile_id IS NULL AND target_group_id IS NOT NULL)
  )
);

CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_target_profile ON connections(target_profile_id);
CREATE INDEX idx_connections_target_group ON connections(target_group_id);
CREATE INDEX idx_connections_status ON connections(status);

-- Announcements
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  priority announcement_priority NOT NULL DEFAULT 'normal',
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_published ON announcements(published_at DESC)
  WHERE is_published = true;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Generate access code
CREATE OR REPLACE FUNCTION generate_access_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Login RPC
CREATE OR REPLACE FUNCTION login_with_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile
  FROM profiles
  WHERE upper(trim(p_code)) = upper(trim(access_code))
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'full_name', v_profile.full_name,
      'role', v_profile.role,
      'access_code', v_profile.access_code
    )
  );
END;
$$;

-- Request connection
CREATE OR REPLACE FUNCTION request_connection(
  p_access_code text,
  p_type connection_type,
  p_target_profile_id uuid DEFAULT NULL,
  p_target_group_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid;
  v_conn connections%ROWTYPE;
BEGIN
  SELECT id INTO v_requester_id
  FROM profiles
  WHERE access_code = p_access_code AND is_active = true;

  IF v_requester_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  INSERT INTO connections (connection_type, requester_id, target_profile_id, target_group_id)
  VALUES (p_type, v_requester_id, p_target_profile_id, p_target_group_id)
  RETURNING * INTO v_conn;

  RETURN jsonb_build_object('ok', true, 'connection', row_to_json(v_conn));
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_exists');
END;
$$;

-- Respond to connection
CREATE OR REPLACE FUNCTION respond_connection(
  p_access_code text,
  p_connection_id uuid,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_conn connections%ROWTYPE;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles WHERE access_code = p_access_code AND is_active = true;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_conn FROM connections WHERE id = p_connection_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_conn.target_profile_id IS DISTINCT FROM v_profile_id
     AND NOT EXISTS (
       SELECT 1 FROM group_members gm
       WHERE gm.group_id = v_conn.target_group_id
         AND gm.profile_id = v_profile_id
         AND gm.is_leader = true
     ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE connections
  SET status = CASE WHEN p_accept THEN 'confirmed'::connection_status ELSE 'rejected'::connection_status END,
      confirmed_at = CASE WHEN p_accept THEN now() ELSE NULL END
  WHERE id = p_connection_id
  RETURNING * INTO v_conn;

  RETURN jsonb_build_object('ok', true, 'connection', row_to_json(v_conn));
END;
$$;

-- Toggle rain mode (staff only)
CREATE OR REPLACE FUNCTION set_rain_mode(p_access_code text, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE access_code = p_access_code
      AND role IN ('organizer', 'admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE event_settings
  SET value = to_jsonb(p_enabled), updated_at = now()
  WHERE key = 'rain_mode';

  RETURN jsonb_build_object('ok', true, 'rain_mode', p_enabled);
END;
$$;

-- Admin: create participant
CREATE OR REPLACE FUNCTION admin_create_profile(
  p_access_code text,
  p_full_name text,
  p_role user_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_profile profiles%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE access_code = p_access_code
      AND role IN ('organizer', 'admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_code := generate_access_code();
  WHILE EXISTS (SELECT 1 FROM profiles WHERE access_code = v_code) LOOP
    v_code := generate_access_code();
  END LOOP;

  INSERT INTO profiles (access_code, full_name, role)
  VALUES (v_code, p_full_name, p_role)
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', row_to_json(v_profile)
  );
END;
$$;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_audience ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Profiles: read own + staff reads all; staff writes
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (
    id = auth_profile_id()
    OR auth_is_staff()
    OR auth_access_code() IS NOT NULL
  );

CREATE POLICY profiles_staff_all ON profiles FOR ALL
  USING (auth_is_staff())
  WITH CHECK (auth_is_staff());

-- Public read for authenticated users (any valid code)
CREATE POLICY venues_select ON venues FOR SELECT
  USING (auth_profile_id() IS NOT NULL AND is_active = true);

CREATE POLICY event_days_select ON event_days FOR SELECT
  USING (auth_profile_id() IS NOT NULL);

CREATE POLICY event_settings_select ON event_settings FOR SELECT
  USING (auth_profile_id() IS NOT NULL);

CREATE POLICY groups_select ON groups FOR SELECT
  USING (auth_profile_id() IS NOT NULL);

CREATE POLICY group_members_select ON group_members FOR SELECT
  USING (auth_profile_id() IS NOT NULL);

CREATE POLICY schedule_events_select ON schedule_events FOR SELECT
  USING (auth_profile_id() IS NOT NULL);

CREATE POLICY event_audience_select ON event_audience FOR SELECT
  USING (auth_profile_id() IS NOT NULL);

CREATE POLICY announcements_select ON announcements FOR SELECT
  USING (
    auth_profile_id() IS NOT NULL
    AND is_published = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Connections: involved parties + staff
CREATE POLICY connections_select ON connections FOR SELECT
  USING (
    auth_is_staff()
    OR requester_id = auth_profile_id()
    OR target_profile_id = auth_profile_id()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = connections.target_group_id
        AND gm.profile_id = auth_profile_id()
    )
  );

-- Staff write policies
CREATE POLICY venues_staff ON venues FOR ALL
  USING (auth_is_staff()) WITH CHECK (auth_is_staff());

CREATE POLICY event_days_staff ON event_days FOR ALL
  USING (auth_is_staff()) WITH CHECK (auth_is_staff());

CREATE POLICY event_settings_staff ON event_settings FOR UPDATE
  USING (auth_is_staff()) WITH CHECK (auth_is_staff());

CREATE POLICY groups_staff ON groups FOR ALL
  USING (auth_is_staff()) WITH CHECK (auth_is_staff());

CREATE POLICY group_members_staff ON group_members FOR ALL
  USING (auth_is_staff()) WITH CHECK (auth_is_staff());

CREATE POLICY schedule_events_staff ON schedule_events FOR ALL
  USING (auth_is_staff()) WITH CHECK (auth_is_staff());

CREATE POLICY event_audience_staff ON event_audience FOR ALL
  USING (auth_is_staff()) WITH CHECK (auth_is_staff());

CREATE POLICY announcements_staff ON announcements FOR ALL
  USING (auth_is_staff()) WITH CHECK (auth_is_staff());

-- Grant RPC execute to anon
GRANT EXECUTE ON FUNCTION login_with_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION request_connection(text, connection_type, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION respond_connection(text, uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_rain_mode(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_profile(text, text, user_role) TO anon, authenticated;

-- Seed minimal data (optional — remove in production if undesired)
INSERT INTO event_days (day_index, label, is_rest_day) VALUES
  (0, 'Регистрационный день', false),
  (1, 'Трехдневка 1 — день 1', false),
  (2, 'Трехдневка 1 — день 2', false),
  (3, 'Трехдневка 1 — день 3', false),
  (4, 'Выходной', true),
  (5, 'Трехдневка 2 — день 1', false),
  (6, 'Трехдневка 2 — день 2', false),
  (7, 'Трехдневка 2 — день 3', false),
  (8, 'Выходной', true),
  (9, 'Трехдневка 3 — день 1', false),
  (10, 'Трехдневка 3 — день 2', false),
  (11, 'Трехдневка 3 — день 3', false),
  (12, 'Завершение', false);

INSERT INTO venues (slug, name, description, landmark, route_hint, sort_order) VALUES
  ('magnolia', 'Поляна у магнолии', 'Небольшая поляна в парке', 'Белое дерево магнолии у дорожки', 'От столовой — налево 3 минуты до магнолии', 1),
  ('big-field', 'Большая поляна', 'Основная площадка', 'Самая широкая поляна', 'Центральная аллея, прямо до конца', 2),
  ('gazebo-sea', 'Беседка у моря', 'Беседка с видом на море', 'Деревянная беседка на склоне', 'Спуск к пляжу, беседка справа', 3),
  ('dining', 'Столовая', 'Питание', 'Здание с вывеской', 'Главный вход санатория', 4),
  ('medical', 'Медпункт', 'Первая помощь', 'Красный крест на двери', 'Корпус А, 1 этаж', 5),
  ('beach', 'Пляж', 'Морской берег', 'Спуск к воде', 'По указателям «Пляж»', 6);
