/**
 * 7차 스프린트: 보호자 앨범 상세 /parent/albums/:id
 * - 403 → /parent/albums 리다이렉트
 * - 사진 그리드 + 라이트박스
 * - 읽기 전용 (수정 불가)
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getParentAlbum } from '../../api/albums'
import { useToastStore } from '../../store/toastStore'
import type { AlbumDetailParent } from '../../types'

const STATIC_BASE = ''

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${m}월 ${d}일`
}

export default function ParentAlbumDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { show: toast } = useToastStore()

  const [album,    setAlbum]    = useState<AlbumDetailParent | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    const albumId = Number(id)
    if (!albumId) { navigate('/parent/albums', { replace: true }); return }

    getParentAlbum(albumId)
      .then((data) => setAlbum(data.album))
      .catch((err: { status?: number }) => {
        if (err?.status === 403) {
          toast('접근 권한이 없습니다', 'error')
        } else {
          toast('앨범을 불러오지 못했습니다', 'error')
        }
        navigate('/parent/albums', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [id, navigate, toast])

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#FBF7F2' }}>
        <header className="bg-white border-b border-orange-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
            <span className="font-bold text-gray-800 text-base">앨범</span>
          </div>
        </header>
        <div className="flex justify-center items-center py-32">
          <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!album) return null

  return (
    <div className="min-h-screen" style={{ background: '#FBF7F2' }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-orange-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ←
          </button>
          <h1 className="font-bold text-gray-800 text-base flex-1 truncate">{album.title}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 앨범 정보 */}
        <div className="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
          <p className="text-xs text-orange-500 font-medium mb-1">
            {formatDate(album.activityDate)}
          </p>
          <h2 className="text-lg font-bold text-gray-800 mb-2 leading-tight">
            {album.title}
          </h2>
          {album.description && (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {album.description}
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-orange-50 text-xs text-gray-400">
            📷 사진 {album.photos.length}장 · 참여 {album.participants.length}명
          </div>
        </div>

        {/* 참여 어르신 */}
        {album.participants.length > 0 && (
          <div className="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">참여 어르신</p>
            <div className="flex flex-wrap gap-2">
              {album.participants.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1.5 bg-orange-50 border border-orange-100
                    text-orange-700 text-sm px-3 py-1.5 rounded-full"
                >
                  <span>👴</span>
                  <span className="font-medium">{p.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 사진 그리드 */}
        {album.photos.length > 0 ? (
          <div className="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              사진 ({album.photos.length}장)
            </p>
            <div className="grid grid-cols-2 gap-3">
              {album.photos.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightbox(photo.url)}
                  className="aspect-square overflow-hidden rounded-xl bg-orange-50
                    hover:opacity-90 transition-opacity cursor-zoom-in"
                >
                  <img
                    src={`${STATIC_BASE}${photo.url}`}
                    alt={`사진 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-orange-100 p-10 shadow-sm text-center">
            <p className="text-3xl mb-2">📷</p>
            <p className="text-gray-400 text-sm">등록된 사진이 없습니다</p>
          </div>
        )}
      </main>

      {/* 라이트박스 */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={`${STATIC_BASE}${lightbox}`}
            alt="사진 확대"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full
              text-white text-xl flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
