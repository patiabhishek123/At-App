export type WsMessage = {
  timestamp: string
  payload: unknown
}

type WsClientOptions = {
  baseUrl: string
  token: string
  role: 'student' | 'teacher' | 'admin'
  onOpen: () => void
  onClose: () => void
  onMessage: (message: WsMessage) => void
}

export function createWsClient(options: WsClientOptions) {
  const socketUrl = new URL('/ws', options.baseUrl)
  socketUrl.searchParams.set('token', options.token)
  socketUrl.searchParams.set('role', options.role)

  const socket = new WebSocket(socketUrl.toString())

  socket.addEventListener('open', () => {
    options.onOpen()
  })

  socket.addEventListener('close', () => {
    options.onClose()
  })

  socket.addEventListener('error', () => {
    options.onClose()
  })

  socket.addEventListener('message', (event) => {
    let payload: unknown

    try {
      payload = JSON.parse(event.data as string)
    } catch {
      payload = { raw: String(event.data) }
    }

    options.onMessage({
      timestamp: new Date().toISOString(),
      payload
    })
  })

  return {
    disconnect(): void {
      socket.close()
    }
  }
}
