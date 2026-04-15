-- PostgreSQL schema for attendance system with academic hierarchy

BEGIN;

-- Branches table
CREATE TABLE IF NOT EXISTS branches (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
);

-- Years table
CREATE TABLE IF NOT EXISTS years (
    id BIGSERIAL PRIMARY KEY,
    year_number SMALLINT NOT NULL UNIQUE,
    CONSTRAINT chk_year_range CHECK (year_number >= 1 AND year_number <= 4)
);

-- Students table with branch and year references
CREATE TABLE IF NOT EXISTS students (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    roll_no VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    branch_id BIGINT NOT NULL,
    year_id BIGINT NOT NULL,
    CONSTRAINT fk_students_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_students_year
        FOREIGN KEY (year_id)
        REFERENCES years(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Teachers table (simplified, no subject field)
CREATE TABLE IF NOT EXISTS teachers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL
);

-- Subjects table with branch and year
CREATE TABLE IF NOT EXISTS subjects (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    branch_id BIGINT NOT NULL,
    year_id BIGINT NOT NULL,
    CONSTRAINT fk_subjects_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_subjects_year
        FOREIGN KEY (year_id)
        REFERENCES years(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT uq_subject_branch_year_name UNIQUE (branch_id, year_id, name)
);

-- Teacher-Subject mapping table
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    subject_id BIGINT NOT NULL,
    CONSTRAINT fk_teacher_subjects_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_teacher_subjects_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT uq_teacher_subject UNIQUE (teacher_id, subject_id)
);

-- Sessions table with teacher reference via TeacherSubject
CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    created_by_teacher_id BIGINT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    session_token VARCHAR(128) NOT NULL UNIQUE,
    CONSTRAINT fk_sessions_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_sessions_teacher
        FOREIGN KEY (created_by_teacher_id)
        REFERENCES teachers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_sessions_time
        CHECK (end_time IS NULL OR end_time >= start_time)
);

-- Attendance table with IP and subnet tracking
CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL,
    student_ip INET,
    subnet VARCHAR(50),
    CONSTRAINT fk_attendance_session
        FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_attendance_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT uq_attendance_session_student UNIQUE (session_id, student_id),
    CONSTRAINT chk_attendance_status
        CHECK (status IN ('present', 'absent', 'late', 'excused'))
);

-- Indexes for FK lookups and common query patterns
CREATE INDEX IF NOT EXISTS idx_students_branch_year ON students(branch_id, year_id);

CREATE INDEX IF NOT EXISTS idx_subjects_branch_year ON subjects(branch_id, year_id);

CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher_id ON teacher_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject_id ON teacher_subjects(subject_id);

CREATE INDEX IF NOT EXISTS idx_sessions_subject_id ON sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by_teacher_id ON sessions(created_by_teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active_start_time ON sessions(is_active, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_session_status ON attendance(session_id, status);

COMMIT;
