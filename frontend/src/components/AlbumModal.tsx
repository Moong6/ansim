/**
 * 7차 스프린트: 앨범 등록·수정 모달
 *
 * - 등록: album=null, mode='create'
 * - 수정: album=AlbumDetail, mode='edit'
 * - 사진 최대 10장, 멀티 업로드 지원
 * - 참여 어르신 체크박스 선택
 */
import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { useToastStore } from '../store/toastStore'
import { createAlbum, deleteAlbum, updateAlbum, uploadAlbumPhoto } from '../api/albums'
import type { AlbumDetail, ResidentCard } from '../types'

const STATIC_BASE = ''   // 상대경로 /static/... 사용

interface AlbumModalProps {
  open:      boolean
  onClose:   () => void
  /** 수정 시 기존 데이터, 등록 시 null */
  album:     AlbumDetail | null
  /** 등록 시 날짜 기본값 */
  defaultDate?: string
  /** 시설 어르신 목록 (참여자 선택용) */
  residents: ResidentCard[]
  /** 저장·삭제 완료 후 콜백 */
  onSaved:   () => void
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AlbumModal({
  open, onClose, album, defaultDate, residents, onSaved,
}: AlbumModalProps) {
  const { show: toast } = useToastStore()

  // ── form state ──────────────────────────────────────────────────────────────
  const [activityDate,   setActivityDate]   = useState<string>(defaultDate ?? todayStr())
  const [title,          setTitle]          = useState<string>('')
  const [description,    setDescription]    = useState<string>('')
  const [selectedIds,    setSelectedIds]    = useState<Set<number>>(new Set())
  const [photoUrls,      setPhotoUrls]      = useState<string[]>([])
  const [uploading,      setUploading]      = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [dirty,          setDirty]          = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── open 시 초기화 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    if (album) {
      setActivityDate(album.activityDate)
      setTitle(album.title)
      setDescription(album.description ?? '')
      setSelectedIds(new Set(album.participants.map((p) => p.id)))
      setPhotoUrls(album.photos.map((p) => p.url))
    } else {
      setActivityDate(defaultDate ?? todayStr())
      setTitle('')
      setDescription('')
      setSelectedIds(new Set())
      setPhotoUrls([])
    }
    setDirty(false)
  }, [open, album, defaultDate])

  function mark() { setDirty(true) }

  async function handleClose() {
    if (dirty && !confirm('변경 사항이 있습니다. 닫으시겠습니까?')) return
    onClose()
  }

  // ── 사진 업로드 ─────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (photoUrls.length + files.length > 10) {
      toast(`사진은 최대 10장까지 등록할 수 있습니다 (현재 ${photoUrls.length}장)`, 'error')
      return
    }
    setUploading(true)
    mark()
    try {
      const newUrls: string[] = []
      for (const file of files) {
        const res = await uploadAlbumPhoto(file)
        newUrls.push(res.url)
      }
      setPhotoUrls((prev) => [...prev, ...newUrls])
    } catch {
      toast('사진 업로드에 실패했습니다', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removePhoto(url: string) {
    setPhotoUrls((prev) => prev.filter((u) => u !== url))
    mark()
  }

  // ── 어르신 체크박스 ─────────────────────────────────────────────────────────
  function toggleResident(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    mark()
  }

  // ── 저장 ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim()) { toast('제목을 입력해 주세요', 'error'); return }
    if (selectedIds.size === 0) { toast('참여 어르신을 1명 이상 선택해 주세요', 'error'); return }

    const body = {
      activityDate,
      title:       title.trim(),
      description: description.trim() || null,
      residentIds: [...selectedIds],
      photos:      photoUrls.map((url) => ({ url })),
    }

    setSaving(true)
    try {
      if (album) {
        await updateAlbum(album.id, body)
        toast('앨범이 수정되었습니다')
      } else {
        await createAlbum(body)
        toast('앨범이 등록되었습니다')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { apiError?: { message: string } })?.apiError?.message ?? '저장에 실패했습니다'
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── 삭제 ────────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!album) return
    if (!confirm('앨범을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    setDeleting(true)
    try {
      await deleteAlbum(album.id)
      toast('앨범이 삭제되었습니다')
      onSaved()
      onClose()
    } catch {
      toast('삭제에 실패했습니다', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // ── 렌더 ────────────────────────────────────────────────────────────────────
  const isEdit = album !== null

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? '앨범 수정' : '앨범 등록'}>
      <div className="space-y-5">

        {/* 활동 날짜 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">활동 날짜 <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={activityDate}
            onChange={(e) => { setActivityDate(e.target.value); mark() }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제목 <span className="text-red-500">*</span></label>
          <input
            type="text"
            maxLength={100}
            value={title}
            onChange={(e) => { setTitle(e.target.value); mark() }}
            placeholder="앨범 제목을 입력하세요"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
          <textarea
            maxLength={500}
            rows={3}
            value={description}
            onChange={(e) => { setDescription(e.target.value); mark() }}
            placeholder="활동 설명을 입력하세요"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/500</p>
        </div>

        {/* 참여 어르신 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            참여 어르신 <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-gray-400 font-normal">({selectedIds.size}명 선택)</span>
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2">
            {residents.map((r) => (
              <label
                key={r.id}
                className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-pink-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleResident(r.id)}
                  className="accent-pink-500"
                />
                <span className="text-sm text-gray-700 truncate">{r.name}</span>
                <span className="text-xs text-gray-400">{r.roomNumber}호</span>
              </label>
            ))}
          </div>
        </div>

        {/* 사진 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            사진
            <span className="ml-2 text-xs text-gray-400 font-normal">({photoUrls.length}/10)</span>
          </label>

          {/* 사진 미리보기 그리드 */}
          {photoUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {photoUrls.map((url) => (
                <div key={url} className="relative aspect-square group">
                  <img
                    src={`${STATIC_BASE}${url}`}
                    alt=""
                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs
                      opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 업로드 버튼 */}
          {photoUrls.length < 10 && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-pink-200 rounded-lg py-3 text-sm text-pink-500
                  hover:bg-pink-50 transition-colors disabled:opacity-50"
              >
                {uploading ? '업로드 중...' : '📷 사진 추가 (최대 10장)'}
              </button>
            </>
          )}
        </div>

        {/* 버튼 영역 */}
        <div className={`flex gap-2 pt-2 ${isEdit ? 'justify-between' : 'justify-end'}`}>
          {/* 삭제 버튼 (수정 모드 + canEdit) */}
          {isEdit && album?.canEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200
                hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          )}

          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleClose}
              disabled={saving || deleting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200
                hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploading || deleting}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-pink-500
                hover:bg-pink-600 transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : isEdit ? '수정 완료' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
