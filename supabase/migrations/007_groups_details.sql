-- Группы: место, роли в составе (линейный / приглашённый / ведущий)

CREATE TYPE group_member_role AS ENUM (
  'participant',
  'linear_trainer',
  'invited_trainer',
  'leader'
);

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id),
  ADD COLUMN IF NOT EXISTS meeting_note text;

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS member_role group_member_role NOT NULL DEFAULT 'participant',
  ADD COLUMN IF NOT EXISTS three_day_block smallint,
  ADD CONSTRAINT group_members_three_day_block_check
    CHECK (three_day_block IS NULL OR three_day_block BETWEEN 1 AND 3);

UPDATE group_members
SET member_role = 'leader'::group_member_role
WHERE is_leader = true AND member_role = 'participant'::group_member_role;

COMMENT ON COLUMN groups.meeting_note IS 'Где встречается группа, если не привязано к месту из справочника';
COMMENT ON COLUMN group_members.three_day_block IS 'Для приглашённого тренера: 1, 2 или 3 трёхдневка';
