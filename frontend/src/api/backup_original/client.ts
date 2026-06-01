/**
 * API 클라이언트 레이어
 *
 * ★ 규칙: 컴포넌트·store에서 직접 fetch 금지.
 *         모든 HTTP 호출은 반드시 이 파일의 함수를 거친다.
 *
 * 흐름: 컴포넌트 → Zustand store → api/client.ts → FastAPI
 */

const BASE_URL = 'http://localhost:8000'

// ─── 토큰 관리 ────────────────────────────────────────────────────────────────
// store가 아닌 모듈-스코프 변수로 보관. setToken은 로그인 성공 시 호출.
let _token: string | null = localStorage.getItem('care_token')

export function setToken(token: string | null): void {
  _token = token
  if (token) {
    localStorage.setItem('care_token', token)
  } else {
    localStorage.removeItem('care_token')
  }
}

export function getToken(): string | null {
  return _token
}

// ─── 공통 에러 타입 ───────────────────────────────────────────────────────────
export interface ApiError {
  code: string
  message: string
}

export class ApiException extends Error {
  constructor(
    public status: number,
    public error: ApiError,
  ) {
    super(error.message)
    this.name = 'ApiException'
  }
}

// ─── 내부 fetch 래퍼 ─────────────────────────────────────────────────────────
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** 로그인 엔드포인트처럼 토큰 불필요한 경우 false */
  auth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (auth && _token) {
    headers['Authorization'] = `Bearer ${_token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content 등 본문 없는 응답 처리
  if (response.status === 204) {
    return undefined as unknown as T
  }

  const data = await response.json()

  if (!response.ok) {
    // 핸드오프 명세 봉투: { "error": { "code", "message" } }
    // FastAPI 기본 fallback:  { "detail": { "code", "message" } }
    const apiError: ApiError =
      data?.error ??
      data?.detail ??
      { code: 'INTERNAL_ERROR', message: `HTTP ${response.status}` }

    // ★ 인증 요청의 401 → 토큰 만료. 토큰 정리 + 앱에 알림.
    //   로그인 API 자체(auth=false)의 401은 비밀번호 오류이므로 발화하지 않음.
    if (response.status === 401 && auth) {
      setToken(null)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
    }

    throw new ApiException(response.status, apiError)
  }

  return data as T
}

// ─── 공개 헬퍼 (get / post) ───────────────────────────────────────────────────
export const api = {
  get: <T>(path: string, auth = true) =>
    request<T>(path, { method: 'GET', auth }),

  post: <T>(path: string, body: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),

  patch: <T>(path: string, body: unknown, auth = true) =>
    request<T>(path, { method: 'PATCH', body, auth }),

  delete: <T>(path: string, auth = true) =>
    request<T>(path, { method: 'DELETE', auth }),
}

// ─── 개발용 헬스체크 (서버 연결 확인) ────────────────────────────────────────
// main.tsx 기동 시 자동 호출. 콘솔에서 연결 상태 확인용.
// .catch 추가로 백엔드 미기동 시 unhandled rejection 경고 방지.
api.get<{ status: string }>('/api/health', false)
  .then((res) => console.log('[health]', res.status))
  .catch(() => console.warn('[health] 백엔드 응답 없음 — 서버를 켜주세요.'))
