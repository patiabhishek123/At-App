import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { createStudent, findStudentByRollNo, findStudentWithDetailsByRollNo } from '../models/userModel';
import { UserRole } from '../middleware/roleMiddleware';
import { pool } from '../config/db';

type AuthPayload = {
  studentId: string;
  rollNo: string;
  role: UserRole;
};

type AuthTokenWithDetails = {
  token: string;
  student: {
    id: string;
    name: string;
    roll_no: string;
    branch_name: string;
    year_number: number;
  };
};

function createToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '1d' });
}

export async function register(
  name: string,
  rollNo: string,
  password: string,
  branchId: string,
  yearId: string
): Promise<AuthTokenWithDetails> {
  const existing = await findStudentByRollNo(rollNo);
  if (existing) {
    throw new Error('Student already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const student = await createStudent(name, rollNo, passwordHash, branchId, yearId);
  const studentWithDetails = await findStudentWithDetailsByRollNo(rollNo);

  if (!studentWithDetails) {
    throw new Error('Failed to retrieve student details');
  }

  const token = createToken({ studentId: student.id, rollNo: student.roll_no, role: 'student' });

  return {
    token,
    student: {
      id: studentWithDetails.id,
      name: studentWithDetails.name,
      roll_no: studentWithDetails.roll_no,
      branch_name: studentWithDetails.branch_name,
      year_number: studentWithDetails.year_number
    }
  };
}

export async function login(rollNo: string, password: string): Promise<AuthTokenWithDetails> {
  const student = await findStudentWithDetailsByRollNo(rollNo);
  if (!student) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, student.password_hash);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const token = createToken({ studentId: student.id, rollNo: student.roll_no, role: 'student' });

  return {
    token,
    student: {
      id: student.id,
      name: student.name,
      roll_no: student.roll_no,
      branch_name: student.branch_name,
      year_number: student.year_number
    }
  };
}

type DemoTeacherTokenResponse = {
  token: string;
  teacher: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    branch_name: string;
    year_number: number;
  };
};

export async function issueDemoTeacherToken(): Promise<DemoTeacherTokenResponse> {
  await pool.query(`
    INSERT INTO branches (name)
    VALUES ('CSE')
    ON CONFLICT (name) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO years (year_number)
    VALUES (3)
    ON CONFLICT (year_number) DO NOTHING
  `);

  let teacherResult = await pool.query<{ id: string; name: string }>(
    `
      SELECT id, name
      FROM teachers
      WHERE name = 'Demo Teacher'
      ORDER BY id ASC
      LIMIT 1
    `
  );

  if (teacherResult.rows.length === 0) {
    teacherResult = await pool.query<{ id: string; name: string }>(
      `
        INSERT INTO teachers (name)
        VALUES ('Demo Teacher')
        RETURNING id, name
      `
    );
  }

  const teacher = teacherResult.rows[0];

  if (!teacher) {
    throw new Error('Unable to create demo teacher');
  }

  const subjectResult = await pool.query<{ id: string; name: string; branch_name: string; year_number: number }>(
    `
      WITH refs AS (
        SELECT
          (SELECT id FROM branches WHERE name = 'CSE' LIMIT 1) AS branch_id,
          (SELECT id FROM years WHERE year_number = 3 LIMIT 1) AS year_id
      )
      INSERT INTO subjects (name, branch_id, year_id)
      SELECT 'Math_3', refs.branch_id, refs.year_id
      FROM refs
      ON CONFLICT (branch_id, year_id, name) DO NOTHING
      RETURNING id, name,
        (SELECT name FROM branches WHERE id = subjects.branch_id) AS branch_name,
        (SELECT year_number FROM years WHERE id = subjects.year_id) AS year_number
    `
  );

  let subject = subjectResult.rows[0];

  if (!subject) {
    const existingSubject = await pool.query<{ id: string; name: string; branch_name: string; year_number: number }>(
      `
        SELECT
          s.id,
          s.name,
          b.name AS branch_name,
          y.year_number
        FROM subjects s
        JOIN branches b ON b.id = s.branch_id
        JOIN years y ON y.id = s.year_id
        WHERE s.name = 'Math_3' AND b.name = 'CSE' AND y.year_number = 3
        LIMIT 1
      `
    );
    subject = existingSubject.rows[0];
  }

  if (!subject) {
    throw new Error('Unable to create demo subject');
  }

  await pool.query(
    `
      INSERT INTO teacher_subjects (teacher_id, subject_id)
      VALUES ($1, $2)
      ON CONFLICT (teacher_id, subject_id) DO NOTHING
    `,
    [teacher.id, subject.id]
  );

  const token = createToken({
    studentId: teacher.id,
    rollNo: `T${teacher.id}`,
    role: 'teacher'
  });

  return {
    token,
    teacher,
    subject
  };
}
