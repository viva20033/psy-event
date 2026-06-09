-- Роль «Тренер интенсива» (член тренерской команды, не organizer/admin)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'trainer';
