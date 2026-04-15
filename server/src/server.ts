import { app } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { ensureStudentsTable } from './models/userModel';

async function startServer(): Promise<void> {
  try {
    await connectDb();
    await ensureStudentsTable();

    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

void startServer();
