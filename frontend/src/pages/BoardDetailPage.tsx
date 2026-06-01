import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { useToastStore } from '../store/toastStore'
import { getBoard, removeBoard } from '../api/board'
import type { BoardPost } from '../types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function BoardDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { show: showToast } = useToastStore()
  const [post, setPost] = useState<BoardPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getBoard(Number(id))
      .then((r) => setPost(r.post))
      .catch(() => { showToast('공지를 찾을 수 없습니다', 'error'); navigate('/board') })
      .finally(() => setLoading(false))
  }, [id, navigate, showToast])

  async function handleDelete() {
    if (!post) return
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await removeBoard(post.id)
      showToast('삭제되었습니다')
      navigate('/board')
    } catch {
      showToast('삭제에 실패했습니다', 'error')
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex items-center justify-center pt-20 text-gray-400">불러오는 중...</div>
    </div>
  )

  if (!post) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          {/* 제목 */}
          <h2 className="text-xl font-bold text-gray-900">{post.title}</h2>

          {/* 메타 */}
          <div className="flex items-center justify-between text-sm text-gray-500 pb-4 border-b border-gray-100">
            <span>{post.author.name}</span>
            <span>{formatDate(post.createdAt)}</span>
          </div>

          {/* 본문 */}
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[120px]">
            {post.content}
          </p>

          {/* 버튼 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => navigate('/board')}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← 목록으로
            </button>
            {post.canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/board/${post.id}/edit`)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
