/**
 * 보호자 주간 리포트 상세 /parent/reports/:id
 * - 최초 조회 시 서버에서 read_at 자동 갱신 (백엔드 처리)
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ParentLayout from '../../components/ParentLayout'
import { getParentReportDetail } from '../../api/parent'
import { useToastStore } from '../../store/toastStore'
import type { ParentReportDetail } from '../../types'

function formatDateTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const moodEmojiMap: Record<string, string> = {
  GOOD: '😊 좋음',
  NORMAL: '🙂 보통',
  ANXIOUS: '😔 다소 불편',
}

const mealEmojiMap: Record<string, string> = {
  FULL: '🍚 완식',
  NORMAL: '🥄 보통',
  LITTLE: '🌱 조금',
  REFUSED: '— 거의 못 드심',
}

export default function ParentReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { show: showToast } = useToastStore()
  const [report, setReport]   = useState<ParentReportDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getParentReportDetail(Number(id))
      .then((res) => setReport(res.report))
      .catch(() => showToast('리포트를 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [id, showToast])

  return (
    <ParentLayout title="주간 리포트" back="/parent/reports">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !report ? (
        <div className="text-center py-20 text-gray-400 text-sm">내용을 불러올 수 없습니다</div>
      ) : (
        <div className="bg-white rounded-2xl border border-orange-100 p-5">
          {/* 헤더 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">
              📊
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{report.residentName} 어르신 주간리포트</p>
              {report.sentAt && (
                <p className="text-xs text-gray-400">{formatDateTime(report.sentAt)}</p>
              )}
            </div>
          </div>

          {/* 한 줄 요약 */}
          {report.weekStats && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 mb-4 text-xs text-blue-800 leading-relaxed font-medium">
              이번 주는 대부분{' '}
              <span className="font-bold text-blue-900">
                {moodEmojiMap[report.weekStats.topMood] || '보통'}
              </span>
              {' / '}
              <span className="font-bold text-blue-900">
                {mealEmojiMap[report.weekStats.topMeal] || '보통'}
              </span>
              {' 하셨어요  ·  기록된 날 '}
              <span className="font-bold text-blue-900">{report.weekStats.recordedDays}</span> / 7일
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            {report.finalText ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {report.finalText}
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
