/**
 * 7차 스프린트: 보호자 앨범 목록 /parent/albums
 * - 본인 어르신 참여 앨범만 표시
 * - 월별 필터 (← → 이동)
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getParentAlbums } from '../../api/albums'
import { useToastStore } from '../../store/toastStore'
import type { AlbumListItemParent } from '../../types'

const STATIC_BASE = ''
const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${m}월 ${d}일`
}

export default function ParentAlbumsPage() {
  const navigate = useNavigate()
  const { show: toast } = useToastStore()

  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [albums,  setAlbums]  = useState<AlbumListItemParent[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)

  const loadAlbums = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getParentAlbums(year, month)
      setAlbums(data.items)
      setTotal(data.total)
    } catch {
      toast('앨범 목록을 불러오지 못했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [year, month, toast])

  useEffect(() => { loadAlbums() }, [loadAlbums])

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else { setMonth((m) => m - 1) }
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else { setMonth((m) => m + 1) }
  }

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
          <h1 className="font-bold text-gray-800 text-base">앨범</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* 월 필터 */}
        <div className="flex items-center justify-center gap-4 mb-5">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-full bg-white border border-orange-200 flex items-center justify-center
              text-orange-500 hover:bg-orange-50 transition-colors shadow-sm"
          >
            ‹
          </button>
          <span className="text-base font-semibold text-gray-800 min-w-[90px] text-center">
            {year}년 {MONTH_KO[month - 1]}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-full bg-white border border-orange-200 flex items-center justify-center
              text-orange-500 hover:bg-orange-50 transition-colors shadow-sm"
          >
            ›
          </button>
        </div>

        {/* 건수 */}
        {!loading && (
          <p className="text-sm text-gray-500 mb-4">
            {residentNames(albums)} 어르신이 참여한 활동 {total}건
          </p>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && albums.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📷</p>
            <p className="text-gray-500">이 달에 참여한 활동이 없습니다</p>
          </div>
        )}

        {/* 목록 */}
        {!loading && albums.length > 0 && (
          <div className="space-y-4">
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => navigate(`/parent/albums/${album.id}`)}
                className="w-full bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm
                  hover:shadow-md transition-all duration-150 text-left"
              >
                <div className="flex gap-4 p-4">
                  {/* 썸네일 */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-xl bg-orange-50 overflow-hidden
                    flex items-center justify-center">
                    {album.thumbnailUrl ? (
                      <img
                        src={`${STATIC_BASE}${album.thumbnailUrl}`}
                        alt={album.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">📷</span>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-orange-500 font-medium mb-0.5">
                      {formatDate(album.activityDate)}
                    </p>
                    <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 mb-2">
                      {album.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex flex-wrap gap-1">
                        {album.participants.map((p) => (
                          <span key={p.id} className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">
                            {p.name}
                          </span>
                        ))}
                      </span>
                      <span>📷 {album.photoCount}장</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// 참여 어르신 이름 요약
function residentNames(albums: AlbumListItemParent[]): string {
  const names = new Set<string>()
  albums.forEach((a) => a.participants.forEach((p) => names.add(p.name)))
  if (names.size === 0) return ''
  return [...names].join(', ')
}
