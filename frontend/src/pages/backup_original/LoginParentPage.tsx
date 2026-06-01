/**
 * 보호자 전용 로그인 페이지 /login-parent
 * - 공통 /api/auth/login 재사용, user.role === 'GUARDIAN' 검증
 * - 성공 시 /parent/home 이동
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login as apiLogin } from '../api/auth'
import { ApiException } from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function LoginParentPage() {
  const navigate    = useNavigate()
  const storeLogin  = useAuthStore((s) => s.login)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
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

      if (user.role !== 'GUARDIAN') {
        setError('직원 계정입니다. 직원 로그인을 이용해 주세요.')
        return
      }
      storeLogin(token, user)
      navigate('/parent/home', { replace: true })
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#FBF7F2' }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg px-8 py-10">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ backgroundColor: '#FDE8D8' }}>
              <span className="text-3xl">🏠</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">케어알림장</h1>
            <p className="mt-1 text-sm text-gray-500">가족 · 보호자 로그인</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email" autoComplete="email"
                placeholder="example@family.kr"
                value={email} onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm
                  focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent
                  disabled:bg-gray-50 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password" autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm
                  focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent
                  disabled:bg-gray-50 transition"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600 flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1z"
                    clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm text-white
                bg-orange-400 hover:bg-orange-500 active:bg-orange-600
                disabled:bg-orange-200 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 개발용 힌트 */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              테스트: <span className="font-mono">boram@family.kr</span> / <span className="font-mono">test1234</span>
            </p>
          </div>

          {/* 전환 링크 */}
          <div className="mt-6 pt-5 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              직원이신가요?{' '}
              <Link to="/login" className="text-orange-500 hover:underline font-medium" aria-label="직원 로그인 페이지로 이동">
                직원 로그인 →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
