import { pool } from '../config/db';

export type StudentStats = {
  classes_attended: number;
  total_sessions: number;
  attendance_percentage: number;
};

export type StudentHistoryItem = {
  session_id: string;
  date: Date;
  subject: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  timestamp: Date | null;
};

export type SessionAttendanceCsvItem = {
  student_name: string;
  roll_no: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  timestamp: Date | null;
};

export type SessionAttendanceSummaryRow = {
  student_id: string;
  name: string;
  roll_no: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  marked_at: Date | null;
};

export async function getStudentStatsById(studentId: string): Promise<StudentStats> {
  const result = await pool.query<{
    classes_attended: string;
    total_sessions: string;
    attendance_percentage: string;
  }>(
    `
      WITH student_scope AS (
        SELECT branch_id, year_id
        FROM students
        WHERE id = $1
      ),
      session_scope AS (
        SELECT se.id
        FROM sessions se
        JOIN subjects su ON su.id = se.subject_id
        JOIN student_scope ss ON ss.branch_id = su.branch_id AND ss.year_id = su.year_id
      ),
      attended_scope AS (
        SELECT COUNT(*) AS classes_attended
        FROM attendance a
        JOIN session_scope sc ON sc.id = a.session_id
        WHERE a.student_id = $1
          AND a.status = 'present'
      )
      SELECT
        (SELECT classes_attended FROM attended_scope)::TEXT AS classes_attended,
        (SELECT COUNT(*) FROM session_scope)::TEXT AS total_sessions,
        CASE
          WHEN (SELECT COUNT(*) FROM session_scope) = 0 THEN '0'
          ELSE ROUND(
            ((SELECT classes_attended::NUMERIC FROM attended_scope) * 100.0)
            / (SELECT COUNT(*)::NUMERIC FROM session_scope),
            2
          )::TEXT
        END AS attendance_percentage
    `,
    [studentId]
  );

  const row = result.rows[0];

  return {
    classes_attended: Number(row?.classes_attended ?? '0'),
    total_sessions: Number(row?.total_sessions ?? '0'),
    attendance_percentage: Number(row?.attendance_percentage ?? '0')
  };
}

export async function getStudentHistoryById(studentId: string, limit = 5): Promise<StudentHistoryItem[]> {
  const result = await pool.query<StudentHistoryItem>(
    `
      WITH student_scope AS (
        SELECT branch_id, year_id
        FROM students
        WHERE id = $1
      )
      SELECT
        se.id::TEXT AS session_id,
        se.start_time AS date,
        su.name AS subject,
        COALESCE(a.status, 'absent') AS status,
        a."timestamp" AS timestamp
      FROM sessions se
      JOIN subjects su ON su.id = se.subject_id
      JOIN student_scope ss ON ss.branch_id = su.branch_id AND ss.year_id = su.year_id
      LEFT JOIN attendance a
        ON a.session_id = se.id
       AND a.student_id = $1
      ORDER BY se.start_time DESC
      LIMIT $2
    `,
    [studentId, limit]
  );

  return result.rows;
}

export async function countEligibleStudentsForSession(sessionId: string): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `
      SELECT COUNT(*)::TEXT AS total
      FROM sessions se
      JOIN subjects su ON su.id = se.subject_id
      JOIN students st ON st.branch_id = su.branch_id AND st.year_id = su.year_id
      WHERE se.id = $1
    `,
    [sessionId]
  );

  return Number(result.rows[0]?.total ?? '0');
}

export async function getSessionAttendanceForCsv(
  sessionId: string
): Promise<SessionAttendanceCsvItem[]> {
  const result = await pool.query<SessionAttendanceCsvItem>(
    `
      SELECT
        st.name AS student_name,
        st.roll_no,
        COALESCE(a.status, 'absent') AS status,
        a."timestamp" AS timestamp
      FROM sessions se
      JOIN subjects su ON su.id = se.subject_id
      JOIN students st ON st.branch_id = su.branch_id AND st.year_id = su.year_id
      LEFT JOIN attendance a ON a.session_id = se.id AND a.student_id = st.id
      WHERE se.id = $1
      ORDER BY st.roll_no ASC
    `,
    [sessionId]
  );

  return result.rows;
}

export async function getSessionAttendanceForSummary(
  sessionId: string
): Promise<SessionAttendanceSummaryRow[]> {
  const result = await pool.query<SessionAttendanceSummaryRow>(
    `
      SELECT
        st.id::TEXT AS student_id,
        st.name,
        st.roll_no,
        COALESCE(a.status, 'absent') AS status,
        a."timestamp" AS marked_at
      FROM sessions se
      JOIN subjects su ON su.id = se.subject_id
      JOIN students st ON st.branch_id = su.branch_id AND st.year_id = su.year_id
      LEFT JOIN attendance a ON a.session_id = se.id AND a.student_id = st.id
      WHERE se.id = $1
      ORDER BY st.roll_no ASC
    `,
    [sessionId]
  );

  return result.rows;
}
