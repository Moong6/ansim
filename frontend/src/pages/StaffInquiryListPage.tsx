/**
 * 직원 보호자문의 목록 /inquiries
 * - 카테고리 · 상태 필터
 * - 미읽음 수 + byCategory 요약
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { getStaffInquiries } from '../api/inquiries'
import { useToastStore } from '../store/toastStore'
import type { InquiryCategory, InquiryStatus, StaffInquiryItem, StaffInquirySummary } from '../types'

const CATEGORY_OPTIONS: { value: InquiryCategory | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'HEALTH',        label: '건강' },
  { value: 'ADMIN_AFFAIRS', label: '행정' },
  { value: 'VISIT',         label: '방문' },
  { value: 'MEAL',          label: '식사' },
  { value: 'OTHER',         label: '기타' },
]

const STATUS_OPTIONS: { value: InquiryStatus | ''; label: string }[] = [
  { value: '',         label: '전체' },
  { value: 'READ',     label: '답변 대기만' },
  { value: 'ANSWERED', label: '답변 완료' },
]

const CATEGORY_LABEL: Record<InquiryCategory, string> = {
  HEALTH:        '건강',
  ADMIN_AFFAIRS: '행정',
  VISIT:         '방문',
  MEAL:          '식사',
  OTHER:         '기타',
}

const CATEGORY_COLOR: Record<InquiryCategory, string> = {
  HEALTH:        'bg-red-100 text-red-700',
  ADMIN_AFFAIRS: 'bg-blue-100 text-blue-700',
  VISIT:         'bg-purple-100 text-purple-700',
  MEAL:          'bg-green-100 text-green-700',
  OTHER:         'bg-gray-100 text-gray-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export default function StaffInquiryListPage() {
  const navigate = useNavigate()
  const { show: showToast } = useToastStore()

  const [categoryFilter, setCategoryFilter] = useState<InquiryCategory | ''>('')
  const [statusFilter, setStatusFilter]     = useState<InquiryStatus | ''>('')
  const [items, setItems]                   = useState<StaffInquiryItem[]>([])
  const [summary, setSummary]               = useState<StaffInquirySummary | null>(null)
  const [loading, setLoading]               = useState(true)

  function loadList(cat: InquiryCategory | '', st: InquiryStatus | '') {
    setLoading(true)
    getStaffInquiries({
      category: cat || undefined,
      status:   st  || undefined,
    })
      .then((res) => {
        setItems(res.items)
        setSummary(res.summary)
      })
      .catch(() => showToast('문의 목록을 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadList(categoryFilter, statusFilter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, statusFilter])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 제목 + 요약 배지 */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <h2 className="text-xl font-bold text-gray-800">보호자 문의</h2>
          {summary && summary.unread > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
              {summary.unread} 미확인
            </span>
          )}
          {summary && summary.needsAnswer > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-orange-400 text-white text-xs font-bold">
              {summary.needsAnswer} 답변 대기
            </span>
          )}
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-3 mb-5">
          {/* 카테고리 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCategoryFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${categoryFilter === opt.value
                    ? 'bg-teal-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {opt.label}
                {opt.value && summary && (
                  <span className="ml-1 opacity-70">
                    {summary.byCategory[opt.value as InquiryCategory] ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 상태 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${statusFilter === opt.value
                    ? 'bg-gray-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <span className="text-4xl mb-3">💬</span>
            <p className="text-sm">해당하는 문의가 없습니다</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => navigate(`/inquiries/${item.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-200
                    p-4 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                    transition-all duration-150"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 상단: 배지 + 미읽음 */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                          ${CATEGORY_COLOR[item.category]}`}>
                          {CATEGORY_LABEL[item.category]}
                        </span>
                        {item.status === 'UNREAD' && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="미확인" />
                        )}
                        {item.status === 'READ' && (
                          <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="답변 대기" />
                        )}
                      </div>

                      {/* 보호자 · 어르신 */}
                      <p className="text-xs text-gray-500 mb-1">
                        {item.guardianName} →{' '}
                        <span className="font-medium text-gray-700">{item.residentName}</span>
                        {item.residentRoomNumber && (
                          <span className="text-gray-400"> ({item.residentRoomNumber}호)</span>
                        )}
                      </p>

                      {/* 미리보기 */}
                      <p className="text-sm text-gray-700 line-clamp-2">{item.preview}</p>
                    </div>

                    {/* 날짜 */}
                    <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
