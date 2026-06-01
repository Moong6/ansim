/**
 * 보호자 공지사항 목록 /parent/board
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ParentLayout from '../../components/ParentLayout'
import { getParentBoardList } from '../../api/parent'
import { useToastStore } from '../../store/toastStore'
import type { ParentBoardItem } from '../../types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export default function ParentBoardListPage() {
  const navigate = useNavigate()
  const { show: showToast } = useToastStore()
  const [items, setItems]     = useState<ParentBoardItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentBoardList()
      .then((res) => setItems(res.items))
      .catch(() => showToast('공지사항을 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  return (
    <ParentLayout title="공지사항" back="/parent/home">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <span className="text-4xl mb-3">📌</span>
          <p className="text-sm">등록된 공지사항이 없습니다</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => navigate(`/parent/board/${item.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-orange-100
                  p-4 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                  transition-all duration-150"
              >
                <p className="text-sm font-semibold text-gray-800 mb-1 line-clamp-2">
                  {item.title}
                </p>
                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.preview}</p>
                <p className="text-xs text-orange-400">{formatDate(item.createdAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ParentLayout>
  )
}
