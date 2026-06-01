/**
 * 8차 스프린트: 직원 답변 표시 컴포넌트
 * - 연한 초록 배경
 * - 답변 본문 + 작성자 카드 (아바타·이름·직책·날짜)
 * - canEdit=true면 [✏ 수정][🗑 삭제] 버튼
 * - 수정: inline edit (모달 X)
 */
import { useState } from 'react'
import { deleteInquiryAnswer, updateInquiryAnswer } from '../api/inquiries'
import { useToastStore } from '../store/toastStore'
import type { InquiryAnswer } from '../types'

const ROLE_LABEL: Record<string, string> = {
  CAREGIVER:     '요양보호사',
  SOCIAL_WORKER: '사회복지사',
  ADMIN:         '관리자',
  GUARDIAN:      '보호자',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface Props {
  inquiryId: number
  answer:    InquiryAnswer
  /** 답변 수정 후 콜백 */
  onUpdated: (newAnswer: InquiryAnswer) => void
  /** 답변 삭제 후 콜백 */
  onDeleted: () => void
}

export default function InquiryAnswerDisplay({ inquiryId, answer, onUpdated, onDeleted }: Props) {
  const { show: toast } = useToastStore()

  const [editing,     setEditing]     = useState(false)
  const [editContent, setEditContent] = useState(answer.content)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  // ── 수정 저장 ─────────────────────────────────────────────────────────────
  async function handleSave() {
    const text = editContent.trim()
    if (!text) { toast('답변 내용을 입력해 주세요', 'error'); return }
    if (text.length > 500) { toast('답변은 500자 이하로 입력해 주세요', 'error'); return }

    setSaving(true)
    try {
      const updated = await updateInquiryAnswer(inquiryId, text)
      toast('답변이 수정되었습니다')
      setEditing(false)
      onUpdated(updated)
    } catch (err: unknown) {
      const apiErr = (err as { error?: { message: string } })?.error
      toast(apiErr?.message ?? '수정에 실패했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditContent(answer.content)
    setEditing(false)
  }

  // ── 삭제 ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm('답변을 삭제하시겠습니까? 문의 상태가 "답변 대기"로 돌아갑니다.')) return
    setDeleting(true)
    try {
      await deleteInquiryAnswer(inquiryId)
      toast('답변이 삭제되었습니다')
      onDeleted()
    } catch (err: unknown) {
      const apiErr = (err as { error?: { message: string } })?.error
      toast(apiErr?.message ?? '삭제에 실패했습니다', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const authorLabel = `${answer.author.name} ${ROLE_LABEL[answer.author.role] ?? answer.author.role}`

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-base">💬</span>
          <p className="text-sm font-semibold text-green-800">답변</p>
        </div>

        {/* 수정·삭제 버튼 (canEdit=true인 경우만) */}
        {answer.canEdit && !editing && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setEditContent(answer.content); setEditing(true) }}
              className="p-1.5 text-gray-500 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors text-sm"
              title="수정"
            >
              ✏
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm
                disabled:opacity-40"
              title="삭제"
            >
              {deleting ? '…' : '🗑'}
            </button>
          </div>
        )}
      </div>

      {/* 본문 or 인라인 편집 */}
      {editing ? (
        <div>
          <textarea
            maxLength={500}
            rows={4}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            disabled={saving}
            autoFocus
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-400">{editContent.length}/500</p>
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600
                  border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!editContent.trim() || saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white
                  bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-40"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {answer.content}
        </p>
      )}

      {/* 구분선 + 작성자 카드 */}
      {!editing && (
        <div className="mt-4 pt-3 border-t border-green-200 flex items-center gap-2.5">
          {/* 아바타 */}
          <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center
            text-white text-xs font-semibold shrink-0">
            {answer.author.name.charAt(0)}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700">{authorLabel}</p>
            <p className="text-xs text-gray-400">{formatDate(answer.createdAt)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
