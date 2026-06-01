import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useToastStore } from '../store/toastStore'
import { fetchHomeSummary } from '../api/home'
import type { HomeSummary } from '../types'

// ─── 카드 정의 ────────────────────────────────────────────────────────────────

interface CardDef {
  key: string
  label: string
  icon: string
  color: string        // Tailwind bg class (icon box)
  borderColor: string  // Tailwind border class
  path: string | null  // null = 비활성
}

const CARDS: CardDef[] = [
  { key: 'alimjang',  label: '알림장',    icon: '📋', color: 'bg-orange-100', borderColor: 'border-orange-200', path: '/dashboard' },
  { key: 'report',    label: '주간리포트', icon: '📊', color: 'bg-blue-100',   borderColor: 'border-blue-200',   path: '/reports'   },
  { key: 'residents', label: '어르신',    icon: '👴', color: 'bg-teal-100',   borderColor: 'border-teal-200',   path: '/residents' },
  { key: 'board',     label: '공지사항',  icon: '📌', color: 'bg-amber-100',  borderColor: 'border-amber-200',  path: '/board'     },
  { key: 'album',     label: '앨범',      icon: '📷', color: 'bg-pink-100',   borderColor: 'border-pink-200',   path: null },
  { key: 'schedule',  label: '일정표',    icon: '📅', color: 'bg-purple-100', borderColor: 'border-purple-200', path: '/schedule'  },
  { key: 'menu',      label: '식단표',    icon: '🍱', color: 'bg-green-100',  borderColor: 'border-green-200',  path: '/meals'     },
  { key: 'inquiry',   label: '보호자문의', icon: '💬', color: 'bg-teal-100',  borderColor: 'border-teal-200',   path: '/inquiries' },
]

function statusText(key: string, summary: HomeSummary): string {
  switch (key) {
    case 'alimjang':
      return `오늘 ${summary.alimjang.todayCompleted} / ${summary.alimjang.todayTotal} 작성`
    case 'report':
      return summary.report.lastWeekAvailable ? '지난주 발송 가능' : '지난주 기록 부족'
    case 'residents':
      return `담당 ${summary.residents.assignedCount}명`
    case 'board':
      return summary.board.unreadCount > 0
        ? `새 공지 ${summary.board.unreadCount}건`
        : '공지 없음'
    case 'inquiry':
      return summary.inquiry.unreadCount > 0
        ? `미확인 ${summary.inquiry.unreadCount}건`
        : '새 문의 없음'
    case 'menu':
      return `오늘 ${summary.meals.todayRegisteredCount} / ${summary.meals.todayTotal} 등록`
    case 'schedule':
      return `이번 달 ${summary.schedule.thisMonthCount}건`
    default:
      return '준비 중'
  }
}

function hasDot(key: string, summary: HomeSummary): boolean {
  if (key === 'alimjang')
    return summary.alimjang.todayCompleted < summary.alimjang.todayTotal
  if (key === 'board')
    return summary.board.unreadCount > 0
  if (key === 'inquiry')
    return summary.inquiry.unreadCount > 0
  if (key === 'menu')
    return summary.meals.todayRegisteredCount < summary.meals.todayTotal
  return false
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { show: showToast } = useToastStore()
  const [summary, setSummary] = useState<HomeSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHomeSummary()
      .then(setSummary)
      .catch(() => showToast('홈 정보를 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  function handleCard(card: CardDef) {
    if (card.path) {
      navigate(card.path)
    } else {
      showToast('준비 중입니다')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">메뉴</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {CARDS.map((card) => {
            const active = card.path !== null
            const isLoading = loading && active

            return (
              <button
                key={card.key}
                onClick={() => handleCard(card)}
                className={`
                  relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 text-left
                  transition-all duration-150
                  ${active
                    ? `${card.borderColor} bg-white hover:shadow-md hover:-translate-y-0.5 cursor-pointer`
                    : 'border-gray-100 bg-white/60 cursor-pointer opacity-60'
                  }
                `}
              >
                {/* 빨간 점 (미완료 알림) */}
                {active && !loading && summary && hasDot(card.key, summary) && (
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500" />
                )}

                {/* 아이콘 박스 */}
                <div className={`w-14 h-14 rounded-xl ${active ? card.color : 'bg-gray-100'} flex items-center justify-center text-2xl`}>
                  {card.icon}
                </div>

                {/* 라벨 */}
                <span className={`text-sm font-semibold ${active ? 'text-gray-800' : 'text-gray-400'}`}>
                  {card.label}
                </span>

                {/* 상태 텍스트 */}
                <span className="text-xs text-gray-500 text-center leading-tight">
                  {active && !isLoading && summary
                    ? statusText(card.key, summary)
                    : active && isLoading
                    ? '로딩 중...'
                    : '준비 중'}
                </span>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
