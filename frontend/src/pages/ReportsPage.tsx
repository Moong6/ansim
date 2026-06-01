import { useEffect } from 'react'
import Header from '../components/Header'
import ReportR1Selector from '../components/ReportR1Selector'
import ReportR2Stats from '../components/ReportR2Stats'
import ReportR3Letter from '../components/ReportR3Letter'
import Toast from '../components/Toast'
import { useDashboardStore } from '../store/dashboardStore'
import { useReportStore } from '../store/reportStore'


export default function ReportsPage() {
  // 담당 어르신 목록은 1차 dashboardStore 재사용 (없으면 로드)
  const residents       = useDashboardStore((s) => s.residents)
  const residentsLoading = useDashboardStore((s) => s.residentsLoading)
  const loadResidents   = useDashboardStore((s) => s.loadResidents)

  const preview         = useReportStore((s) => s.preview)
  const previewError    = useReportStore((s) => s.previewError)
  const justSentReportId = useReportStore((s) => s.justSentReportId)
  const clearJustSent   = useReportStore((s) => s.clearJustSent)

  const loadPreview     = useReportStore((s) => s.loadPreview)
  const generateLetter  = useReportStore((s) => s.generateLetter)

  // 마운트 시: 어르신 목록 없으면 로드
  useEffect(() => {
    if (residents.length === 0 && !residentsLoading) {
      loadResidents()
    }
  }, [residents.length, residentsLoading, loadResidents])

  // ─── [리포트 생성] 클릭 — dataLevel 분기 ─────────────────────────────────────
  async function handleGenerate() {
    // 1) preview 호출
    const res = await loadPreview()
    if (!res) return        // 에러는 store 가 표시

    // 2) dataLevel 분기
    if (res.dataLevel === 'NONE') {
      // 안내 박스만 표시 — generate 호출 안 함
      return
    }
    if (res.dataLevel === 'SPARSE') {
      const ok = confirm(
        `해당 주에 기록된 알림장이 ${res.recordedDays}일치뿐입니다.\n` +
        `제한된 정보로 편지가 작성됩니다. 계속할까요?`,
      )
      if (!ok) return
    }

    // 3) generate (LLM 호출)
    await generateLetter()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* R1: 선택 */}
        <ReportR1Selector onGenerateClick={handleGenerate} />

        {/* preview 에러 표시 */}
        {previewError && (
          <section className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">{previewError}</p>
          </section>
        )}

        {/* dataLevel === NONE → 안내 박스 (R2/R3 미표시) */}
        {preview && preview.dataLevel === 'NONE' && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 border-dashed p-6">
            <div className="py-8 text-center">
              <div className="text-3xl mb-2">📭</div>
              <h3 className="text-base font-bold text-gray-800 mb-1">
                해당 주에 작성된 알림장이 없습니다
              </h3>
              <p className="text-sm text-gray-500">
                {preview.periodStart} ~ {preview.periodEnd} 기간에 발송된 알림장이 없어
                주간 리포트를 만들 수 없습니다.
              </p>
              <p className="text-xs text-gray-400 mt-3">
                다른 주차를 선택하거나, 해당 주에 알림장을 먼저 작성해 주세요.
              </p>
            </div>
          </section>
        )}

        {/* R2: 통계 요약 — preview 가 NONE 이 아닐 때만 */}
        <ReportR2Stats />

        {/* R3 + R4: 편지 + 톤 + 액션 */}
        <ReportR3Letter />

        {/* 전송 완료 직후 안내 (R1 유지, R2/R3 는 store 가 비웠음) */}
        {justSentReportId !== null && (
          <section className="bg-white rounded-xl shadow-sm border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-6">
            <div className="py-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-100 mb-3">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">
                주간 리포트가 전송되었습니다
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                (report id: {justSentReportId})
              </p>
              <button
                type="button"
                onClick={clearJustSent}
                className="
                  px-5 py-2 rounded-lg text-sm font-semibold text-white
                  bg-teal-600 hover:bg-teal-700
                  focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2
                  transition-colors
                "
              >
                확인
              </button>
            </div>
          </section>
        )}
      </main>

      <Toast />
    </div>
  )
}
