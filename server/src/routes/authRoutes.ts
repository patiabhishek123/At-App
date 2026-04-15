import { Router } from 'express';
import { loginController, registerController, getBranchesController, getYearsController } from '../controllers/authController';

export const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginController);
authRouter.get('/branches', getBranchesController);
authRouter.get('/years', getYearsController);
