import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login as apiLogin } from '../api/auth'
import { ApiException } from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const storeLogin = useAuthStore((s) => s.login)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }

    setLoading(true)
    try {
      const { token, user } = await apiLogin(email.trim(), password)
      storeLogin(token, user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err instanceof ApiException && err.status === 401) {
        setError('이메일 또는 비밀번호가 일치하지 않습니다.')
      } else {
        setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* ── 카드 ── */}
        <div className="bg-white rounded-2xl shadow-lg px-8 py-10">

          {/* 서비스 헤더 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 mb-4">
              {/* 하트+사람 아이콘 (SVG) */}
              <svg className="w-8 h-8 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 21C12 21 3 15.5 3 9.5a5.5 5.5 0 0 1 9-4.2A5.5 5.5 0 0 1 21 9.5C21 15.5 12 21 12 21z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">케어알림장</h1>
            <p className="mt-1 text-sm text-gray-500">AI 기반 돌봄 소통 서비스</p>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@happy.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="
                  w-full px-4 py-2.5 rounded-lg border border-gray-300
                  text-gray-900 placeholder-gray-400 text-sm
                  focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                  disabled:bg-gray-50 disabled:text-gray-400
                  transition
                "
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="
                    w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300
                    text-gray-900 placeholder-gray-400 text-sm
                    focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                    disabled:bg-gray-50 disabled:text-gray-400
                    transition
                  "
                />
                {/* 비밀번호 표시/숨기기 */}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showPw ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 2 12c0 1.657.667 3.156 1.755 4.245M9.879 9.879a3 3 0 1 0 4.243 4.243M9.88 9.88 4.22 4.22m0 0L2 2m2.22 2.22 16.56 16.56M15 12a3 3 0 0 1-3 3m6.364-5.364A10.48 10.48 0 0 1 22 12c-2.19 4.19-6.35 7-10 7a9.95 9.95 0 0 1-4.636-1.133" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2 12s3.636-7 10-7 10 7 10 7-3.636 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-red-600">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1z"
                    clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-3 rounded-lg font-semibold text-sm text-white
                bg-teal-600 hover:bg-teal-700 active:bg-teal-800
                disabled:bg-teal-300 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2
                transition-colors
              "
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                  </svg>
                  로그인 중...
                </span>
              ) : '로그인'}
            </button>
          </form>

          {/* 개발용 힌트 */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              테스트 계정: <span className="font-mono">minji@happy.kr</span> / <span className="font-mono">test1234</span>
            </p>
          </div>

          {/* 전환 링크 */}
          <div className="mt-6 pt-5 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              보호자이신가요?{' '}
              <Link to="/login-parent" className="text-teal-600 hover:underline font-medium" aria-label="가족 로그인 페이지로 이동">
                가족 로그인 →
              </Link>
            </p>
          </div>
        </div>

        {/* 카드 하단 레이블 */}
        <p className="mt-6 text-center text-xs text-gray-400">
          © 2026 케어알림장 — AI 기반 돌봄 소통 서비스
        </p>
      </div>
    </div>
  )
}
