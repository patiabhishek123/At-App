-- Drop existing tables for repeatable runs
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

-- Enable UUID extension

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. colleges
CREATE TABLE colleges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    verification_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);

-- 3. users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);

-- 4. courses
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    attendance_threshold_pct NUMERIC(5,2) DEFAULT NULL
);

-- 5. sections
CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    classroom_bssid TEXT,
    classroom_geofence_lat NUMERIC(9,6),
    classroom_geofence_lng NUMERIC(9,6),
    classroom_geofence_radius_m NUMERIC(6,2)
);

-- 6. enrollments
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, section_id)
);

-- 7. class_sessions
CREATE TABLE class_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    started_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    current_code TEXT NOT NULL,
    code_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    geofence_override_lat NUMERIC(9,6),
    geofence_override_lng NUMERIC(9,6),
    geofence_override_radius_m NUMERIC(6,2)
);

-- 8. verification_attempts
CREATE TABLE verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    code_match BOOLEAN NOT NULL,
    bssid_match BOOLEAN NOT NULL,
    geofence_match BOOLEAN NOT NULL,
    raw_bssid TEXT,
    raw_gps_lat NUMERIC(9,6),
    raw_gps_lng NUMERIC(9,6),
    result TEXT NOT NULL CHECK (result IN ('accepted', 'rejected')),
    rejection_reason TEXT
);

-- 9. attendance_records
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'overridden_present', 'overridden_absent')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verification_attempt_id UUID REFERENCES verification_attempts(id) ON DELETE SET NULL,
    UNIQUE(session_id, student_id)
);

-- 10. overrides
CREATE TABLE overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
    overridden_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. attendance_aggregates (materialized / fast access)
CREATE TABLE attendance_aggregates (
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    present_count INT NOT NULL DEFAULT 0,
    total_sessions INT NOT NULL DEFAULT 0,
    attendance_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (student_id, section_id)
);

-- 12. notification_log
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('threshold_warning', 'session_reminder')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ==========================================
-- INDEXING
-- ==========================================
CREATE INDEX idx_users_college ON users(college_id);
CREATE INDEX idx_sections_teacher ON sections(teacher_id);
CREATE INDEX idx_enrollments_student_section ON enrollments(student_id, section_id);
CREATE INDEX idx_class_sessions_section_started ON class_sessions(section_id, started_at);
CREATE INDEX idx_class_sessions_active ON class_sessions(section_id) WHERE ended_at IS NULL;
CREATE INDEX idx_verification_attempts_session_student ON verification_attempts(session_id, student_id);
CREATE INDEX idx_attendance_records_student_section ON attendance_records(student_id, session_id);

-- ==========================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Force RLS on all tables to apply policies to owners/superusers
ALTER TABLE colleges FORCE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE courses FORCE ROW LEVEL SECURITY;
ALTER TABLE sections FORCE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE class_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance_records FORCE ROW LEVEL SECURITY;
ALTER TABLE overrides FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance_aggregates FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_log FORCE ROW LEVEL SECURITY;

-- Helper to retrieve current college_id context
-- We check for a setting `app.current_college_id`. If it's empty, no rows will match.
CREATE OR REPLACE FUNCTION get_current_college_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_college_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Define RLS Policies for colleges table
CREATE POLICY tenant_colleges_policy ON colleges
    USING (id = get_current_college_id())
    WITH CHECK (id = get_current_college_id());

-- Define RLS Policies for all other tables referencing college_id
CREATE POLICY tenant_departments_policy ON departments
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_users_policy ON users
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_courses_policy ON courses
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_sections_policy ON sections
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_enrollments_policy ON enrollments
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_class_sessions_policy ON class_sessions
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_verification_attempts_policy ON verification_attempts
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_attendance_records_policy ON attendance_records
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_overrides_policy ON overrides
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_attendance_aggregates_policy ON attendance_aggregates
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

CREATE POLICY tenant_notification_log_policy ON notification_log
    USING (college_id = get_current_college_id())
    WITH CHECK (college_id = get_current_college_id());

-- Create a non-superuser role to test and run application with RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';
    END IF;
END $$;

-- Grant permissions to app_user
GRANT CONNECT ON DATABASE atapp_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;

