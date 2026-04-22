import { createServer } from 'http';
import { app } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { ensureSessionTables } from './models/sessionModel';
import { ensureStudentsTable } from './models/userModel';
import { initializeWebSocketServer } from './ws/socketServer';
import type { Server } from 'http';

let httpServer: Server | null = null;

function shutdown(signal: string): void {
  if (!httpServer) {
    process.exit(0);
    return;
  }

  httpServer.close((error) => {
    if (error) {
      console.error(`Error while shutting down after ${signal}`, error);
      process.exit(1);
      return;
    }

    console.log(`Server stopped after ${signal}`);
    process.exit(0);
  });
}

async function startServer(): Promise<void> {
  try {
    await connectDb();
    await ensureStudentsTable();
    await ensureSessionTables();

    httpServer = createServer(app);
    initializeWebSocketServer(httpServer);

    httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${env.port} is already in use. Stop the previous server process, then restart.`);
        process.exit(1);
        return;
      }

      console.error('HTTP server failed', error);
      process.exit(1);
    });

    httpServer.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

void startServer();
