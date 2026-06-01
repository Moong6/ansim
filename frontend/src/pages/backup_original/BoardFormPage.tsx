import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { useToastStore } from '../store/toastStore'
import { createBoard, getBoard, updateBoard } from '../api/board'

interface Props {
  mode: 'create' | 'edit'
}

export default function BoardFormPage({ mode }: Props) {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { show: showToast } = useToastStore()

  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(mode === 'edit')

  // 수정 모드: 기존 데이터 로드 + 권한 확인
  useEffect(() => {
    if (mode !== 'edit' || !id) return
    getBoard(Number(id))
      .then((r) => {
        if (!r.post.canEdit) {
          showToast('수정 권한이 없습니다', 'error')
          navigate('/board')
          return
        }
        setTitle(r.post.title)
        setContent(r.post.content)
      })
      .catch(() => { showToast('공지를 찾을 수 없습니다', 'error'); navigate('/board') })
      .finally(() => setLoading(false))
  }, [mode, id, navigate, showToast])

  const isValid = title.trim().length > 0 && content.trim().length > 0

  async function handleSubmit() {
    if (!isValid || saving) return
    setSaving(true)
    try {
      if (mode === 'create') {
        const res = await createBoard(title.trim(), content.trim())
        showToast('공지가 작성되었습니다')
        navigate(`/board/${res.post.id}`)
      } else {
        await updateBoard(Number(id), { title: title.trim(), content: content.trim() })
        showToast('공지가 수정되었습니다')
        navigate(`/board/${id}`)
      }
    } catch {
      showToast('저장에 실패했습니다', 'error')
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex items-center justify-center pt-20 text-gray-400">불러오는 중...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? '새 공지 작성' : '공지 수정'}
          </h2>

          {/* 제목 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공지 제목을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{title.length}/200</p>
          </div>

          {/* 본문 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="공지 내용을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => navigate(mode === 'edit' ? `/board/${id}` : '/board')}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
