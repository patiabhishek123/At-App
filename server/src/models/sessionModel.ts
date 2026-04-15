import { pool } from '../config/db';

export interface Branch {
  id: string;
  name: string;
}

export interface Year {
  id: string;
  year_number: number;
}

export interface Session {
  id: string;
  subject_id: string;
  created_by_teacher_id: string;
  start_time: Date;
  end_time: Date | null;
  is_active: boolean;
  session_token: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  timestamp: Date;
  status: 'present' | 'absent' | 'late' | 'excused';
  student_ip: string;
  subnet: string;
}

export interface SessionWithAge extends Session {
  elapsed_seconds: number;
}

export interface SessionAttendanceEntry {
  student_id: string;
  name: string;
  roll_no: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  marked_at: Date | null;
}

export interface StudentSummary {
  id: string;
  name: string;
  roll_no: string;
  branch_id: string;
  year_id: string;
}

export interface SubjectWithHierarchy {
  id: string;
  name: string;
  branch_id: string;
  year_id: string;
  branch_name: string;
  year_number: number;
}

export interface StudentEligibility {
  eligible: boolean;
  reason?: string;
}

export async function ensureSessionTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS years (
      id BIGSERIAL PRIMARY KEY,
      year_number SMALLINT NOT NULL UNIQUE,
      CONSTRAINT chk_year_range CHECK (year_number >= 1 AND year_number <= 4)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      branch_id BIGINT NOT NULL REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      year_id BIGINT NOT NULL REFERENCES years(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      CONSTRAINT uq_subject_branch_year_name UNIQUE (branch_id, year_id, name)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teacher_subjects (
      id BIGSERIAL PRIMARY KEY,
      teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE CASCADE,
      subject_id BIGINT NOT NULL REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT uq_teacher_subject UNIQUE (teacher_id, subject_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      subject_id BIGINT NOT NULL REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      created_by_teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      session_token VARCHAR(128) NOT NULL UNIQUE,
      CONSTRAINT chk_sessions_time CHECK (end_time IS NULL OR end_time >= start_time)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id BIGSERIAL PRIMARY KEY,
      session_id BIGINT NOT NULL REFERENCES sessions(id) ON UPDATE CASCADE ON DELETE CASCADE,
      student_id BIGINT NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
      "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(20) NOT NULL,
      student_ip INET,
      subnet VARCHAR(50),
      CONSTRAINT uq_attendance_session_student UNIQUE (session_id, student_id),
      CONSTRAINT chk_attendance_status CHECK (status IN ('present', 'absent', 'late', 'excused'))
    );
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_students_branch_year ON students(branch_id, year_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_subjects_branch_year ON subjects(branch_id, year_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher_id ON teacher_subjects(teacher_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject_id ON teacher_subjects(subject_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_subject_id ON sessions(subject_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_created_by_teacher_id ON sessions(created_by_teacher_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id)');
}

export async function findTeacherById(teacherId: string): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM teachers WHERE id = $1 LIMIT 1', [teacherId]);
  return result.rows.length > 0;
}

export async function isSubjectAssignedToTeacher(subjectId: string, teacherId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM teacher_subjects WHERE subject_id = $1 AND teacher_id = $2 LIMIT 1',
    [subjectId, teacherId]
  );
  return result.rows.length > 0;
}

export async function getSubjectWithHierarchy(subjectId: string): Promise<SubjectWithHierarchy | null> {
  const result = await pool.query<SubjectWithHierarchy>(
    `
      SELECT
        s.id,
        s.name,
        s.branch_id,
        s.year_id,
        b.name AS branch_name,
        y.year_number
      FROM subjects s
      JOIN branches b ON s.branch_id = b.id
      JOIN years y ON s.year_id = y.id
      WHERE s.id = $1
      LIMIT 1
    `,
    [subjectId]
  );

  return result.rows[0] ?? null;
}

export async function createSession(subjectId: string, createdByTeacherId: string, sessionToken: string): Promise<Session> {
  const result = await pool.query<Session>(
    `
      INSERT INTO sessions (subject_id, created_by_teacher_id, start_time, is_active, session_token)
      VALUES ($1, $2, NOW(), TRUE, $3)
      RETURNING id, subject_id, created_by_teacher_id, start_time, end_time, is_active, session_token
    `,
    [subjectId, createdByTeacherId, sessionToken]
  );

  return result.rows[0];
}

export async function findSessionById(sessionId: string): Promise<Session | null> {
  const result = await pool.query<Session>(
    `
      SELECT id, subject_id, created_by_teacher_id, start_time, end_time, is_active, session_token
      FROM sessions
      WHERE id = $1
      LIMIT 1
    `,
    [sessionId]
  );

  return result.rows[0] ?? null;
}

export async function deactivateSession(sessionId: string): Promise<Session | null> {
  const result = await pool.query<Session>(
    `
      UPDATE sessions
      SET is_active = FALSE,
          end_time = COALESCE(end_time, NOW())
      WHERE id = $1 AND is_active = TRUE
      RETURNING id, subject_id, created_by_teacher_id, start_time, end_time, is_active, session_token
    `,
    [sessionId]
  );

  return result.rows[0] ?? null;
}

export async function findSessionByToken(sessionToken: string): Promise<SessionWithAge | null> {
  const result = await pool.query<SessionWithAge>(
    `
      SELECT
        id,
        subject_id,
        created_by_teacher_id,
        start_time,
        end_time,
        is_active,
        session_token,
        EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER AS elapsed_seconds
      FROM sessions
      WHERE session_token = $1
      LIMIT 1
    `,
    [sessionToken]
  );

  return result.rows[0] ?? null;
}

export async function createAttendanceRecord(
  sessionId: string,
  studentId: string,
  status: AttendanceRecord['status'],
  studentIp: string,
  subnet: string
): Promise<AttendanceRecord | null> {
  const result = await pool.query<AttendanceRecord>(
    `
      INSERT INTO attendance (session_id, student_id, "timestamp", status, student_ip, subnet)
      VALUES ($1, $2, NOW(), $3, $4, $5)
      ON CONFLICT (session_id, student_id) DO NOTHING
      RETURNING id, session_id, student_id, "timestamp", status, student_ip, subnet
    `,
    [sessionId, studentId, status, studentIp, subnet]
  );

  return result.rows[0] ?? null;
}

export async function findSessionAttendanceSubnet(sessionId: string): Promise<string | null> {
  const result = await pool.query<{ subnet: string | null }>(
    `
      SELECT subnet
      FROM attendance
      WHERE session_id = $1 AND subnet IS NOT NULL
      ORDER BY "timestamp" ASC
      LIMIT 1
    `,
    [sessionId]
  );

  return result.rows[0]?.subnet ?? null;
}

export async function findAttendanceBySessionAndStudent(
  sessionId: string,
  studentId: string
): Promise<AttendanceRecord | null> {
  const result = await pool.query<AttendanceRecord>(
    `
      SELECT id, session_id, student_id, "timestamp", status, student_ip, subnet
      FROM attendance
      WHERE session_id = $1 AND student_id = $2
      LIMIT 1
    `,
    [sessionId, studentId]
  );

  return result.rows[0] ?? null;
}

export async function listSessionAttendance(sessionId: string): Promise<SessionAttendanceEntry[]> {
  const result = await pool.query<SessionAttendanceEntry>(
    `
      SELECT
        s.id AS student_id,
        s.name,
        s.roll_no,
        COALESCE(a.status, 'absent') AS status,
        a."timestamp" AS marked_at
      FROM students s
      LEFT JOIN attendance a
        ON a.student_id = s.id
       AND a.session_id = $1
      ORDER BY s.roll_no ASC
    `,
    [sessionId]
  );

  return result.rows;
}

export async function findStudentById(studentId: string): Promise<StudentSummary | null> {
  const result = await pool.query<StudentSummary>(
    `
      SELECT id, name, roll_no, branch_id, year_id
      FROM students
      WHERE id = $1
      LIMIT 1
    `,
    [studentId]
  );

  return result.rows[0] ?? null;
}

export async function countMarkedAttendanceBySession(sessionId: string): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::TEXT AS total
      FROM attendance
      WHERE session_id = $1 AND status = 'present'
    `,
    [sessionId]
  );

  return Number(result.rows[0]?.total ?? '0');
}

export async function checkStudentEligibility(studentId: string, sessionSubjectId: string): Promise<StudentEligibility> {
  try {
    // Get student's branch and year
    const studentResult = await pool.query<{ branch_id: string; year_id: string }>(
      'SELECT branch_id, year_id FROM students WHERE id = $1',
      [studentId]
    );

    if (!studentResult.rows[0]) {
      return { eligible: false, reason: 'Student not found' };
    }

    const { branch_id: studentBranchId, year_id: studentYearId } = studentResult.rows[0];

    // Get subject's branch and year
    const subjectResult = await pool.query<{ branch_id: string; year_id: string }>(
      'SELECT branch_id, year_id FROM subjects WHERE id = $1',
      [sessionSubjectId]
    );

    if (!subjectResult.rows[0]) {
      return { eligible: false, reason: 'Subject not found' };
    }

    const { branch_id: subjectBranchId, year_id: subjectYearId } = subjectResult.rows[0];

    // Check if student's branch and year match subject's branch and year
    if (String(studentBranchId) === String(subjectBranchId) && String(studentYearId) === String(subjectYearId)) {
      return { eligible: true };
    }

    return { eligible: false, reason: 'Student branch/year does not match session subject' };
  } catch (error) {
    return { eligible: false, reason: 'Error checking eligibility' };
  }
}

export async function getTeacherAssignedSubjects(teacherId: string): Promise<SubjectWithHierarchy[]> {
  const result = await pool.query<SubjectWithHierarchy>(
    `
      SELECT
        s.id,
        s.name,
        s.branch_id,
        s.year_id,
        b.name AS branch_name,
        y.year_number
      FROM subjects s
      JOIN teacher_subjects ts ON s.id = ts.subject_id
      JOIN branches b ON s.branch_id = b.id
      JOIN years y ON s.year_id = y.id
      WHERE ts.teacher_id = $1
      ORDER BY b.name, y.year_number, s.name
    `,
    [teacherId]
  );

  return result.rows;
}
