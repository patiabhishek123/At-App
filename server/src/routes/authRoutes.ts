import { Router } from 'express';
import { loginController, registerController } from '../controllers/authController';

export const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginController);
