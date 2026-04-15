import { pool } from '../config/db';

export interface Session {
  id: string;
  subject_id: string;
  teacher_id: string;
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

export async function ensureSessionTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      subject VARCHAR(120)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      subject_id BIGINT NOT NULL REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
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
      student_id UUID NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
      "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(20) NOT NULL,
      student_ip INET,
      subnet TEXT,
      CONSTRAINT uq_attendance_session_student UNIQUE (session_id, student_id),
      CONSTRAINT chk_attendance_status CHECK (status IN ('present', 'absent', 'late', 'excused'))
    );
  `);

  await pool.query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS student_ip INET');
  await pool.query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS subnet TEXT');

  await pool.query('CREATE INDEX IF NOT EXISTS idx_subjects_teacher_id ON subjects(teacher_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_subject_id ON sessions(subject_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON sessions(teacher_id)');
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
    'SELECT 1 FROM subjects WHERE id = $1 AND teacher_id = $2 LIMIT 1',
    [subjectId, teacherId]
  );
  return result.rows.length > 0;
}

export async function createSession(subjectId: string, teacherId: string, sessionToken: string): Promise<Session> {
  const result = await pool.query<Session>(
    `
      INSERT INTO sessions (subject_id, teacher_id, start_time, is_active, session_token)
      VALUES ($1, $2, NOW(), TRUE, $3)
      RETURNING id, subject_id, teacher_id, start_time, end_time, is_active, session_token
    `,
    [subjectId, teacherId, sessionToken]
  );

  return result.rows[0];
}

export async function findSessionById(sessionId: string): Promise<Session | null> {
  const result = await pool.query<Session>(
    `
      SELECT id, subject_id, teacher_id, start_time, end_time, is_active, session_token
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
      RETURNING id, subject_id, teacher_id, start_time, end_time, is_active, session_token
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
        teacher_id,
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
