import { pool } from '../config/db';
import { randomUUID } from 'crypto';

export interface Student {
  id: string;
  name: string;
  roll_no: string;
  password_hash: string;
  branch_id: string;
  year_id: string;
}

export interface StudentWithDetails extends Student {
  branch_name: string;
  year_number: number;
}

export async function ensureStudentsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      roll_no VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      branch_id BIGINT NOT NULL REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      year_id BIGINT NOT NULL REFERENCES years(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_students_branch_year ON students(branch_id, year_id)');
}

export async function findStudentByRollNo(rollNo: string): Promise<Student | null> {
  const result = await pool.query<Student>(
    'SELECT id, name, roll_no, password_hash, branch_id, year_id FROM students WHERE roll_no = $1 LIMIT 1',
    [rollNo]
  );
  return result.rows[0] ?? null;
}

export async function findStudentWithDetailsByRollNo(rollNo: string): Promise<StudentWithDetails | null> {
  const result = await pool.query<StudentWithDetails>(
    `
      SELECT
        s.id, s.name, s.roll_no, s.password_hash, s.branch_id, s.year_id,
        b.name AS branch_name,
        y.year_number
      FROM students s
      JOIN branches b ON s.branch_id = b.id
      JOIN years y ON s.year_id = y.id
      WHERE s.roll_no = $1 LIMIT 1
    `,
    [rollNo]
  );
  return result.rows[0] ?? null;
}

export async function createStudent(
  name: string,
  rollNo: string,
  passwordHash: string,
  branchId: string,
  yearId: string
): Promise<Student> {
  const id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  const result = await pool.query<Student>(
    `
      INSERT INTO students (id, name, roll_no, password_hash, branch_id, year_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, roll_no, password_hash, branch_id, year_id
    `,
    [id, name, rollNo, passwordHash, branchId, yearId]
  );

  return result.rows[0];
}

export async function getBranches(): Promise<Array<{ id: string; name: string }>> {
  const result = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM branches ORDER BY name ASC'
  );
  return result.rows;
}

export async function getYears(): Promise<Array<{ id: string; year_number: number }>> {
  const result = await pool.query<{ id: string; year_number: number }>(
    'SELECT id, year_number FROM years ORDER BY year_number ASC'
  );
  return result.rows;
}
