import { Request, Response, NextFunction } from 'express';
import { login, register, issueDemoTeacherToken } from '../services/authService';
import { getBranches, getYears } from '../models/userModel';

export async function registerController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      name,
      roll_no: rollNo,
      password,
      branch_id: branchId,
      year_id: yearId
    } = req.body as {
      name?: string;
      roll_no?: string;
      password?: string;
      branch_id?: string;
      year_id?: string;
    };

    if (!name || !rollNo || !password || !branchId || !yearId) {
      res.status(400).json({
        success: false,
        message: 'name, roll_no, password, branch_id, and year_id are required'
      });
      return;
    }

    const result = await register(name, rollNo, password, branchId, yearId);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roll_no: rollNo, password } = req.body as { roll_no?: string; password?: string };

    if (!rollNo || !password) {
      res.status(400).json({ success: false, message: 'roll_no and password are required' });
      return;
    }

    const result = await login(rollNo, password);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getBranchesController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const branches = await getBranches();
    res.status(200).json({ success: true, branches });
  } catch (error) {
    next(error);
  }
}

export async function getYearsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const years = await getYears();
    res.status(200).json({ success: true, years });
  } catch (error) {
    next(error);
  }
}

export async function issueDemoTeacherTokenController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await issueDemoTeacherToken();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}
