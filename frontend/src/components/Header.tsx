import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function formatToday(): string {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KO[d.getDay()]})`
}

function roleLabel(role?: string): string {
  switch (role) {
    case 'CAREGIVER':     return '요양보호사'
    case 'SOCIAL_WORKER': return '사회복지사'
    case 'ADMIN':         return '관리자'
    default:              return ''
  }
}

export default function Header() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const logout   = useAuthStore((s) => s.logout)

  function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
      logout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

        {/* ── 좌측: 로고 + 서비스명 + 시설명 ── */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 21C12 21 3 15.5 3 9.5a5.5 5.5 0 0 1 9-4.2A5.5 5.5 0 0 1 21 9.5C21 15.5 12 21 12 21z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 leading-tight">케어알림장</h1>
            <p className="text-xs text-gray-500 truncate">{user?.facility.name ?? '—'}</p>
          </div>
        </div>

        {/* ── 중앙: 네비 + 날짜 ── */}
        <div className="hidden md:flex items-center gap-4">
          <NavLink
            to="/home"
            className={({ isActive }) =>
              `inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
               ${isActive
                 ? 'text-teal-800 bg-teal-100 border border-teal-300'
                 : 'text-teal-700 border border-teal-200 bg-teal-50 hover:bg-teal-100'}`
            }
          >
            🏠 홈
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
               ${isActive
                 ? 'text-coral-800 bg-orange-100 border border-orange-300'
                 : 'text-gray-600 border border-gray-200 bg-white hover:bg-gray-50'}`
            }
          >
            📋 알림장
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
               ${isActive
                 ? 'text-blue-800 bg-blue-100 border border-blue-300'
                 : 'text-gray-600 border border-gray-200 bg-white hover:bg-gray-50'}`
            }
          >
            📊 리포트
          </NavLink>
          <span className="text-sm font-medium text-gray-600">{formatToday()}</span>
        </div>

        {/* ── 우측: 사용자 + 로그아웃 ── */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name ?? '—'}</p>
            <p className="text-xs text-gray-500">{roleLabel(user?.role)}</p>
          </div>
          <button
            onClick={handleLogout}
            className="
              px-3 py-1.5 text-xs font-medium rounded-md
              text-gray-600 border border-gray-200
              hover:bg-gray-50 hover:text-gray-800
              transition-colors
            "
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  )
}
