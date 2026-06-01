/**
 * 보호자 알림장 상세 /parent/notices/:id
 * - 최초 조회 시 서버에서 read_at 자동 갱신 (백엔드 처리)
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ParentLayout from '../../components/ParentLayout'
import { getParentNoticeDetail } from '../../api/parent'
import { useToastStore } from '../../store/toastStore'
import StatusDisplay from '../../components/StatusDisplay'
import type { ParentNoticeDetail } from '../../types'

function formatDateTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ParentNoticeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { show: showToast } = useToastStore()
  const [notice, setNotice]   = useState<ParentNoticeDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getParentNoticeDetail(Number(id))
      .then((res) => setNotice(res.notice))
      .catch(() => showToast('알림장을 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [id, showToast])

  return (
    <ParentLayout title="받은 알림장" back="/parent/notices">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !notice ? (
        <div className="text-center py-20 text-gray-400 text-sm">내용을 불러올 수 없습니다</div>
      ) : (
        <div className="bg-white rounded-2xl border border-orange-100 p-5">
          {/* 어르신 정보 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-lg">
              👴
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{notice.residentName} 어르신</p>
              {notice.sentAt && (
                <p className="text-xs text-gray-400">{formatDateTime(notice.sentAt)}</p>
              )}
            </div>
          </div>

          <StatusDisplay status={notice.structuredStatus} />

          <div className="border-t border-gray-100 pt-4">
            {notice.finalText ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {notice.finalText}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">내용이 없습니다</p>
            )}
          </div>
        </div>
      )}
    </ParentLayout>
  )
}
