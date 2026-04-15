import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { createStudent, findStudentByRollNo, findStudentWithDetailsByRollNo } from '../models/userModel';
import { UserRole } from '../middleware/roleMiddleware';

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
