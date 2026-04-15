import { pool } from '../config/db';
import { randomUUID } from 'crypto';

export interface User {
  id: string;
  email: string;
  password_hash: string;
}

export async function ensureUsersTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query<User>(
    'SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  return result.rows[0] ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const id = randomUUID();

  const result = await pool.query<User>(
    `
      INSERT INTO users (id, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, email, password_hash
    `,
    [id, email, passwordHash]
  );

  return result.rows[0];
}
