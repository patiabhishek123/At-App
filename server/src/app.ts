import express from 'express';
import { router } from './routes';
import { errorMiddleware } from './middleware/errorMiddleware';

export const app = express();

app.use(express.json());
app.use('/api', router);
app.use(errorMiddleware);
