/**
 * 보호자 문의 작성 /parent/inquiries/new
 * - 카테고리 선택 없음 (AI가 자동 분류)
 * - 이중 전송 방지 (loading 중 submit 비활성)
 * - content: 필수, 최대 500자
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import ParentLayout from '../../components/ParentLayout'
import { createParentInquiry } from '../../api/parent'
import { getParentMe } from '../../api/parent'
import { useToastStore } from '../../store/toastStore'
import type { ParentResident } from '../../types'

const MAX_CONTENT = 500

export default function ParentInquiryNewPage() {
  const navigate = useNavigate()
  const { show: showToast } = useToastStore()

  const [residents, setResidents] = useState<ParentResident[]>([])
  const [residentId, setResidentId] = useState<number | null>(null)
  const [title, setTitle]           = useState('')
  const [content, setContent]       = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const submittedRef                = useRef(false)

  // 어르신 목록 로드
  useEffect(() => {
    getParentMe()
      .then((res) => {
        setResidents(res.residents)
        if (res.residents.length === 1) {
          setResidentId(res.residents[0].id)
        }
      })
      .catch(() => showToast('정보를 불러오지 못했습니다', 'error'))
  }, [showToast])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    // 이중 전송 방지
    if (submittedRef.current || loading) return

    // 검증
    if (!residentId) {
      setError('어르신을 선택해 주세요.')
      return
    }
    if (!content.trim()) {
      setError('문의 내용을 입력해 주세요.')
      return
    }
    if (content.trim().length > MAX_CONTENT) {
      setError(`문의 내용은 ${MAX_CONTENT}자 이하로 입력해 주세요.`)
      return
    }

    submittedRef.current = true
    setLoading(true)

    try {
      await createParentInquiry({
        residentId,
        title: title.trim() || undefined,
        content: content.trim(),
      })
      showToast('문의가 접수되었습니다', 'success')
      navigate('/parent/inquiries', { replace: true })
    } catch {
      showToast('문의 전송에 실패했습니다. 다시 시도해 주세요.', 'error')
      submittedRef.current = false
    } finally {
      setLoading(false)
    }
  }

  return (
    <ParentLayout title="문의 작성" back="/parent/inquiries">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* 어르신 선택 (2명 이상인 경우) */}
        {residents.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              어르신 선택 <span className="text-red-500">*</span>
            </label>
            <select
              value={residentId ?? ''}
              onChange={(e) => setResidentId(Number(e.target.value))}
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent
                disabled:bg-gray-50 transition bg-white"
            >
              <option value="">어르신을 선택하세요</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.roomNumber ? `${r.roomNumber}호` : '미배정'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 제목 (선택) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            제목 <span className="text-xs text-gray-400">(선택)</span>
          </label>
          <input
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            maxLength={100}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm
              focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent
              disabled:bg-gray-50 transition"
          />
        </div>

        {/* 문의 내용 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">
              문의 내용 <span className="text-red-500">*</span>
            </label>
            <span className={`text-xs ${content.length > MAX_CONTENT ? 'text-red-500' : 'text-gray-400'}`}>
              {content.length} / {MAX_CONTENT}
            </span>
          </div>
          <textarea
            placeholder="궁금하신 점을 자유롭게 작성해 주세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
            rows={7}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent
              disabled:bg-gray-50 transition leading-relaxed"
          />
        </div>

        {/* AI 분류 안내 */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-orange-50">
          <span className="text-orange-400 text-sm mt-0.5">✨</span>
          <p className="text-xs text-orange-600 leading-relaxed">
            더 나은 서비스 제공을 위해 AI를 사용 중입니다.
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <p role="alert" className="text-sm text-red-600 flex items-center gap-1.5">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1z"
                clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}

        {/* 전송 버튼 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white
            bg-orange-400 hover:bg-orange-500 active:bg-orange-600
            disabled:bg-orange-200 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              전송 중...
            </span>
          ) : '문의 전송'}
        </button>
      </form>
    </ParentLayout>
  )
}
