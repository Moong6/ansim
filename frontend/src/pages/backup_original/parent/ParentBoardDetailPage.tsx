/**
 * 보호자 공지사항 상세 /parent/board/:id
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ParentLayout from '../../components/ParentLayout'
import { getParentBoardDetail } from '../../api/parent'
import { useToastStore } from '../../store/toastStore'
import type { ParentBoardPost } from '../../types'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ParentBoardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { show: showToast } = useToastStore()
  const [post, setPost]       = useState<ParentBoardPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getParentBoardDetail(Number(id))
      .then((res) => setPost(res.post))
      .catch(() => showToast('공지사항을 불러오지 못했습니다', 'error'))
      .finally(() => setLoading(false))
  }, [id, showToast])

  return (
    <ParentLayout title="공지사항" back="/parent/board">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !post ? (
        <div className="text-center py-20 text-gray-400 text-sm">내용을 불러올 수 없습니다</div>
      ) : (
        <div className="bg-white rounded-2xl border border-orange-100 p-5">
          <h2 className="text-base font-bold text-gray-800 mb-2">{post.title}</h2>
          <p className="text-xs text-gray-400 mb-5">{formatDateTime(post.createdAt)}</p>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {post.content}
            </p>
          </div>
        </div>
      )}
    </ParentLayout>
  )
}
