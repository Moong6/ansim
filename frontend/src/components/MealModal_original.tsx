/**
 * 식단 등록·수정·상세 모달 (공용)
 * 6차 스프린트
 */
import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { useToastStore } from '../store/toastStore'
import { createMeal, deleteMeal, updateMeal } from '../api/meals'
import { uploadMealPhoto } from '../api/uploads'
import type { MealItem, MealType, PhotoItem } from '../types'

const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'BREAKFAST', label: '아침', icon: '🌅' },
  { value: 'LUNCH',     label: '점심', icon: '🍚' },
  { value: 'DINNER',    label: '저녁', icon: '🌙' },
  { value: 'SNACK',     label: '간식', icon: '🍪' },
]

interface MealModalProps {
  open:      boolean
  onClose:   () => void
  /** 수정 시 기존 데이터, 등록 시 null */
  meal:      MealItem | null
  /** 등록 시 자동 채울 날짜 "YYYY-MM-DD" */
  defaultDate?:    string
  /** 등록 시 자동 채울 식사 구분 */
  defaultMealType?: MealType
  /** 저장·삭제 완료 후 목록 갱신 콜백 */
  onSaved:   () => void
  /** 읽기 전용 여부 (보호자) */
  readOnly?: boolean
}

// 오늘 날짜 YYYY-MM-DD
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function MealModal({
  open, onClose, meal, defaultDate, defaultMealType, onSaved, readOnly = false,
}: MealModalProps) {
  const { show: toast } = useToastStore()

  // form state
  const [mealDate,  setMealDate]  = useState<string>(defaultDate ?? todayStr())
  const [mealType,  setMealType]  = useState<MealType>(defaultMealType ?? 'BREAKFAST')
  const [menuText,  setMenuText]  = useState<string>('')
  const [photos,    setPhotos]    = useState<PhotoItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [dirty,     setDirty]     = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 수정 모달: 기존 값 채우기
  useEffect(() => {
    if (!open) return
    if (meal) {
      setMealDate(meal.createdAt.slice(0, 10))   // createdAt은 힌트용 — 실제는 mealDate 필드가 없음
      setMealType(meal.mealType)
      setMenuText(meal.menuText)
      setPhotos(meal.photos)
    } else {
      setMealDate(defaultDate ?? todayStr())
      setMealType(defaultMealType ?? 'BREAKFAST')
      setMenuText('')
      setPhotos([])
    }
    setDirty(false)
  }, [open, meal, defaultDate, defaultMealType])

  function markDirty() { setDirty(true) }

  async function handleClose() {
    if (dirty && !readOnly) {
      if (!confirm('변경 사항이 있습니다. 닫으시겠습니까?')) return
    }
    onClose()
  }

  async function handleBeforeClose(): Promise<boolean> {
    if (dirty && !readOnly) {
      return confirm('변경 사항이 있습니다. 닫으시겠습니까?')
    }
    return true
  }

  // 사진 업로드
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (photos.length + files.length > 2) {
      toast('사진은 최대 2장까지 등록할 수 있습니다', 'error')
      return
    }

    setUploading(true)
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast(`${file.name}: 5MB를 초과하여 업로드할 수 없습니다`, 'error')
        continue
      }
      try {
        const result = await uploadMealPhoto(file)
        setPhotos((prev) => [...prev, { url: result.url }])
        markDirty()
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? '업로드 실패'
        toast(msg, 'error')
      }
    }
    setUploading(false)
    // input 초기화 (같은 파일 재선택 허용)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
    markDirty()
  }

  async function handleSave() {
    if (!menuText.trim()) {
      toast('메뉴를 입력해 주세요', 'error')
      return
    }
    setSaving(true)
    try {
      if (meal) {
        // 수정
        await updateMeal(meal.id, {
          mealType,
          menuText: menuText.trim(),
          photos,
        })
        toast('식단이 수정되었습니다')
      } else {
        // 등록
        await createMeal({
          mealDate,
          mealType,
          menuText: menuText.trim(),
          photos,
        })
        toast('식단이 등록되었습니다')
      }
      setDirty(false)
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '저장 실패'
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!meal) return
    if (!confirm('이 식단을 삭제하시겠습니까?')) return
    try {
      await deleteMeal(meal.id)
      toast('식단이 삭제되었습니다')
      setDirty(false)
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '삭제 실패'
      toast(msg, 'error')
    }
  }

  const mealMeta = MEAL_TYPES.find((m) => m.value === mealType)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={readOnly ? `${mealMeta?.icon} ${mealMeta?.label} 식단` : (meal ? '식단 수정' : '식단 등록')}
      onBeforeClose={handleBeforeClose}
      maxWidth="max-w-lg"
      actions={
        readOnly ? (
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium
              hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full justify-between">
            {meal && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium
                  hover:bg-red-100 transition-colors"
              >
                삭제
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium
                  hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-semibold
                  hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {/* 날짜 */}
        {!readOnly && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
            <input
              type="date"
              value={mealDate}
              max={todayStr()}
              disabled={!!meal}  // 수정 시 날짜 변경 불가
              onChange={(e) => { setMealDate(e.target.value); markDirty() }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-400
                disabled:bg-gray-50 disabled:text-gray-400"
            />
            {meal && (
              <p className="text-xs text-gray-400 mt-1">
                날짜 변경은 삭제 후 재등록해 주세요
              </p>
            )}
          </div>
        )}

        {/* 식사구분 */}
        {!readOnly && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">식사구분</label>
            <div className="flex gap-2">
              {MEAL_TYPES.map((mt) => (
                <label
                  key={mt.value}
                  className={`flex-1 text-center cursor-pointer py-2 rounded-lg border text-xs font-medium
                    transition-all ${mealType === mt.value
                      ? 'bg-green-100 border-green-400 text-green-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <input
                    type="radio"
                    name="mealType"
                    value={mt.value}
                    checked={mealType === mt.value}
                    onChange={() => { setMealType(mt.value); markDirty() }}
                    className="sr-only"
                  />
                  <span className="block">{mt.icon}</span>
                  <span>{mt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 사진 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            사진 ({photos.length}/2)
          </label>
          <div className="flex gap-2 flex-wrap">
            {photos.map((p, idx) => (
              <div key={idx} className="relative w-24 h-24">
                <img
                  src={`http://localhost:8000${p.url}`}
                  alt={`사진${idx + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-gray-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.png'
                  }}
                />
                {!readOnly && (
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full
                      text-xs flex items-center justify-center hover:bg-red-600"
                    aria-label="사진 제거"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!readOnly && photos.length < 2 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg
                  flex flex-col items-center justify-center gap-1 text-gray-400
                  hover:border-green-400 hover:text-green-500 transition-colors
                  disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-xl">+</span>
                    <span className="text-xs">사진 추가</span>
                  </>
                )}
              </button>
            )}
            {photos.length === 0 && readOnly && (
              <span className="text-xs text-gray-400">사진 없음</span>
            )}
          </div>
          {!readOnly && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          )}
        </div>

        {/* 메뉴 텍스트 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">메뉴</label>
          {readOnly ? (
            <div className="whitespace-pre-line text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 min-h-[80px]">
              {menuText || <span className="text-gray-400">메뉴 정보 없음</span>}
            </div>
          ) : (
            <textarea
              value={menuText}
              onChange={(e) => { setMenuText(e.target.value); markDirty() }}
              placeholder={'예)\n잡곡밥\n된장국\n계란찜'}
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
