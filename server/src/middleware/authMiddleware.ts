import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from './roleMiddleware';

type TokenPayload = {
  studentId?: string;
  userId?: string;
  rollNo?: string;
  role?: UserRole;
};

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;

    const id = payload.studentId ?? payload.userId;
    if (!id) {
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }

    req.user = {
      id,
      rollNo: payload.rollNo,
      role: payload.role ?? 'student'
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}
