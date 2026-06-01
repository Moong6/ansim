/**
 * 보호자 문의 상세 /parent/inquiries/:id
 * 8차: ANSWERED 상태 + 답변 표시 영역 추가
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ParentLayout from '../../components/ParentLayout'
import { getParentInquiryDetail } from '../../api/parent'
import { useToastStore } from '../../store/toastStore'
import type { InquiryCategory, ParentInquiryDetail } from '../../types'

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

const ROLE_LABEL: Record<string, string> = {
  CAREGIVER:     '요양보호사',
  SOCIAL_WORKER: '사회복지사',
  ADMIN:         '관리자',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function ParentInquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { show: showToast } = useToastStore()
  const [inquiry, setInquiry] = useState<ParentInquiryDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getParentInquiryDetail(Number(id))
      .then((res) => setInquiry(res.inquiry))
      .catch(() => showToast('문의 내용을 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [id, showToast])

  // 상태 배지
  function statusBadge(status: string) {
    if (status === 'UNREAD') return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-orange-100 text-orange-600">
        답변 대기
      </span>
    )
    if (status === 'READ') return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-100 text-teal-700">
        ✓ 확인됨
      </span>
    )
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        ✓ 답변 완료
      </span>
    )
  }

  return (
    <ParentLayout title="문의 상세" back="/parent/inquiries">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !inquiry ? (
        <div className="text-center py-20 text-gray-400 text-sm">내용을 불러올 수 없습니다</div>
      ) : (
        <div className="space-y-4">
          {/* 문의 카드 */}
          <div className="bg-white rounded-2xl border border-orange-100 p-5">
            {/* 상태 배지 */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                ${CATEGORY_COLOR[inquiry.category]}`}>
                {CATEGORY_LABEL[inquiry.category]}
              </span>
              {statusBadge(inquiry.status)}
            </div>

            {/* 제목 */}
            {inquiry.title && (
              <h2 className="text-base font-bold text-gray-800 mb-2">{inquiry.title}</h2>
            )}

            {/* 날짜 */}
            <p className="text-xs text-gray-400 mb-4">{formatDateTime(inquiry.createdAt)}</p>

            {/* 본문 */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {inquiry.content}
              </p>
            </div>

            {/* UNREAD 안내 */}
            {inquiry.status === 'UNREAD' && (
              <div className="mt-5 flex items-start gap-2 p-3 rounded-xl bg-orange-50">
                <span className="text-orange-400 mt-0.5">ℹ</span>
                <p className="text-xs text-orange-600 leading-relaxed">
                  담당 직원이 문의를 확인하면 상태가 업데이트됩니다.
                </p>
              </div>
            )}
          </div>

          {/* ANSWERED → 답변 표시 */}
          {inquiry.status === 'ANSWERED' && inquiry.answer && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              {/* 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600 text-base">💬</span>
                <p className="text-sm font-semibold text-green-800">답변</p>
              </div>

              {/* 답변 본문 */}
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {inquiry.answer.content}
              </p>

              {/* 작성자 카드 */}
              <div className="mt-4 pt-3 border-t border-green-200 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center
                  text-white text-xs font-semibold shrink-0">
                  {inquiry.answer.author.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">
                    {inquiry.answer.author.name}{' '}
                    {ROLE_LABEL[inquiry.answer.author.role] ?? inquiry.answer.author.role}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(inquiry.answer.createdAt)}</p>
                </div>
              </div>
            </div>
          )}

          {/* 추가 문의 안내 */}
          {inquiry.status === 'ANSWERED' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-gray-400 mt-0.5 shrink-0">ℹ</span>
              <p className="text-xs text-gray-500 leading-relaxed">
                추가 문의가 있으시면 새 문의를 작성해 주세요.
              </p>
            </div>
          )}
        </div>
      )}
    </ParentLayout>
  )
}
