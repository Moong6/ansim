import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useToastStore } from '../store/toastStore'
import { listBoard, removeBoard } from '../api/board'
import type { BoardItem } from '../types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function BoardListPage() {
  const navigate    = useNavigate()
  const { show: showToast } = useToastStore()
  const [items, setItems]   = useState<BoardItem[]>([])
  const [total, setTotal]   = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const LIMIT = 20

  const load = useCallback(async (off = 0, append = false) => {
    setLoading(true)
    try {
      const res = await listBoard(LIMIT, off)
      setTotal(res.total)
      setItems(prev => append ? [...prev, ...res.items] : res.items)
      setOffset(off + res.items.length)
    } catch {
      showToast('공지 목록을 불러오지 못했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load(0) }, [load])

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await removeBoard(id)
      showToast('삭제되었습니다')
      load(0)
    } catch {
      showToast('삭제에 실패했습니다', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 상단 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">공지사항</h2>
          <button
            onClick={() => navigate('/board/new')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
          >
            + 새 공지 작성
          </button>
        </div>

        {/* 목록 */}
        <div className="space-y-3">
          {items.length === 0 && !loading && (
            <p className="text-center text-gray-400 py-12">등록된 공지가 없습니다</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/board/${item.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{item.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.preview}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {item.author.name} · {formatDate(item.createdAt)}
                  </p>
                </div>
                {item.canEdit && (
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/board/${item.id}/edit`) }}
                      className="px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 더 보기 */}
        {items.length < total && (
          <div className="mt-6 text-center">
            <button
              onClick={() => load(offset, true)}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loading ? '로딩 중...' : '더 보기'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
