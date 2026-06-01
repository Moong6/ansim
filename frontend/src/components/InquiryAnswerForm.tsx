/**
 * 8차 스프린트: 직원 답변 작성 폼
 * - READ 상태의 문의에만 노출
 * - textarea (1~500자 카운터)
 * - [답변 등록] 버튼: 빈 값이면 disabled
 * - 작성 중 이탈 가드 (dirty)
 */
import { useState } from 'react'
import { createInquiryAnswer } from '../api/inquiries'
import { useToastStore } from '../store/toastStore'
import type { InquiryAnswer } from '../types'

interface Props {
  inquiryId: number
  /** 등록 성공 시 answer + 새 상태 전달 */
  onCreated: (answer: InquiryAnswer, newStatus: string) => void
}

export default function InquiryAnswerForm({ inquiryId, onCreated }: Props) {
  const { show: toast } = useToastStore()
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)
  const dirty = content.trim().length > 0

  async function handleSubmit() {
    const text = content.trim()
    if (!text) return
    if (text.length > 500) {
      toast('답변은 500자 이하로 입력해 주세요', 'error')
      return
    }

    setSaving(true)
    try {
      const result = await createInquiryAnswer(inquiryId, text)
      toast('답변이 등록되었습니다')
      setContent('')
      onCreated(result.answer, result.inquiryStatus)
    } catch (err: unknown) {
      const apiErr = (err as { error?: { message: string } })?.error
      toast(apiErr?.message ?? '답변 등록에 실패했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-600 text-base">💬</span>
        <p className="text-sm font-semibold text-green-800">답변 작성</p>
      </div>

      {/* textarea */}
      <textarea
        maxLength={500}
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="보호자님께 답변을 입력하세요..."
        className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm resize-none
          focus:outline-none focus:ring-2 focus:ring-green-400 bg-white placeholder-gray-400"
        disabled={saving}
      />
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-400">{content.length}/500</p>
        <button
          onClick={handleSubmit}
          disabled={!dirty || saving}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-green-600
            hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              등록 중...
            </span>
          ) : '답변 등록'}
        </button>
      </div>
    </div>
  )
}
