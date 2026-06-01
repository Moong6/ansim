import { useReportStore } from '../store/reportStore'
import NoticeOptionSelector from './NoticeOptionSelector'
import { type Tone } from '../types'


const TONE_OPTIONS: { value: Tone; label: string; desc: string }[] = [
  { value: 'FRIENDLY',   label: '친근',     desc: '다정하고 친근한 어조' },
  { value: 'POLITE',     label: '정중',     desc: '정중하고 격식 있는 어조 (기본)' },
  { value: 'EMPATHETIC', label: '공감·위로', desc: '공감과 위로가 담긴 어조' },
]


export default function ReportR3Letter() {
  const preview         = useReportStore((s) => s.preview)
  const aiGeneratedText = useReportStore((s) => s.aiGeneratedText)
  const reportText      = useReportStore((s) => s.reportText)
  const generating      = useReportStore((s) => s.generating)
  const generateError   = useReportStore((s) => s.generateError)
  const tone            = useReportStore((s) => s.tone)
  const sending         = useReportStore((s) => s.sending)
  const sendError       = useReportStore((s) => s.sendError)

  const setReportText  = useReportStore((s) => s.setReportText)
  const setTone        = useReportStore((s) => s.setTone)
  const generateLetter = useReportStore((s) => s.generateLetter)
  const send           = useReportStore((s) => s.send)

  // 가드: preview 가 NONE 이거나 없으면 표시 안 함
  if (!preview || preview.dataLevel === 'NONE') return null

  const canSend = !!reportText.trim() && !generating && !sending
  const canRegenerate = !generating && !sending
  const charCount = reportText.length

  // ─── 생성 중 ───────────────────────────────────────────────────────────────
  if (generating) {
    return (
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-3">주간 종합 편지</h2>
        <div className="py-12 text-center text-sm text-gray-500">
          <div className="inline-flex items-center gap-2">
            <svg className="animate-spin w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
            </svg>
            🤖 한 주의 기록을 모아 편지를 작성 중입니다... (5~10초)
          </div>
        </div>
      </section>
    )
  }

  // ─── 생성 실패 ─────────────────────────────────────────────────────────────
  if (generateError && !aiGeneratedText) {
    return (
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-3">주간 종합 편지</h2>
        <div className="py-8 text-center">
          <p className="text-sm text-red-600 mb-3">{generateError}</p>
          <button
            type="button"
            onClick={() => generateLetter()}
            className="text-xs text-teal-700 hover:text-teal-800 underline"
          >
            다시 시도
          </button>
        </div>
      </section>
    )
  }

  // ─── 아직 생성 전 ──────────────────────────────────────────────────────────
  if (!aiGeneratedText) {
    return (
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 border-dashed p-6">
        <h2 className="text-base font-bold text-gray-800 mb-3">주간 종합 편지</h2>
        <p className="py-6 text-center text-sm text-gray-400">
          위에서 [리포트 생성] 을 누르면 한 주의 종합 편지가 여기에 표시됩니다.
        </p>
      </section>
    )
  }

  // ─── 본문 + 편집 + 톤 + 액션 ───────────────────────────────────────────────
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">주간 종합 편지</h2>
        <span className="text-xs text-gray-400">단일 편지 (3안 아님)</span>
      </div>

      {/* 편집 가능 본문 — 1차 NoticeOptionSelector 를 single 모드로 재사용 */}
      <NoticeOptionSelector
        mode="single"
        drafts={[]}                        /* single 모드에선 사용 안 함 */
        selectedIndex={0}
        editedText={reportText}
        onSelect={() => undefined}
        onEdit={setReportText}
        disabled={sending}
      />

      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>
          {reportText !== aiGeneratedText && (
            <span className="inline-flex items-center gap-1 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              직접 수정됨
            </span>
          )}
        </span>
        <span>{charCount}자</span>
      </div>

      {/* ─ 톤 ─ */}
      <div className="mt-5 pt-5 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-700 mb-2">어조</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {TONE_OPTIONS.map((opt) => {
            const selected = tone === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTone(opt.value)}
                disabled={generating || sending}
                className={`
                  text-left p-3 rounded-lg border-2 transition-colors
                  ${selected ? 'border-teal-500 bg-teal-50' : 'border-gray-100 bg-white hover:border-gray-200'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <p className={`text-sm font-bold ${selected ? 'text-teal-700' : 'text-gray-700'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          ※ 톤 변경 후 새 본문을 받으려면 [다시 생성] 을 눌러주세요.
        </p>
      </div>

      {/* ─ 재생성 실패 (본문은 보존된 상태) ─ */}
      {generateError && (
        <p role="alert" className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          재생성 실패: {generateError} — 기존 본문은 그대로 유지됩니다.
        </p>
      )}

      {/* ─ 전송 에러 ─ */}
      {sendError && (
        <p role="alert" className="mt-3 text-sm text-red-600">{sendError}</p>
      )}

      {/* ─ 액션 ─ */}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => generateLetter()}
          disabled={!canRegenerate}
          className="
            inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
            border border-teal-200 text-teal-700 bg-white
            hover:bg-teal-50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          🔄 다시 생성
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => send()}
          disabled={!canSend}
          className="
            px-6 py-2.5 rounded-lg font-semibold text-sm text-white
            bg-teal-600 hover:bg-teal-700 active:bg-teal-800
            disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2
            transition-colors
          "
        >
          {sending ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
              전송 중...
            </span>
          ) : '전송하기'}
        </button>
      </div>
    </section>
  )
}
