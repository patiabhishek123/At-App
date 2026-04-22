const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export type ApiError = {
  success?: boolean
  message?: string
}

async function parseResponse<T>(response: Response): Promise<T> {
  let data: unknown = null

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    const err = data as ApiError
    throw new Error(err?.message ?? `Request failed with status ${response.status}`)
  }

  return data as T
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined
  })

  return parseResponse<T>(response)
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  })

  return parseResponse<T>(response)
}

export async function apiGetCsv(path: string, token: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const payload = (await response.json()) as ApiError
      message = payload.message ?? message
    } catch {
      // ignore parse failures
    }

    throw new Error(message)
  }

  return response.text()
}

export { API_BASE_URL }
