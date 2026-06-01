import { useReportStore } from '../store/reportStore'


// ─── 한글 라벨 매핑 ──────────────────────────────────────────────────────────

const MEAL_LABEL: Record<string, string> = {
  FULL: '완식', NORMAL: '보통', LITTLE: '적게', REFUSED: '거부',
}
const MOOD_LABEL: Record<string, string> = {
  GOOD: '좋음', NORMAL: '보통', ANXIOUS: '우울/불안',
}
const HEALTH_LABEL: Record<string, string> = {
  GOOD: '좋음', NORMAL: '보통', NEEDS_OBSERVATION: '관찰필요',
}

const MEAL_ORDER   = ['FULL', 'NORMAL', 'LITTLE', 'REFUSED']
const MOOD_ORDER   = ['GOOD', 'NORMAL', 'ANXIOUS']
const HEALTH_ORDER = ['GOOD', 'NORMAL', 'NEEDS_OBSERVATION']


/** 분포 객체 → "완식 3일 · 보통 2일" 형식 문자열 (0인 항목은 생략) */
function formatDist(
  counts: Record<string, number>,
  order: string[],
  labels: Record<string, string>,
): string {
  const parts: string[] = []
  for (const key of order) {
    const v = counts[key] ?? 0
    if (v > 0) parts.push(`${labels[key]} ${v}일`)
  }
  return parts.length > 0 ? parts.join(' · ') : '기록 없음'
}


// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export default function ReportR2Stats() {
  const preview = useReportStore((s) => s.preview)

  if (!preview) return null
  if (preview.dataLevel === 'NONE') return null   // 상위에서 안내 박스 별도 처리

  const s = preview.statsSummary
  const isSparse = preview.dataLevel === 'SPARSE'

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">
          이번 주 기록 요약 ({preview.periodStart} ~ {preview.periodEnd})
        </h2>
        {isSparse && (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
            기록 일수 부족 ({preview.recordedDays}일)
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 기록 일수 */}
        <StatRow label="기록된 날" value={`${preview.recordedDays}일 / 7일`} />

        {/* 식사 */}
        <StatRow label="식사 분포" value={formatDist(s.meal, MEAL_ORDER, MEAL_LABEL)} />

        {/* 기분 */}
        <StatRow label="기분 분포" value={formatDist(s.mood, MOOD_ORDER, MOOD_LABEL)} />

        {/* 건강 */}
        <StatRow label="건강 분포" value={formatDist(s.health, HEALTH_ORDER, HEALTH_LABEL)} />

        {/* 프로그램 */}
        <div className="sm:col-span-2">
          <StatRow
            label="참여 활동"
            value={
              s.topPrograms.length === 0
                ? '참여한 공통 프로그램 없음'
                : s.topPrograms.map((p) => `${p.title} ${p.count}회`).join(' · ')
            }
          />
        </div>
      </div>

      <p className="mt-5 pt-3 border-t border-gray-100 text-xs text-gray-400">
        ※ 위 숫자는 직원 검수용이며, 보호자에게는 아래 AI 편지 본문으로만 전달됩니다.
        근거 알림장 {preview.sourceNoticeIds.length}건.
      </p>
    </section>
  )
}


function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}
