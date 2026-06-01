/**
 * 보호자 문의 목록 /parent/inquiries
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ParentLayout from '../../components/ParentLayout'
import { getParentInquiries } from '../../api/parent'
import { useToastStore } from '../../store/toastStore'
import type { InquiryCategory, ParentInquiryItem } from '../../types'

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

export default function ParentInquiryListPage() {
  const navigate = useNavigate()
  const { show: showToast } = useToastStore()
  const [items, setItems]     = useState<ParentInquiryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentInquiries()
      .then((res) => setItems(res.items))
      .catch(() => showToast('문의 목록을 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  return (
    <ParentLayout
      title="문의하기"
      back="/parent/home"
      rightSlot={
        <button
          onClick={() => navigate('/parent/inquiries/new')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-400 text-white
            text-xs font-semibold hover:bg-orange-500 transition-colors"
        >
          <span>+</span>
          <span>새 문의</span>
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <span className="text-4xl mb-3">💬</span>
          <p className="text-sm mb-4">아직 문의 내역이 없습니다</p>
          <button
            onClick={() => navigate('/parent/inquiries/new')}
            className="px-5 py-2.5 rounded-xl bg-orange-400 text-white text-sm font-semibold
              hover:bg-orange-500 transition-colors"
          >
            첫 문의 작성하기
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => navigate(`/parent/inquiries/${item.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-orange-100
                  p-4 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                  transition-all duration-150"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${CATEGORY_COLOR[item.category]}`}>
                    {CATEGORY_LABEL[item.category]}
                  </span>
                  {item.status === 'UNREAD' && (
                    <span className="text-xs text-orange-500 font-medium">답변 대기</span>
                  )}
                  {item.status === 'READ' && (
                    <span className="text-xs text-teal-600 font-medium">확인됨</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">{item.preview}</p>
                <p className="text-xs text-gray-400">{formatDate(item.createdAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ParentLayout>
  )
}
