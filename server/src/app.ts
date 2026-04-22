import express from 'express';
import cors from 'cors';
import { router } from './routes';
import { errorMiddleware } from './middleware/errorMiddleware';

export const app = express();

app.use(
	cors({
		origin: true,
		credentials: false
	})
);
app.use(express.json());
app.use('/api', router);
app.use(errorMiddleware);
