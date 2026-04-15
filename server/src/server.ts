import { createServer } from 'http';
import { app } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { ensureSessionTables } from './models/sessionModel';
import { ensureStudentsTable } from './models/userModel';
import { initializeWebSocketServer } from './ws/socketServer';

async function startServer(): Promise<void> {
  try {
    await connectDb();
    await ensureStudentsTable();
    await ensureSessionTables();

    const httpServer = createServer(app);
    initializeWebSocketServer(httpServer);

    httpServer.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

void startServer();
