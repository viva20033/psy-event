-- Prevent duplicate connections (same requester + target + type while pending/confirmed)

-- Remove duplicates: keep best row per pair (confirmed > pending > rejected, then earliest)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        connection_type,
        requester_id,
        COALESCE(target_profile_id::text, ''),
        COALESCE(target_group_id::text, '')
      ORDER BY
        CASE status
          WHEN 'confirmed' THEN 0
          WHEN 'pending' THEN 1
          ELSE 2
        END,
        confirmed_at NULLS LAST,
        created_at
    ) AS rn
  FROM connections
  WHERE status IN ('pending', 'confirmed')
)
DELETE FROM connections
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_unique_profile_pair
  ON connections (connection_type, requester_id, target_profile_id)
  WHERE status IN ('pending', 'confirmed') AND target_profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_unique_group_pair
  ON connections (connection_type, requester_id, target_group_id)
  WHERE status IN ('pending', 'confirmed') AND target_group_id IS NOT NULL;

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
  v_existing connections%ROWTYPE;
BEGIN
  SELECT id INTO v_requester_id
  FROM profiles
  WHERE access_code = p_access_code AND is_active = true;

  IF v_requester_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_type IN ('client_therapist', 'therapist_supervisor') AND p_target_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target');
  END IF;

  IF p_type = 'process_group' AND p_target_group_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target');
  END IF;

  SELECT * INTO v_existing
  FROM connections
  WHERE connection_type = p_type
    AND requester_id = v_requester_id
    AND status IN ('pending', 'confirmed')
    AND (
      (p_target_profile_id IS NOT NULL AND target_profile_id = p_target_profile_id)
      OR (p_target_group_id IS NOT NULL AND target_group_id = p_target_group_id)
    )
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'confirmed' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'already_confirmed',
        'connection', row_to_json(v_existing)
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'connection', row_to_json(v_existing),
      'already_pending', true
    );
  END IF;

  INSERT INTO connections (connection_type, requester_id, target_profile_id, target_group_id)
  VALUES (p_type, v_requester_id, p_target_profile_id, p_target_group_id)
  RETURNING * INTO v_conn;

  RETURN jsonb_build_object('ok', true, 'connection', row_to_json(v_conn));
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM connections
    WHERE connection_type = p_type
      AND requester_id = v_requester_id
      AND status IN ('pending', 'confirmed')
      AND (
        (p_target_profile_id IS NOT NULL AND target_profile_id = p_target_profile_id)
        OR (p_target_group_id IS NOT NULL AND target_group_id = p_target_group_id)
      )
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'connection', row_to_json(v_existing),
        'already_pending', true
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'already_exists');
END;
$$;

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

  SELECT * INTO v_conn FROM connections WHERE id = p_connection_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_conn.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'connection', row_to_json(v_conn),
      'already_responded', true
    );
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
