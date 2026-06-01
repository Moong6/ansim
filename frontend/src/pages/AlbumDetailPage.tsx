/**
 * 7차 스프린트: 앨범 상세 /albums/:id
 * - 사진 그리드 (클릭 → 라이트박스)
 * - 참여자 칩
 * - canEdit: 수정 모달 오픈
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import AlbumModal from '../components/AlbumModal'
import { useToastStore } from '../store/toastStore'
import { getAlbum } from '../api/albums'
import { fetchAllResidents } from '../api/residents'
import type { AlbumDetail, ResidentCard } from '../types'

const STATIC_BASE = ''

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${m}월 ${d}일`
}

export default function AlbumDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { show: toast } = useToastStore()

  const [album,     setAlbum]     = useState<AlbumDetail | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [residents, setResidents] = useState<ResidentCard[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [lightbox,  setLightbox]  = useState<string | null>(null)  // 라이트박스 URL

  const albumId = Number(id)

  const loadAlbum = useCallback(async () => {
    if (!albumId) return
    setLoading(true)
    try {
      const data = await getAlbum(albumId)
      setAlbum(data.album)
    } catch {
      toast('앨범을 불러오지 못했습니다', 'error')
      navigate('/albums', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [albumId, toast, navigate])

  useEffect(() => { loadAlbum() }, [loadAlbum])

  useEffect(() => {
    if (!album?.canEdit) return
    fetchAllResidents()
      .then((data) => setResidents(data))
      .catch(() => {})
  }, [album?.canEdit])

  function handleSaved() {
    loadAlbum()
    setModalOpen(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex justify-center items-center py-32">
          <div className="w-10 h-10 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!album) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 뒤로가기 */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          ← 목록으로
        </button>

        {/* 앨범 헤더 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-pink-500 font-medium mb-1">
                {formatDate(album.activityDate)}
              </p>
              <h2 className="text-xl font-bold text-gray-800 mb-2 leading-tight">
                {album.title}
              </h2>
              {album.description && (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {album.description}
                </p>
              )}
            </div>

            {album.canEdit && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex-shrink-0 px-4 py-2 border border-pink-200 text-pink-600 text-sm font-medium
                  rounded-xl hover:bg-pink-50 transition-colors"
              >
                수정
              </button>
            )}
          </div>

          {/* 메타 정보 */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>✍️ {album.author.name}</span>
            <span>📷 사진 {album.photos.length}장</span>
            <span>👥 {album.participants.length}명 참여</span>
          </div>
        </div>

        {/* 참여자 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-3">참여 어르신</p>
          <div className="flex flex-wrap gap-2">
            {album.participants.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-1.5 bg-pink-50 border border-pink-100 text-pink-700
                  text-sm px-3 py-1.5 rounded-full"
              >
                <span>👴</span>
                <span className="font-medium">{p.name}</span>
                {p.roomNumber && <span className="text-pink-400 text-xs">{p.roomNumber}호</span>}
              </span>
            ))}
          </div>
        </div>

        {/* 사진 그리드 */}
        {album.photos.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">사진 ({album.photos.length}장)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {album.photos.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightbox(photo.url)}
                  className="aspect-square overflow-hidden rounded-xl bg-gray-100
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
          <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm text-center">
            <p className="text-3xl mb-2">📷</p>
            <p className="text-gray-400 text-sm">등록된 사진이 없습니다</p>
          </div>
        )}
      </main>

      {/* 수정 모달 */}
      {album.canEdit && (
        <AlbumModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          album={album}
          residents={residents}
          onSaved={handleSaved}
        />
      )}

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
