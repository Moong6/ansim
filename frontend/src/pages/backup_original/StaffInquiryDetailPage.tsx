/**
 * 직원 보호자문의 상세 /inquiries/:id
 * - 어르신 주의사항(precautions) 표시
 * - 확인 처리 버튼 (PATCH /inquiries/{id}/read) — 이미 READ면 비활성
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { getStaffInquiryDetail, markInquiryRead } from '../api/inquiries'
import { useToastStore } from '../store/toastStore'
import type { InquiryCategory, StaffInquiryDetail } from '../types'

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function StaffInquiryDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { show: showToast } = useToastStore()

  const [inquiry, setInquiry]     = useState<StaffInquiryDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [marking, setMarking]     = useState(false)

  useEffect(() => {
    if (!id) return
    getStaffInquiryDetail(Number(id))
      .then((res) => setInquiry(res.inquiry))
      .catch(() => showToast('문의를 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [id, showToast])

  async function handleMarkRead() {
    if (!inquiry || inquiry.status === 'READ' || marking) return
    setMarking(true)
    try {
      await markInquiryRead(inquiry.id)
      setInquiry((prev) => prev ? { ...prev, status: 'READ' } : prev)
      showToast('문의를 확인 처리했습니다', 'success')
    } catch {
      showToast('처리에 실패했습니다. 다시 시도해 주세요.', 'error')
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 뒤로 */}
        <button
          onClick={() => navigate('/inquiries')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700
            transition-colors mb-5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          보호자 문의 목록
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !inquiry ? (
          <div className="text-center py-20 text-gray-400 text-sm">내용을 불러올 수 없습니다</div>
        ) : (
          <div className="space-y-4">
            {/* 문의 카드 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              {/* 배지 + 상태 */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                  ${CATEGORY_COLOR[inquiry.category]}`}>
                  {CATEGORY_LABEL[inquiry.category]}
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full
                  ${inquiry.status === 'READ'
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-red-100 text-red-600'
                  }`}>
                  {inquiry.status === 'READ' ? '✓ 확인됨' : '미확인'}
                </span>
              </div>

              {/* 제목 */}
              {inquiry.title && (
                <h2 className="text-base font-bold text-gray-800 mb-2">{inquiry.title}</h2>
              )}

              {/* 보호자 · 날짜 */}
              <p className="text-xs text-gray-400 mb-4">
                {inquiry.guardian.name} · {formatDateTime(inquiry.createdAt)}
                {inquiry.guardian.phone && (
                  <span className="ml-1">· {inquiry.guardian.phone}</span>
                )}
              </p>

              {/* 본문 */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {inquiry.content}
                </p>
              </div>

              {/* 확인 처리 버튼 */}
              {inquiry.status === 'UNREAD' && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleMarkRead}
                    disabled={marking}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm text-white
                      bg-teal-600 hover:bg-teal-700 active:bg-teal-800
                      disabled:bg-teal-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {marking ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        처리 중...
                      </span>
                    ) : '✓ 확인 처리'}
                  </button>
                </div>
              )}
            </div>

            {/* 어르신 정보 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                어르신 정보
              </p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-lg">
                  👴
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{inquiry.resident.name}</p>
                  <p className="text-xs text-gray-500">
                    {[
                      inquiry.resident.roomNumber && `${inquiry.resident.roomNumber}호`,
                      inquiry.resident.careLevel   && `${inquiry.resident.careLevel}등급`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              {/* 주의사항 */}
              {inquiry.resident.precautions ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-600 mb-1.5">⚠ 주의사항</p>
                  <p className="text-xs text-amber-800 whitespace-pre-wrap leading-relaxed">
                    {inquiry.resident.precautions}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">등록된 주의사항이 없습니다</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
