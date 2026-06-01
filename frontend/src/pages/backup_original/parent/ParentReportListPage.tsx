/**
 * 보호자 주간 리포트 목록 /parent/reports
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ParentLayout from '../../components/ParentLayout'
import { getParentReports } from '../../api/parent'
import { useToastStore } from '../../store/toastStore'
import type { ParentReportItem } from '../../types'

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export default function ParentReportListPage() {
  const navigate = useNavigate()
  const { show: showToast } = useToastStore()
  const [items, setItems]     = useState<ParentReportItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentReports()
      .then((res) => setItems(res.items))
      .catch(() => showToast('리포트를 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  return (
    <ParentLayout title="주간 리포트" back="/parent/home">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <span className="text-4xl mb-3">📊</span>
          <p className="text-sm">받은 리포트가 없습니다</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const isUnread = !item.readAt

            return (
              <li key={item.id}>
                <button
                  onClick={() => navigate(`/parent/reports/${item.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-orange-100
                    p-4 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                    transition-all duration-150"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    )}
                    <p className="text-sm font-semibold text-gray-800">
                      {item.residentName} 어르신 주간리포트
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.preview}</p>
                  <p className="text-xs text-blue-400">{formatDate(item.sentAt)}</p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ParentLayout>
  )
}
