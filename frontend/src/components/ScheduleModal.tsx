/**
 * 일정 등록·수정 모달
 * 6차 스프린트
 */
import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useToastStore } from '../store/toastStore'
import {
  createScheduleEvent,
  deleteScheduleEvent,
  updateScheduleEvent,
} from '../api/schedule'
import { fetchAssignedResidents } from '../api/residents'
import type { ScheduleEventItem, ScheduleEventType } from '../types'

const EVENT_TYPES: { value: ScheduleEventType; label: string; icon: string }[] = [
  { value: 'FACILITY_EVENT', label: '시설 행사', icon: '🎉' },
  { value: 'BIRTHDAY',       label: '생일',     icon: '🎁' },
  { value: 'HOLIDAY',        label: '공휴일',    icon: '🚩' },
]

interface ResidentOption {
  id:   number
  name: string
  roomNumber: string | null
}

interface ScheduleModalProps {
  open:    boolean
  onClose: () => void
  /** 수정 시 기존 데이터, 등록 시 null */
  event:   ScheduleEventItem | null
  /** 저장·삭제 완료 후 목록 갱신 콜백 */
  onSaved: () => void
}

// 오늘 날짜 YYYY-MM-DD
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ScheduleModal({
  open, onClose, event, onSaved,
}: ScheduleModalProps) {
  const { show: toast } = useToastStore()

  const [eventDate,   setEventDate]   = useState<string>(todayStr())
  const [eventType,   setEventType]   = useState<ScheduleEventType>('FACILITY_EVENT')
  const [title,       setTitle]       = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [residentId,  setResidentId]  = useState<number | null>(null)
  const [residents,   setResidents]   = useState<ResidentOption[]>([])
  const [dirty,       setDirty]       = useState(false)
  const [saving,      setSaving]      = useState(false)

  // 열릴 때 초기화 + 어르신 목록 로드
  useEffect(() => {
    if (!open) return
    if (event) {
      setEventDate(event.eventDate)
      setEventType(event.eventType)
      setTitle(event.title)
      setDescription(event.description ?? '')
      setResidentId(event.resident?.id ?? null)
    } else {
      setEventDate(todayStr())
      setEventType('FACILITY_EVENT')
      setTitle('')
      setDescription('')
      setResidentId(null)
    }
    setDirty(false)

    // 어르신 목록 (BIRTHDAY 선택 시 필요)
    fetchAssignedResidents()
      .then((res) =>
        setResidents(
          res.residents.map((r) => ({
            id: r.id,
            name: r.name,
            roomNumber: r.roomNumber,
          }))
        )
      )
      .catch(() => {/* 실패 시 빈 목록 */})
  }, [open, event])

  function markDirty() { setDirty(true) }

  async function handleBeforeClose(): Promise<boolean> {
    if (dirty) return confirm('변경 사항이 있습니다. 닫으시겠습니까?')
    return true
  }

  async function handleSave() {
    if (!title.trim()) {
      toast('제목을 입력해 주세요', 'error')
      return
    }
    if (title.length > 100) {
      toast('제목은 100자 이하여야 합니다', 'error')
      return
    }
    if (eventType === 'BIRTHDAY' && residentId === null) {
      toast('생일 일정에는 어르신 선택이 필요합니다', 'error')
      return
    }

    setSaving(true)
    try {
      const body = {
        eventDate,
        eventType,
        title: title.trim(),
        description: description.trim() || null,
        residentId: eventType === 'BIRTHDAY' ? residentId : null,
      }

      if (event) {
        await updateScheduleEvent(event.id, body)
        toast('일정이 수정되었습니다')
      } else {
        await createScheduleEvent(body)
        toast('일정이 등록되었습니다')
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
    if (!event) return
    if (!confirm('이 일정을 삭제하시겠습니까?')) return
    try {
      await deleteScheduleEvent(event.id)
      toast('일정이 삭제되었습니다')
      setDirty(false)
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '삭제 실패'
      toast(msg, 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? '일정 수정' : '일정 등록'}
      onBeforeClose={handleBeforeClose}
      maxWidth="max-w-lg"
      actions={
        <div className="flex items-center gap-2 w-full justify-between">
          {event && (
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
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium
                hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold
                hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 날짜 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => { setEventDate(e.target.value); markDirty() }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* 유형 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">유형</label>
          <div className="flex gap-2">
            {EVENT_TYPES.map((et) => (
              <label
                key={et.value}
                className={`flex-1 text-center cursor-pointer py-2 rounded-lg border text-xs font-medium
                  transition-all ${eventType === et.value
                    ? 'bg-blue-100 border-blue-400 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <input
                  type="radio"
                  name="eventType"
                  value={et.value}
                  checked={eventType === et.value}
                  onChange={() => {
                    setEventType(et.value)
                    if (et.value !== 'BIRTHDAY') setResidentId(null)
                    markDirty()
                  }}
                  className="sr-only"
                />
                <span className="block">{et.icon}</span>
                <span>{et.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 어르신 선택 (BIRTHDAY일 때만) */}
        {eventType === 'BIRTHDAY' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              어르신 <span className="text-red-500">*</span>
            </label>
            <select
              value={residentId ?? ''}
              onChange={(e) => {
                setResidentId(e.target.value ? Number(e.target.value) : null)
                markDirty()
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">어르신 선택</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.roomNumber ? `(${r.roomNumber})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 제목 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            maxLength={100}
            onChange={(e) => { setTitle(e.target.value); markDirty() }}
            placeholder="일정 제목"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">{title.length}/100</p>
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">설명 (선택)</label>
          <textarea
            value={description}
            maxLength={500}
            onChange={(e) => { setDescription(e.target.value); markDirty() }}
            placeholder="일정에 대한 설명을 입력하세요"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <p className="text-xs text-gray-400 text-right">{description.length}/500</p>
        </div>
      </div>
    </Modal>
  )
}
