import { useDashboardStore } from '../store/dashboardStore'
import { useNoticeStore } from '../store/noticeStore'

// ─── 라벨 매핑 ───────────────────────────────────────────────────────────────

const HEALTH = { GOOD: '좋음', NORMAL: '보통', NEEDS_OBSERVATION: '관찰필요' } as const
const MOOD   = { GOOD: '좋음', NORMAL: '보통', ANXIOUS: '우울/불안' } as const
const MEAL   = { FULL: '완식', NORMAL: '보통', LITTLE: '적게', REFUSED: '거부' } as const
const MED    = { DONE: '완료', NONE: '해당없음' } as const
const TONE   = { FRIENDLY: '친근', POLITE: '정중', EMPATHETIC: '공감·위로' } as const

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export default function ReadOnlyNotice() {
  const mode             = useNoticeStore((s) => s.mode)
  const readingNotice    = useNoticeStore((s) => s.readingNotice)
  const readingLoading   = useNoticeStore((s) => s.readingLoading)
  const readingError     = useNoticeStore((s) => s.readingError)
  const restoreForResend = useNoticeStore((s) => s.restoreForResend)
  const reset            = useNoticeStore((s) => s.reset)

  const selectedId   = useDashboardStore((s) => s.selectedResidentId)
  const residents    = useDashboardStore((s) => s.residents)
  const selectResident = useDashboardStore((s) => s.selectResident)

  if (mode !== 'reading') return null

  const selected = residents.find((r) => r.id === selectedId) ?? null

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-teal-700">
              {selected?.name.charAt(0) ?? '?'}
            </span>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              {selected?.name ?? '어르신'} 알림장
              {readingNotice && (
                <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium border border-teal-200">
                  v{readingNotice.version}
                  {readingNotice.isEdited && ' · 수정됨'}
                </span>
              )}
            </h2>
            {readingNotice && (
              <p className="text-xs text-gray-500">
                {fmtDate(readingNotice.sentAt)} 발송
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            reset()
            selectResident(null)
          }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          닫기
        </button>
      </div>

      {/* ── 로딩 / 에러 ── */}
      {readingLoading && (
        <p className="py-8 text-center text-sm text-gray-400">불러오는 중...</p>
      )}
      {!readingLoading && readingError && (
        <div className="py-8 text-center">
          <p className="text-sm text-red-500 mb-2">{readingError}</p>
          <button
            type="button"
            onClick={() => {
              reset()
              selectResident(null)
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* ── 본문 ── */}
      {!readingLoading && !readingError && readingNotice && (
        <div className="space-y-5">

          {/* ─ 상태 ─ */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">상태</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <Cell label="건강" value={HEALTH[readingNotice.structuredStatus.health]} />
              <Cell label="기분" value={MOOD[readingNotice.structuredStatus.mood]} />
              <Cell label="식사" value={MEAL[readingNotice.structuredStatus.meal]} />
              <Cell label="투약" value={MED[readingNotice.structuredStatus.medication]} />
            </div>
          </div>

          {/* ─ 참여 프로그램 ─ */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">참여 프로그램</p>
            {readingNotice.participatedPrograms.length === 0 ? (
              <p className="text-sm text-gray-400">참여 프로그램 없음</p>
            ) : (
              <ul className="space-y-1">
                {readingNotice.participatedPrograms.map((p) => (
                  <li key={p.program_id} className="text-sm text-gray-700">
                    <span className="text-xs font-bold text-teal-600 mr-2">{p.start_time ?? '시간 미정'}</span>
                    {p.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ─ 원본 메모 ─ */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">
              직원 메모 (원본)
              <span className="ml-2 text-gray-400 font-normal">톤: {TONE[readingNotice.tone]}</span>
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap p-3 rounded-lg bg-gray-50 border border-gray-100">
              {readingNotice.rawMemo || '(메모 없음)'}
            </p>
          </div>

          {/* ─ 발송 본문 ─ */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">
              발송 본문
              {readingNotice.isRefined && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-medium border border-teal-200">
                  다듬기 적용
                </span>
              )}
            </p>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap p-4 rounded-lg bg-teal-50/30 border border-teal-100">
              {readingNotice.finalText || '(본문 없음)'}
            </p>
          </div>

          {/* ─ 액션 ─ */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={restoreForResend}
              className="
                px-5 py-2.5 rounded-lg text-sm font-semibold text-white
                bg-teal-600 hover:bg-teal-700 active:bg-teal-800
                focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2
                transition-colors
              "
            >
              수정하여 재전송하기
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-700">{value}</p>
    </div>
  )
}
