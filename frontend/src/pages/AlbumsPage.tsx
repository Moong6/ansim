/**
 * 7차 스프린트: 앨범 목록 /albums
 * - 월별 필터 (← → 이동)
 * - 3열 그리드 카드
 * - SOCIAL_WORKER/ADMIN: 등록 버튼 + 수정 가능
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import AlbumModal from '../components/AlbumModal'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { getAlbums } from '../api/albums'
import { fetchAllResidents } from '../api/residents'
import type { AlbumListItem, ResidentCard } from '../types'

const STATIC_BASE = ''

const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${m}월 ${d}일`
}

export default function AlbumsPage() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const { show: toast } = useToastStore()

  const canEdit = user?.role === 'CAREGIVER' || user?.role === 'SOCIAL_WORKER' || user?.role === 'ADMIN'

  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [albums,    setAlbums]    = useState<AlbumListItem[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [residents, setResidents] = useState<ResidentCard[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  // ── 데이터 로드 ─────────────────────────────────────────────────────────────
  const loadAlbums = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAlbums(year, month)
      setAlbums(data.items)
      setTotal(data.total)
    } catch {
      toast('앨범 목록을 불러오지 못했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [year, month, toast])

  useEffect(() => { loadAlbums() }, [loadAlbums])

  useEffect(() => {
    if (!canEdit) return
    fetchAllResidents()
      .then((data) => setResidents(data))
      .catch(() => {})
  }, [canEdit])

  // ── 월 이동 ─────────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else { setMonth((m) => m - 1) }
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else { setMonth((m) => m + 1) }
  }

  // ── 렌더 ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">앨범</h2>
            <p className="text-sm text-gray-500 mt-0.5">활동 사진을 모아보세요</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white text-sm font-semibold
                rounded-xl hover:bg-pink-600 transition-colors shadow-sm"
            >
              + 앨범 등록
            </button>
          )}
        </div>

        {/* 월 필터 */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center
              text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"
          >
            ‹
          </button>
          <span className="text-base font-semibold text-gray-800 min-w-[90px] text-center">
            {year}년 {MONTH_KO[month - 1]}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center
              text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"
          >
            ›
          </button>
        </div>

        {/* 건수 */}
        {!loading && (
          <p className="text-sm text-gray-500 mb-4">총 {total}개</p>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && albums.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📷</p>
            <p className="text-gray-500">이 달에 등록된 앨범이 없습니다</p>
            {canEdit && (
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 px-5 py-2 bg-pink-500 text-white text-sm font-semibold rounded-xl
                  hover:bg-pink-600 transition-colors"
              >
                첫 앨범 등록하기
              </button>
            )}
          </div>
        )}

        {/* 3열 그리드 */}
        {!loading && albums.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => navigate(`/albums/${album.id}`)}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm
                  hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 text-left"
              >
                {/* 썸네일 */}
                <div className="aspect-video bg-pink-50 flex items-center justify-center overflow-hidden">
                  {album.thumbnailUrl ? (
                    <img
                      src={`${STATIC_BASE}${album.thumbnailUrl}`}
                      alt={album.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">📷</span>
                  )}
                </div>

                {/* 정보 */}
                <div className="p-4">
                  <p className="text-xs text-pink-500 font-medium mb-1">
                    {formatDate(album.activityDate)}
                  </p>
                  <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 mb-2">
                    {album.title}
                  </h3>

                  {/* 참여자 */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {album.participants.slice(0, 4).map((p) => (
                      <span
                        key={p.id}
                        className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full"
                      >
                        {p.name}
                      </span>
                    ))}
                    {album.participants.length > 4 && (
                      <span className="text-xs text-gray-400">+{album.participants.length - 4}명</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                    <span>📷 {album.photoCount}장</span>
                    <span>{album.author.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* 등록 모달 */}
      {canEdit && (
        <AlbumModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          album={null}
          defaultDate={`${year}-${String(month).padStart(2,'0')}-01`}
          residents={residents}
          onSaved={loadAlbums}
        />
      )}
    </div>
  )
}
