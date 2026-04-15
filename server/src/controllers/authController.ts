import { Request, Response, NextFunction } from 'express';
import { login, register } from '../services/authService';

export async function registerController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const token = await register(email, password);
    res.status(201).json({ token });
  } catch (error) {
    next(error);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const token = await login(email, password);
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
}
