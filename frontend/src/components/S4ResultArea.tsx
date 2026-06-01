import { useNoticeStore } from '../store/noticeStore'
import { useDashboardStore } from '../store/dashboardStore'
import NoticeOptionSelector from './NoticeOptionSelector'

export default function S4ResultArea() {
  const selectedId     = useDashboardStore((s) => s.selectedResidentId)
  const selectResident = useDashboardStore((s) => s.selectResident)
  const summary        = useDashboardStore((s) => s.summary)

  const mode               = useNoticeStore((s) => s.mode)
  const drafts             = useNoticeStore((s) => s.drafts)
  const softenedCount      = useNoticeStore((s) => s.softenedCount)
  const generating         = useNoticeStore((s) => s.generating)
  const selectedDraftIndex = useNoticeStore((s) => s.selectedDraftIndex)
  const editedText         = useNoticeStore((s) => s.editedText)
  const isRefined          = useNoticeStore((s) => s.isRefined)
  const refining           = useNoticeStore((s) => s.refining)
  const sending            = useNoticeStore((s) => s.sending)
  const sendError          = useNoticeStore((s) => s.sendError)
  const justSentNoticeId   = useNoticeStore((s) => s.justSentNoticeId)

  const selectDraft   = useNoticeStore((s) => s.selectDraft)
  const setEditedText = useNoticeStore((s) => s.setEditedText)
  const refine        = useNoticeStore((s) => s.refine)
  const send          = useNoticeStore((s) => s.send)
  const reset         = useNoticeStore((s) => s.reset)

  // 가드: 읽기 모드면 비표시 (ReadOnlyNotice가 그림)
  if (mode === 'reading') return null
  if (!selectedId) return null

  // ─── 전송 완료 화면 ────────────────────────────────────────────────────────
  if (justSentNoticeId !== null) {
    const allDone = summary.total > 0 && summary.completed >= summary.total

    if (allDone) {
      // ★ 전체 완료 축하 화면
      return (
        <section
          className="
            rounded-xl shadow-sm border border-teal-200 p-6
            bg-gradient-to-br from-teal-50 via-white to-cyan-50
          "
        >
          <div className="py-10 text-center">
            <div className="text-6xl mb-3" aria-hidden>🎉</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              오늘 알림장 <span className="text-teal-700">{summary.total}건</span> 모두 완료!
            </h2>
            <p className="text-sm text-gray-600 mb-1">
              담당 어르신 모두의 알림장이 보호자에게 전달되었습니다.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              오늘도 정성껏 돌봐주셔서 감사합니다.
            </p>
            <button
              type="button"
              onClick={() => {
                reset()
                selectResident(null)
              }}
              className="
                px-6 py-2.5 rounded-lg text-sm font-semibold text-white
                bg-teal-600 hover:bg-teal-700 active:bg-teal-800
                focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2
                transition-colors
              "
            >
              확인
            </button>
          </div>
        </section>
      )
    }

    // ─ 일반 전송 완료 화면 ───────────────────────────────────────────────────
    const remaining = summary.total - summary.completed
    return (
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-100 mb-3">
            <svg className="w-7 h-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">전송이 완료되었습니다</h2>
          <p className="text-xs text-gray-500 mb-1">
            보호자에게 알림장이 전달되었습니다. (notice id: {justSentNoticeId})
          </p>
          <p className="text-xs text-gray-400 mb-5">
            남은 어르신 <span className="font-semibold text-gray-600">{remaining}명</span>
          </p>
          <button
            type="button"
            onClick={() => {
              reset()
              selectResident(null)
            }}
            className="
              px-5 py-2.5 rounded-lg text-sm font-semibold text-white
              bg-teal-600 hover:bg-teal-700 active:bg-teal-800
              focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2
              transition-colors
            "
          >
            다음 어르신 선택하기
          </button>
        </div>
      </section>
    )
  }

  // ─── 생성 중 ───────────────────────────────────────────────────────────────
  if (generating) {
    return (
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-3">AI 결과</h2>
        <div className="py-12 text-center text-sm text-gray-400">
          <div className="inline-flex items-center gap-2">
            <svg className="animate-spin w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
            </svg>
            AI가 3개 초안을 생성하고 있습니다... (3~5초)
          </div>
        </div>
      </section>
    )
  }

  // ─── 생성 전 안내 ─────────────────────────────────────────────────────────
  if (!drafts) {
    return (
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 border-dashed p-6">
        <h2 className="text-base font-bold text-gray-800 mb-3">AI 결과</h2>
        <p className="py-8 text-center text-sm text-gray-400">
          위에서 [AI로 알림장 생성] 버튼을 누르면 3개 초안이 여기에 표시됩니다.
        </p>
      </section>
    )
  }

  // ─── 초안 표시 + 편집 + 다듬기 + 전송 ────────────────────────────────────
  const charCount = editedText.length
  const isEmpty = editedText.trim().length === 0
  const canSend = !isEmpty && selectedDraftIndex !== null && !sending && !refining

  // ★ 방어 2 보조: 직접 수정 여부
  const isManuallyEdited =
    selectedDraftIndex !== null && editedText !== drafts[selectedDraftIndex].text

  async function handleRefine() {
    if (isRefined || refining) return
    // 방어 2 (Dirty State)
    if (isManuallyEdited) {
      if (!confirm('직접 수정한 내용 일부가 변경될 수 있습니다. 계속할까요?')) return
    }
    await refine()
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">AI 초안 선택 및 편집</h2>
        {softenedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 0 1 1 1v1.07A7 7 0 0 1 17 11h1a1 1 0 1 1 0 2h-1a7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-1.07A7 7 0 0 1 3 13H2a1 1 0 1 1 0-2h1a7 7 0 0 1 6-6.93V3a1 1 0 0 1 1-1z" />
            </svg>
            부정 표현 {softenedCount}개를 부드럽게 다듬었어요
          </span>
        )}
      </div>

      <NoticeOptionSelector
        mode="multi"
        drafts={drafts}
        selectedIndex={selectedDraftIndex}
        editedText={editedText}
        onSelect={selectDraft}
        onEdit={setEditedText}
        disabled={sending || refining}
      />

      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-2">
          {isRefined && (
            <span className="inline-flex items-center gap-1 text-teal-600">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              다듬기 완료
            </span>
          )}
          {isManuallyEdited && !isRefined && (
            <span className="inline-flex items-center gap-1 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              직접 수정됨
            </span>
          )}
        </span>
        <span>{charCount}자</span>
      </div>

      {sendError && (
        <p role="alert" className="mt-3 text-sm text-red-600">{sendError}</p>
      )}

      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-100">
        {/* ★ 다듬기 — 1회만, 사용 후 disabled + 표시 변경 */}
        <button
          type="button"
          onClick={handleRefine}
          disabled={isRefined || refining || sending || isEmpty}
          title={
            isRefined
              ? '이미 다듬어졌습니다'
              : isManuallyEdited
              ? '수정된 내용이 일부 변경될 수 있습니다'
              : '맞춤법·표현을 부드럽게 다듬습니다'
          }
          className={`
            inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
            ${isRefined
              ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
              : refining
              ? 'border-teal-200 text-teal-700 bg-teal-50 cursor-wait'
              : 'border-teal-200 text-teal-700 bg-white hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed'}
          `}
        >
          {refining ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
              다듬는 중...
            </>
          ) : isRefined ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z"
                  clipRule="evenodd" />
              </svg>
              이미 다듬어졌습니다
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11 5h6M11 9h6M11 13h6M3 5l2 2 4-4M3 11l2 2 4-4M3 17l2 2 4-4" />
              </svg>
              맞춤법·표현 다듬기
            </>
          )}
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => send(selectedId)}
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
