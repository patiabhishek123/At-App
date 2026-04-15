import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { createStudent, findStudentByRollNo } from '../models/userModel';

type AuthPayload = {
  studentId: string;
  rollNo: string;
};

function createToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '1d' });
}

export async function register(name: string, rollNo: string, password: string): Promise<string> {
  const existing = await findStudentByRollNo(rollNo);
  if (existing) {
    throw new Error('Student already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const student = await createStudent(name, rollNo, passwordHash);

  return createToken({ studentId: student.id, rollNo: student.roll_no });
}

export async function login(rollNo: string, password: string): Promise<string> {
  const student = await findStudentByRollNo(rollNo);
  if (!student) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, student.password_hash);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  return createToken({ studentId: student.id, rollNo: student.roll_no });
}
