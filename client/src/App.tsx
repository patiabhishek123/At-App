import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createWsClient } from './services/wsClient'
import type { WsMessage } from './services/wsClient'
import './App.css'

type Role = 'student' | 'teacher' | 'admin'

type UserSession = {
  token: string
  role: Role
  userId?: string
  rollNo?: string
}

type LoginResponse = {
  token: string
}

type AttendanceMarkResponse = {
  success: boolean
  message?: string
}

type SessionEventPayload = {
  type: 'new_session' | 'session.started'
  sessionId?: string
  sessionToken?: string
  session_token?: string
  validitySeconds?: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'
const WS_BASE_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:5000'

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64)
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function parseSessionEvent(payload: unknown): SessionEventPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Record<string, unknown>
  const type = candidate.type

  if (type !== 'new_session' && type !== 'session.started') {
    return null
  }

  return {
    type,
    sessionId: typeof candidate.sessionId === 'string' ? candidate.sessionId : undefined,
    sessionToken: typeof candidate.sessionToken === 'string' ? candidate.sessionToken : undefined,
    session_token: typeof candidate.session_token === 'string' ? candidate.session_token : undefined,
    validitySeconds: typeof candidate.validitySeconds === 'number' ? candidate.validitySeconds : undefined
  }
}

function App() {
  const [role, setRole] = useState<Role>('student')
  const [rollNo, setRollNo] = useState('')
  const [password, setPassword] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<UserSession | null>(null)

  const [socketState, setSocketState] = useState<'connecting' | 'open' | 'closed'>('closed')
  const [messages, setMessages] = useState<WsMessage[]>([])
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [markingAttendance, setMarkingAttendance] = useState(false)
  const [attendanceMessage, setAttendanceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const dashboardTitle = useMemo(() => {
    if (!session) {
      return ''
    }

    if (session.role === 'student') {
      return 'Student Dashboard'
    }

    if (session.role === 'teacher') {
      return 'Teacher Dashboard'
    }

    return 'Admin Dashboard'
  }, [session])

  useEffect(() => {
    if (!session) {
      setSocketState('closed')
      setMessages([])
      setActiveSessionId(null)
      setActiveSessionToken(null)
      return
    }

    setSocketState('connecting')

    const wsClient = createWsClient({
      baseUrl: WS_BASE_URL,
      token: session.token,
      role: session.role,
      onOpen: () => setSocketState('open'),
      onClose: () => setSocketState('closed'),
      onMessage: (message) => {
        setMessages((current) => [message, ...current].slice(0, 25))

        const event = parseSessionEvent(message.payload)
        if (!event) {
          return
        }

        const token = event.sessionToken ?? event.session_token
        if (token) {
          setActiveSessionToken(token)
          setAttendanceMessage(null)
        }

        setActiveSessionId(event.sessionId ?? null)

        const timeoutSeconds = event.validitySeconds ?? 30
        window.setTimeout(() => {
          setActiveSessionToken((current) => (current === token ? null : current))
          setActiveSessionId((current) => (current === (event.sessionId ?? null) ? null : current))
        }, timeoutSeconds * 1000)
      }
    })

    return () => {
      wsClient.disconnect()
    }
  }, [session])

  async function handleCredentialLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roll_no: rollNo,
          password
        })
      })

      const data = (await response.json()) as LoginResponse | { message?: string }

      if (!response.ok || !('token' in data)) {
        const message = 'message' in data && data.message ? data.message : 'Login failed'
        throw new Error(message)
      }

      const payload = decodeJwtPayload(data.token)
      const userRole = (payload?.role as Role | undefined) ?? role

      setSession({
        token: data.token,
        role: userRole,
        userId: (payload?.studentId as string | undefined) ?? (payload?.userId as string | undefined),
        rollNo: (payload?.rollNo as string | undefined) ?? rollNo
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function handleTokenLogin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError('')

    if (!tokenInput.trim()) {
      setError('Token is required')
      return
    }

    const payload = decodeJwtPayload(tokenInput.trim())
    const userRole = (payload?.role as Role | undefined) ?? role

    setSession({
      token: tokenInput.trim(),
      role: userRole,
      userId: (payload?.studentId as string | undefined) ?? (payload?.userId as string | undefined),
      rollNo: payload?.rollNo as string | undefined
    })
  }

  function logout(): void {
    setSession(null)
    setTokenInput('')
    setPassword('')
    setActiveSessionId(null)
    setActiveSessionToken(null)
    setAttendanceMessage(null)
  }

  async function handleMarkAttendance(): Promise<void> {
    if (!activeSessionToken || !session) {
      return
    }

    setMarkingAttendance(true)
    setAttendanceMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/attendance/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          session_token: activeSessionToken
        })
      })

      const data = (await response.json()) as AttendanceMarkResponse

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? 'Failed to mark attendance')
      }

      setAttendanceMessage({
        type: 'success',
        text: data.message ?? 'Attendance marked successfully'
      })
    } catch (err) {
      setAttendanceMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to mark attendance'
      })
    } finally {
      setMarkingAttendance(false)
    }
  }

  if (!session) {
    return (
      <main className="shell">
        <section className="panel login-panel">
          <h1>Attendance Terminal</h1>
          <p className="subtle">Authenticate to continue</p>

          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <form className="form" onSubmit={handleCredentialLogin}>
            <h2>Login with credentials</h2>
            <label className="field">
              <span>Roll No</span>
              <input
                type="text"
                value={rollNo}
                onChange={(event) => setRollNo(event.target.value)}
                placeholder="e.g. 22CSE001"
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <form className="form" onSubmit={handleTokenLogin}>
            <h2>Or login with JWT</h2>
            <label className="field">
              <span>Token</span>
              <textarea
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                rows={4}
                placeholder="Paste JWT token"
              />
            </label>
            <button type="submit">Use token</button>
          </form>

          {error && <p className="error">ERROR: {error}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <section className="panel dashboard-panel">
        <header className="topbar">
          <div>
            <h1>{dashboardTitle}</h1>
            <p className="subtle">
              user: {session.userId ?? 'unknown'} | role: {session.role}
              {session.rollNo ? ` | roll_no: ${session.rollNo}` : ''}
            </p>
          </div>
          <button onClick={logout}>Logout</button>
        </header>

        <section className="status-row">
          <div className="status-box">
            <span>Socket</span>
            <strong>{socketState}</strong>
          </div>
          <div className="status-box">
            <span>Updates</span>
            <strong>{messages.length}</strong>
          </div>
        </section>

        {session.role === 'student' && (
          <section className="card">
            <h2>Student dashboard</h2>
            {activeSessionToken ? (
              <div className="session-banner">
                <p>
                  Active session {activeSessionId ? `(${activeSessionId})` : ''}
                </p>
                <button className="mark-present-btn" onClick={handleMarkAttendance} disabled={markingAttendance}>
                  {markingAttendance ? 'Marking...' : 'Mark Present'}
                </button>
              </div>
            ) : (
              <p className="waiting">Waiting for session</p>
            )}

            {attendanceMessage && (
              <p className={attendanceMessage.type === 'success' ? 'success' : 'error'}>{attendanceMessage.text}</p>
            )}
          </section>
        )}

        {session.role === 'teacher' && (
          <section className="card">
            <h2>Teacher feed</h2>
            <p className="subtle">Monitor live acknowledgements and session status.</p>
          </section>
        )}

        <section className="card">
          <h2>Realtime updates</h2>
          <ul className="feed">
            {messages.length === 0 && <li className="subtle">No messages yet.</li>}
            {messages.map((message, index) => (
              <li key={`${message.timestamp}-${index}`}>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                <code>{JSON.stringify(message.payload)}</code>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  )
}

export default App
