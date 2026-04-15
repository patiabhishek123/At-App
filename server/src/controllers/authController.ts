import { Request, Response, NextFunction } from 'express';
import { login, register } from '../services/authService';

export async function registerController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, roll_no: rollNo, password } = req.body as {
      name?: string;
      roll_no?: string;
      password?: string;
    };

    if (!name || !rollNo || !password) {
      res.status(400).json({ message: 'Name, roll_no and password are required' });
      return;
    }

    const token = await register(name, rollNo, password);
    res.status(201).json({ token });
  } catch (error) {
    next(error);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roll_no: rollNo, password } = req.body as { roll_no?: string; password?: string };

    if (!rollNo || !password) {
      res.status(400).json({ message: 'roll_no and password are required' });
      return;
    }

    const token = await login(rollNo, password);
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
}
