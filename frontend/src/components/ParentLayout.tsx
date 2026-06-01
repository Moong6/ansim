/**
 * 보호자 채널 공통 레이아웃
 * - 따뜻한 오렌지 배경 (#FBF7F2)
 * - 상단 바: 뒤로가기 버튼 + 타이틀 + 선택적 우측 슬롯
 */
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ParentLayoutProps {
  title: string
  /** 뒤로가기 경로. 생략 시 -1 (browser back) */
  back?: string
  /** 우측 버튼 슬롯 */
  rightSlot?: React.ReactNode
  children: React.ReactNode
}

export default function ParentLayout({ title, back, rightSlot, children }: ParentLayoutProps) {
  const navigate = useNavigate()
  const logout   = useAuthStore((s) => s.logout)

  function handleBack() {
    if (back) navigate(back)
    else navigate(-1)
  }

  return (
    <div className="min-h-screen" style={{ background: '#FBF7F2' }}>
      {/* 상단 바 */}
      <header className="sticky top-0 z-10 bg-white border-b border-orange-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="뒤로가기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="flex-1 text-base font-bold text-gray-800 truncate">{title}</h1>

          {rightSlot ?? (
            <button
              onClick={() => { logout(); navigate('/login-parent', { replace: true }) }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
            >
              로그아웃
            </button>
          )}
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
