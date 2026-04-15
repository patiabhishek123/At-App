import { pool } from '../config/db';
import { randomUUID } from 'crypto';

export interface Student {
  id: string;
  name: string;
  roll_no: string;
  password_hash: string;
}

export async function ensureStudentsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id UUID PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      roll_no VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function findStudentByRollNo(rollNo: string): Promise<Student | null> {
  const result = await pool.query<Student>(
    'SELECT id, name, roll_no, password_hash FROM students WHERE roll_no = $1 LIMIT 1',
    [rollNo]
  );
  return result.rows[0] ?? null;
}

export async function createStudent(name: string, rollNo: string, passwordHash: string): Promise<Student> {
  const id = randomUUID();

  const result = await pool.query<Student>(
    `
      INSERT INTO students (id, name, roll_no, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, roll_no, password_hash
    `,
    [id, name, rollNo, passwordHash]
  );

  return result.rows[0];
}
