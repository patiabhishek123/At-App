import { IncomingMessage } from 'http';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import { env } from '../config/env';
import { UserRole } from '../middleware/roleMiddleware';

type JwtPayload = {
  studentId?: string;
  userId?: string;
  role?: UserRole;
};

type WsUser = {
  userId: string;
  role: UserRole;
};

const connectedStudents = new Map<string, WebSocket>();
const connectedTeachers = new Map<string, Set<WebSocket>>();
const connectedAdmins = new Set<WebSocket>();
let websocketServer: WebSocketServer | null = null;

function parseToken(req: IncomingMessage): string | null {
  const rawUrl = req.url ?? '';
  const url = new URL(rawUrl, 'http://localhost');

  const tokenFromQuery = url.searchParams.get('token');
  if (tokenFromQuery) {
    return tokenFromQuery;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1] ?? null;
  }

  return null;
}

function authenticateSocket(req: IncomingMessage): WsUser | null {
  const token = parseToken(req);
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    const userId = payload.studentId ?? payload.userId;

    if (!userId) {
      return null;
    }

    return {
      userId,
      role: payload.role ?? 'student'
    };
  } catch {
    return null;
  }
}

function registerStudentSocket(studentId: string, socket: WebSocket): void {
  const existingSocket = connectedStudents.get(studentId);
  if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
    existingSocket.close(1000, 'Replaced by new connection');
  }

  connectedStudents.set(studentId, socket);
}

function removeStudentSocket(studentId: string, socket: WebSocket): void {
  const current = connectedStudents.get(studentId);
  if (current === socket) {
    connectedStudents.delete(studentId);
  }
}

function registerTeacherSocket(teacherId: string, socket: WebSocket): void {
  const sockets = connectedTeachers.get(teacherId) ?? new Set<WebSocket>();
  sockets.add(socket);
  connectedTeachers.set(teacherId, sockets);
}

function removeTeacherSocket(teacherId: string, socket: WebSocket): void {
  const sockets = connectedTeachers.get(teacherId);
  if (!sockets) {
    return;
  }

  sockets.delete(socket);
  if (sockets.size === 0) {
    connectedTeachers.delete(teacherId);
  }
}

export function initializeWebSocketServer(server: Server): void {
  if (websocketServer) {
    return;
  }

  websocketServer = new WebSocketServer({
    server,
    path: '/ws'
  });

  websocketServer.on('connection', (socket, req) => {
    const user = authenticateSocket(req);

    if (!user) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    if (user.role === 'student') {
      registerStudentSocket(user.userId, socket);
    }

    if (user.role === 'teacher') {
      registerTeacherSocket(user.userId, socket);
    }

    if (user.role === 'admin') {
      connectedAdmins.add(socket);
    }

    socket.send(
      JSON.stringify({
        type: 'ws.connected',
        role: user.role,
        userId: user.userId,
        connectedStudents: connectedStudents.size
      })
    );

    socket.on('close', () => {
      if (user.role === 'student') {
        removeStudentSocket(user.userId, socket);
      }

      if (user.role === 'teacher') {
        removeTeacherSocket(user.userId, socket);
      }

      if (user.role === 'admin') {
        connectedAdmins.delete(socket);
      }
    });
  });
}

export function broadcastSessionTokenToStudents(sessionToken: string, sessionId: string): void {
  const payload = JSON.stringify({
    type: 'session.started',
    sessionId,
    sessionToken
  });

  for (const [studentId, socket] of connectedStudents.entries()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      continue;
    }

    connectedStudents.delete(studentId);
  }
}

export function broadcastAttendanceUpdateToTeachers(event: {
  sessionId: string;
  attendanceCount: number;
  student: {
    id: string;
    name: string;
    roll_no: string;
  };
}): void {
  const payload = JSON.stringify({
    type: 'attendance.marked',
    sessionId: event.sessionId,
    attendanceCount: event.attendanceCount,
    student: event.student
  });

  for (const [teacherId, sockets] of connectedTeachers.entries()) {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
        continue;
      }

      sockets.delete(socket);
    }

    if (sockets.size === 0) {
      connectedTeachers.delete(teacherId);
    }
  }

  for (const socket of connectedAdmins) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      continue;
    }

    connectedAdmins.delete(socket);
  }
}
