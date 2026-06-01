import { useEffect, useMemo, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { useReportStore } from '../store/reportStore'


// ─── 날짜 헬퍼 ────────────────────────────────────────────────────────────────

/** 해당 날짜가 속한 주의 월요일 자정을 반환 */
function mondayOf(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const day = r.getDay()                  // 0=일, 1=월, ..., 6=토
  const diff = day === 0 ? -6 : 1 - day   // 일=-6, 월=0, 화=-1, ...
  r.setDate(r.getDate() + diff)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtKorean(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function isMonday(ymd: string): boolean {
  const [y, m, dd] = ymd.split('-').map(Number)
  return new Date(y, m - 1, dd).getDay() === 1
}


// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

interface Props {
  /** 부모(ReportsPage)가 dataLevel 분기까지 처리하기 위한 콜백 */
  onGenerateClick: () => void | Promise<void>
}

export default function ReportR1Selector({ onGenerateClick }: Props) {
  // 담당 어르신 목록 (1차 dashboardStore 재활용)
  const residents = useDashboardStore((s) => s.residents)
  const residentsLoading = useDashboardStore((s) => s.residentsLoading)

  const selectedResidentId = useReportStore((s) => s.selectedResidentId)
  const periodStart = useReportStore((s) => s.periodStart)
  const previewLoading = useReportStore((s) => s.previewLoading)

  const setResident = useReportStore((s) => s.setResident)
  const setPeriodStart = useReportStore((s) => s.setPeriodStart)

  // 미리 계산
  const today = useMemo(() => new Date(), [])
  const thisMonday = useMemo(() => mondayOf(today), [today])
  const lastMonday = useMemo(() => addDays(thisMonday, -7), [thisMonday])
  const lastSunday = useMemo(() => addDays(lastMonday, 6), [lastMonday])
  const thisSunday = useMemo(() => addDays(thisMonday, 6), [thisMonday])
  const lastMondayYMD = fmtYMD(lastMonday)
  const thisMondayYMD = fmtYMD(thisMonday)

  // 직접 선택 모드
  const [customMode, setCustomMode] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)

  // 페이지 진입 시 periodStart 가 비어있으면 지난주를 기본으로 (명세: 기본=지난주)
  useEffect(() => {
    if (periodStart === null) {
      setPeriodStart(lastMondayYMD)
    }
  }, [periodStart, lastMondayYMD, setPeriodStart])

  // 현재 선택 상태 판정
  const isLastWeek = periodStart === lastMondayYMD && !customMode
  const isThisWeek = periodStart === thisMondayYMD && !customMode

  function pickLastWeek() {
    setCustomMode(false)
    setCustomError(null)
    setPeriodStart(lastMondayYMD)
  }
  function pickThisWeek() {
    setCustomMode(false)
    setCustomError(null)
    setPeriodStart(thisMondayYMD)
  }
  function enableCustom() {
    setCustomMode(true)
    setCustomError(null)
    // 기존 값 유지
  }
  function onCustomChange(value: string) {
    setCustomError(null)
    if (!value) {
      setPeriodStart(null)
      return
    }
    if (!isMonday(value)) {
      setCustomError('월요일 날짜만 선택할 수 있습니다.')
      return
    }
    setPeriodStart(value)
  }

  const canGenerate =
    selectedResidentId !== null && !!periodStart && !previewLoading

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-gray-800">📊 주간 안심 리포트</h2>
        <span className="text-xs text-gray-400">한 주의 흐름을 따뜻한 편지로</span>
      </div>

      {/* ─ 어르신 선택 ─ */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          어르신 선택
        </label>
        {residentsLoading ? (
          <p className="text-sm text-gray-400">담당 어르신을 불러오는 중...</p>
        ) : residents.length === 0 ? (
          <p className="text-sm text-gray-400">담당하고 있는 어르신이 없습니다.</p>
        ) : (
          <select
            value={selectedResidentId ?? ''}
            onChange={(e) =>
              setResident(e.target.value ? Number(e.target.value) : null)
            }
            className="
              w-full sm:w-auto min-w-[260px] px-3 py-2.5 rounded-lg border border-gray-200
              text-sm text-gray-800
              focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
            "
          >
            <option value="">— 어르신 선택 —</option>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.age}세, {r.roomNumber})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ─ 주차 선택 ─ */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          조회 주차
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          <WeekChip
            selected={isLastWeek}
            label="지난주 (기본)"
            sub={`${fmtKorean(lastMonday)} ~ ${fmtKorean(lastSunday)}`}
            onClick={pickLastWeek}
          />
          <WeekChip
            selected={isThisWeek}
            label="이번주"
            sub={`${fmtKorean(thisMonday)} ~ ${fmtKorean(thisSunday)}`}
            onClick={pickThisWeek}
          />
          <WeekChip
            selected={customMode}
            label="직접 선택"
            sub="월요일 날짜만"
            onClick={enableCustom}
          />
        </div>

        {customMode && (
          <div className="mt-2 flex items-start gap-2">
            <input
              type="date"
              value={periodStart && !isLastWeek && !isThisWeek ? periodStart : ''}
              onChange={(e) => onCustomChange(e.target.value)}
              className="
                px-3 py-2 rounded-lg border border-gray-200
                text-sm text-gray-800
                focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
              "
            />
            {customError && (
              <p className="text-xs text-red-600 self-center">{customError}</p>
            )}
          </div>
        )}
      </div>

      {/* ─ 생성 버튼 ─ */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {canGenerate
            ? '준비 완료 — 리포트 생성을 눌러주세요.'
            : '어르신과 주차를 선택하면 활성화됩니다.'}
        </p>
        <button
          type="button"
          disabled={!canGenerate}
          onClick={onGenerateClick}
          className="
            px-6 py-2.5 rounded-lg font-semibold text-sm text-white
            bg-teal-600 hover:bg-teal-700 active:bg-teal-800
            disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2
            transition-colors
          "
        >
          {previewLoading ? '불러오는 중...' : '리포트 생성'}
        </button>
      </div>
    </section>
  )
}


// ─── 내부: 주차 칩 ────────────────────────────────────────────────────────────

function WeekChip({
  selected, label, sub, onClick,
}: {
  selected: boolean
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        text-left p-3 rounded-lg border-2 transition-colors min-w-[170px]
        ${selected
          ? 'border-teal-500 bg-teal-50'
          : 'border-gray-100 bg-white hover:border-gray-200'}
      `}
    >
      <p className={`text-sm font-bold ${selected ? 'text-teal-700' : 'text-gray-700'}`}>
        {label}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </button>
  )
}
