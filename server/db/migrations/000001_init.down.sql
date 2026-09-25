-- Reverses 000001_init.up.sql. Does not drop the app_user role (cluster-level,
-- not schema-scoped, and other databases/environments may still depend on it).
DROP FUNCTION IF EXISTS get_user_for_auth(TEXT);

DROP TABLE IF EXISTS notification_log CASCADE;
DROP TABLE IF EXISTS attendance_aggregates CASCADE;
DROP TABLE IF EXISTS overrides CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS verification_attempts CASCADE;
DROP TABLE IF EXISTS class_sessions CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS colleges CASCADE;

DROP FUNCTION IF EXISTS get_current_college_id();
