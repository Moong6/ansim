import { type Draft } from '../types'

/**
 * AI 초안 선택 + 편집 컴포넌트
 *
 * ★ Loosely Coupled 설계
 *   - mode="multi"  : 탭 [A][B][C] + 편집 textarea (MVP 기본)
 *   - mode="single" : 탭 없이 drafts[0] 만 바로 편집 textarea (1안 모드 롤백용)
 *
 * 부모에서 mode를 단일 prop으로 바꾸면 즉시 1안 모드로 전환된다.
 */

interface Props {
  mode: 'multi' | 'single'
  drafts: Draft[]
  selectedIndex: number | null
  editedText: string
  onSelect: (index: number) => void
  onEdit: (text: string) => void
  disabled?: boolean
}

export default function NoticeOptionSelector({
  mode, drafts, selectedIndex, editedText, onSelect, onEdit, disabled,
}: Props) {

  // ── single 모드: 탭 없이 첫 초안만 편집 ─────────────────────────────────────
  if (mode === 'single') {
    return (
      <EditableArea
        text={editedText}
        onChange={onEdit}
        disabled={disabled}
      />
    )
  }

  // ── multi 모드: 탭 + 편집 ───────────────────────────────────────────────────
  return (
    <div>
      {/* 탭 */}
      <div role="tablist" className="flex gap-1 border-b border-gray-200">
        {drafts.map((d) => {
          const active = selectedIndex === d.index
          return (
            <button
              key={d.index}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onSelect(d.index)}
              disabled={disabled}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                ${active
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                disabled:cursor-not-allowed disabled:opacity-50
              `}
            >
              {d.label}안
            </button>
          )
        })}
      </div>

      {/* 편집 영역 — 선택된 탭이 없으면 안내 */}
      <div className="mt-3">
        {selectedIndex === null ? (
          <p className="py-6 text-center text-sm text-gray-400">
            위 탭에서 초안을 하나 선택해 주세요.
          </p>
        ) : (
          <EditableArea
            text={editedText}
            onChange={onEdit}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  )
}

// ─── 내부: 편집 가능 textarea ────────────────────────────────────────────────

function EditableArea({
  text, onChange, disabled,
}: {
  text: string
  onChange: (t: string) => void
  disabled?: boolean
}) {
  return (
    <textarea
      value={text}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={8}
      className="
        w-full px-3 py-2.5 rounded-lg border border-gray-200
        text-sm text-gray-800 leading-relaxed
        focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
        disabled:bg-gray-50 disabled:text-gray-500
        resize-y min-h-[150px]
      "
      placeholder="알림장 본문..."
    />
  )
}
