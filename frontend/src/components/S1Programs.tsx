import { useDashboardStore } from '../store/dashboardStore'

export default function S1Programs() {
  const programs    = useDashboardStore((s) => s.programs)
  const loading     = useDashboardStore((s) => s.programsLoading)
  const error       = useDashboardStore((s) => s.programsError)
  const loadPrograms = useDashboardStore((s) => s.loadPrograms)

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* ── 섹션 헤더 ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">
          오늘의 시설 공통 프로그램
        </h2>
        {!loading && !error && programs.length > 0 && (
          <span className="text-xs text-gray-400">{programs.length}개 진행</span>
        )}
      </div>

      {/* ── 로딩 ── */}
      {loading && (
        <div className="py-8 text-center text-sm text-gray-400">
          불러오는 중...
        </div>
      )}

      {/* ── 에러 + 재시도 ── */}
      {!loading && error && (
        <div className="py-8 text-center">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <button
            type="button"
            onClick={() => loadPrograms()}
            className="text-xs text-teal-700 hover:text-teal-800 underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {!loading && !error && programs.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-400">
          오늘 진행된 공통 프로그램이 없습니다.
        </div>
      )}

      {/* ── 가로 스크롤 카드 ── */}
      {!loading && !error && programs.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {programs.map((p) => (
            <div
              key={p.id}
              className="
                flex-shrink-0 w-56 p-4 rounded-lg
                bg-gradient-to-br from-teal-50 to-cyan-50
                border border-teal-100
              "
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                </svg>
                <span className="text-sm font-bold text-teal-700">
                  {p.startTime ?? '시간 미정'}
                </span>
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">{p.title}</h3>
              {p.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
