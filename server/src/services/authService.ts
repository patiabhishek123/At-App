import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { createUser, findUserByEmail } from '../models/userModel';

type AuthPayload = {
  userId: string;
  email: string;
};

function createToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '1d' });
}

export async function register(email: string, password: string): Promise<string> {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('User already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser(email, passwordHash);

  return createToken({ userId: user.id, email: user.email });
}

export async function login(email: string, password: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  return createToken({ userId: user.id, email: user.email });
}
