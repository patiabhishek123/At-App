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

  await pool.query('CREATE INDEX IF NOT EXISTS idx_subjects_teacher_id ON subjects(teacher_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_subject_id ON sessions(subject_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON sessions(teacher_id)');
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
