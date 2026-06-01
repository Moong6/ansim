import { create } from 'zustand'
import { type Lang, type User } from '../types'
import { setToken, getToken } from '../api/client'

// ─── localStorage 키 ──────────────────────────────────────────────────────────
const USER_KEY = 'care_user'

function saveUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
function clearUser(): void {
  localStorage.removeItem(USER_KEY)
}
function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

// ─── 초기 상태 복원 ───────────────────────────────────────────────────────────
// 새로고침 시 토큰+유저 정보가 localStorage에 있으면 로그인 상태 유지.
// (토큰 유효성은 첫 API 호출에서 401로 자연 감지)
const _initialUser = loadUser()
const _initialToken = getToken()          // client.ts가 localStorage에서 읽음
const _initialAuth = !!_initialUser && !!_initialToken

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null
  isAuthenticated: boolean

  /** 로그인 성공 시 token + user 저장 */
  login: (token: string, user: User) => void
  /** 로그아웃 — 모든 로컬 상태 제거 */
  logout: () => void
  /** 2차: 본인 preferredLang 갱신 (PATCH 성공 후 호출) */
  setPreferredLang: (lang: Lang) => void
}

// ─── 스토어 ───────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>(() => ({
  user: _initialUser,
  isAuthenticated: _initialAuth,

  login: (token, user) => {
    setToken(token)
    saveUser(user)
    useAuthStore.setState({ user, isAuthenticated: true })
  },

  logout: () => {
    setToken(null)
    clearUser()
    useAuthStore.setState({ user: null, isAuthenticated: false })
  },

  setPreferredLang: (lang) => {
    const cur = useAuthStore.getState().user
    if (!cur) return
    const next: User = { ...cur, preferredLang: lang }
    saveUser(next)
    useAuthStore.setState({ user: next })
  },
}))
