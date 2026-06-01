/**
 * 보호자 홈 /parent/home
 * - GET /api/parent/me 단일 호출
 * - 6개 카드: 공지사항 / 받은 알림장 / 주간 리포트 / 문의하기 / 식단표 / 일정표 (6차 추가)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getParentMe } from '../../api/parent'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../store/toastStore'
import type { ParentMeResponse } from '../../types'

interface NavCard {
  label: string
  icon: string
  color: string        // bg class for icon box
  borderColor: string
  path: string
  badge?: (s: ParentMeResponse['summary']) => number
  subText?: (s: ParentMeResponse['summary']) => string
}

const CARDS: NavCard[] = [
  {
    label: '공지사항',
    icon: '📌',
    color: 'bg-amber-100',
    borderColor: 'border-amber-200',
    path: '/parent/board',
    badge: (s) => s.unreadBoardCount,
  },
  {
    label: '받은 알림장',
    icon: '📋',
    color: 'bg-orange-100',
    borderColor: 'border-orange-200',
    path: '/parent/notices',
    badge: (s) => s.unreadNoticeCount,
  },
  {
    label: '주간 리포트',
    icon: '📊',
    color: 'bg-blue-100',
    borderColor: 'border-blue-200',
    path: '/parent/reports',
    badge: (s) => s.newReportCount,
  },
  {
    label: '문의하기',
    icon: '💬',
    color: 'bg-teal-100',
    borderColor: 'border-teal-200',
    path: '/parent/inquiries',
    badge: (s) => s.pendingInquiryCount,
  },
  {
    label: '오늘 식단',
    icon: '🍱',
    color: 'bg-green-100',
    borderColor: 'border-green-200',
    path: '/parent/meals',
    subText: (s) => `오늘 ${s.meals.todayRegisteredCount}건 등록`,
  },
  {
    label: '일정표',
    icon: '📅',
    color: 'bg-purple-100',
    borderColor: 'border-purple-200',
    path: '/parent/schedule',
    subText: (s) => `이번 달 ${s.schedule.thisMonthCount}건`,
  },
]

export default function ParentHomePage() {
  const navigate  = useNavigate()
  const logout    = useAuthStore((s) => s.logout)
  const user      = useAuthStore((s) => s.user)
  const { show: showToast } = useToastStore()

  const [me, setMe]           = useState<ParentMeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentMe()
      .then(setMe)
      .catch(() => showToast('정보를 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const residentName = me?.residents[0]?.name ?? '어르신'

  return (
    <div className="min-h-screen" style={{ background: '#FBF7F2' }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-orange-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏠</span>
            <span className="font-bold text-gray-800 text-base">케어알림장</span>
          </div>
          <button
            onClick={() => { logout(); navigate('/login-parent', { replace: true }) }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* 환영 메시지 */}
        <div className="mb-6">
          <p className="text-sm text-gray-500">안녕하세요</p>
          <h2 className="text-xl font-bold text-gray-800">
            {user?.name ?? '보호자'}님
          </h2>
          {!loading && me && (
            <p className="mt-1 text-sm text-orange-600 font-medium">
              {residentName} 어르신의 소식을 확인하세요
            </p>
          )}
        </div>

        {/* 6개 카드 (2열) */}
        <div className="grid grid-cols-2 gap-4">
          {CARDS.map((card) => {
            const badgeCount = (!loading && me) ? (card.badge?.(me.summary) ?? 0) : 0
            const sub        = (!loading && me && card.subText) ? card.subText(me.summary) : null

            return (
              <button
                key={card.label}
                onClick={() => navigate(card.path)}
                className={`
                  relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 bg-white
                  ${card.borderColor}
                  hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                  transition-all duration-150 cursor-pointer
                `}
              >
                {/* 배지 (미읽음 수) */}
                {badgeCount > 0 && (
                  <span className="absolute top-3 right-3 min-w-[18px] h-[18px] px-1 rounded-full
                    bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}

                {/* 아이콘 */}
                <div className={`w-14 h-14 rounded-xl ${card.color} flex items-center justify-center text-2xl`}>
                  {card.icon}
                </div>

                {/* 라벨 */}
                <span className="text-sm font-semibold text-gray-800">{card.label}</span>

                {/* 부가 텍스트 (식단·일정) */}
                {sub && (
                  <span className="text-xs text-gray-500">{sub}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 어르신 정보 요약 */}
        {!loading && me && me.residents.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-orange-100 p-4">
            <p className="text-xs font-semibold text-orange-500 mb-3 uppercase tracking-wide">
              담당 어르신
            </p>
            {me.residents.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-lg">
                  👴
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                  <p className="text-xs text-gray-500">
                    {[
                      r.roomNumber && `${r.roomNumber}호`,
                      r.careLevel && `${r.careLevel}등급`,
                      r.relationship && r.relationship,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
