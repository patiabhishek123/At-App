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
            <h2>Student feed</h2>
            <p className="subtle">Live attendance announcements appear below.</p>
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
