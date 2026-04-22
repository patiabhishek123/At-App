import { Router } from 'express';
import {
	loginController,
	registerController,
	getBranchesController,
	getYearsController,
	issueDemoTeacherTokenController
} from '../controllers/authController';

export const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginController);
authRouter.post('/teacher/demo-token', issueDemoTeacherTokenController);
authRouter.get('/branches', getBranchesController);
authRouter.get('/years', getYearsController);
