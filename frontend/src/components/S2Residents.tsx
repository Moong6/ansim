import { useDashboardStore } from '../store/dashboardStore'
import { useNoticeStore } from '../store/noticeStore'
import { useAuthStore } from '../store/authStore'
import { clearDraft } from '../utils/draftStorage'
import ResidentCard from './ResidentCard'

export default function S2Residents() {
  const residents          = useDashboardStore((s) => s.residents)
  const summary            = useDashboardStore((s) => s.summary)
  const loading            = useDashboardStore((s) => s.residentsLoading)
  const error              = useDashboardStore((s) => s.residentsError)
  const selectedResidentId = useDashboardStore((s) => s.selectedResidentId)
  const programs           = useDashboardStore((s) => s.programs)
  const selectResident     = useDashboardStore((s) => s.selectResident)

  const enterEditingMode = useNoticeStore((s) => s.enterEditingMode)
  const enterReadingMode = useNoticeStore((s) => s.enterReadingMode)
  const noticeReset      = useNoticeStore((s) => s.reset)
  const loadResidents    = useDashboardStore((s) => s.loadResidents)

  const userId = useAuthStore((s) => s.user?.id)

  const pct =
    summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0

  // ─── 카드 클릭 오케스트레이션 ─────────────────────────────────────────────
  function handleCardClick(residentId: number) {
    // ① 같은 카드 다시 클릭 → 해제
    if (selectedResidentId === residentId) {
      // 방어 1: 해제도 일종의 이동 → dirty 검사
      if (useNoticeStore.getState().hasUnsavedWork()) {
        if (!confirm('작성 중인 내용이 초기화됩니다. 이동하시겠습니까?')) return
        if (userId) clearDraft(userId, residentId)
      }
      noticeReset()
      selectResident(null)
      return
    }

    // ② 다른 카드 클릭 → 방어 1 (Context Switching)
    if (useNoticeStore.getState().hasUnsavedWork()) {
      if (!confirm('작성 중인 내용이 초기화됩니다. 이동하시겠습니까?')) return
      // 사용자가 이동 확정 → 이전 어르신의 LS 초안 삭제
      if (userId && selectedResidentId !== null) {
        clearDraft(userId, selectedResidentId)
      }
    }

    const target = residents.find((r) => r.id === residentId)
    if (!target) return

    selectResident(residentId)

    if (target.todayStatus === 'SENT' && target.todayNoticeId !== null) {
      // ✅ 카드 → 읽기 전용 모드
      enterReadingMode(target.todayNoticeId)
    } else {
      // ⚪ 카드 → 작성 모드 (LS 복원 또는 빈 상태)
      enterEditingMode(residentId, programs.map((p) => p.id))
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* ── 섹션 헤더 + 진행률 ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">담당 어르신</h2>
        {!loading && !error && (
          <span className="text-sm text-gray-600">
            <span className="font-bold text-teal-700">{summary.completed}</span>
            <span className="text-gray-400"> / {summary.total}</span>
            <span className="text-xs text-gray-400 ml-1">작성완료</span>
          </span>
        )}
      </div>

      {!loading && !error && summary.total > 0 && (
        <div className="mb-5">
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-right text-gray-400">{pct}%</p>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-gray-400">
          담당 어르신을 불러오는 중...
        </div>
      )}
      {!loading && error && (
        <div className="py-12 text-center">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <button
            type="button"
            onClick={() => loadResidents()}
            className="text-xs text-teal-700 hover:text-teal-800 underline"
          >
            다시 시도
          </button>
        </div>
      )}
      {!loading && !error && residents.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">
          담당하고 있는 어르신이 없습니다.
        </div>
      )}

      {!loading && !error && residents.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {residents.map((r) => (
            <ResidentCard
              key={r.id}
              resident={r}
              selected={selectedResidentId === r.id}
              onClick={() => handleCardClick(r.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
