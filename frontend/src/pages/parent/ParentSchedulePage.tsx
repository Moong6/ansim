/**
 * 보호자 일정표 /parent/schedule (읽기 전용)
 * 6차 스프린트
 */
import { useCallback, useEffect, useState } from 'react'
import ParentLayout from '../../components/ParentLayout'
import { useToastStore } from '../../store/toastStore'
import { getParentSchedule } from '../../api/schedule'
import type { ScheduleMonthParentResponse } from '../../types'

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

const EVENT_STYLE: Record<string, { icon: string; dateClass: string; titleClass: string; badgeClass: string }> = {
  HOLIDAY:       { icon: '🚩', dateClass: 'text-red-500',  titleClass: 'text-red-600',  badgeClass: 'bg-red-100 text-red-600'   },
  BIRTHDAY:      { icon: '🎁', dateClass: 'text-pink-500', titleClass: 'text-pink-600', badgeClass: 'bg-pink-100 text-pink-600' },
  FACILITY_EVENT:{ icon: '🎉', dateClass: 'text-blue-600', titleClass: 'text-gray-800', badgeClass: 'bg-blue-100 text-blue-700' },
}

function formatDateNum(dateStr: string): { day: number; weekday: string } {
  const d = new Date(dateStr + 'T00:00:00')
  return { day: d.getDate(), weekday: WEEKDAY_KO[d.getDay()] }
}

export default function ParentSchedulePage() {
  const { show: toast } = useToastStore()

  const now = new Date()
  const [year,  setYear]  = useState<number>(now.getFullYear())
  const [month, setMonth] = useState<number>(now.getMonth() + 1)
  const [data,  setData]  = useState<ScheduleMonthParentResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSchedule = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res = await getParentSchedule(y, m)
      setData(res)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '일정을 불러오지 못했습니다'
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadSchedule(year, month)
  }, [year, month, loadSchedule])

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }

  return (
    <ParentLayout title="일정표" back="/parent/home">
      {/* 월 네비 */}
      <div className="flex items-center justify-center gap-3 mb-4 bg-white rounded-2xl p-3
        border border-orange-100 shadow-sm">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500
            hover:bg-gray-100 transition-colors"
        >
          ◀
        </button>
        <span className="text-sm font-semibold text-gray-800 w-28 text-center">
          {year}년 {month}월
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500
            hover:bg-gray-100 transition-colors"
        >
          ▶
        </button>
      </div>

      {/* 월 그룹 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">
          {year}년 {month}월
        </span>
        <span className="text-xs text-gray-400">
          · 일정 {data?.events.length ?? 0}건
        </span>
      </div>

      {/* 일정 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-4xl mb-3">📅</span>
          <p className="text-sm">이번 달 일정이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.events.map((ev) => {
            const style    = EVENT_STYLE[ev.eventType]
            const dateParts = formatDateNum(ev.eventDate)

            return (
              <div
                key={ev.id}
                className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 flex items-start gap-4"
              >
                {/* 날짜 */}
                <div className={`shrink-0 w-12 text-center ${style.dateClass}`}>
                  <p className="text-2xl font-bold leading-none">{dateParts.day}</p>
                  <p className="text-xs mt-0.5">{dateParts.weekday}요일</p>
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badgeClass}`}>
                      {ev.eventType === 'HOLIDAY' ? '공휴일' : ev.eventType === 'BIRTHDAY' ? '생일' : '시설 행사'}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold ${style.titleClass}`}>{ev.title}</p>

                  {/* 생일: 어르신 정보 */}
                  {ev.eventType === 'BIRTHDAY' && ev.resident && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-xs">
                        👴
                      </div>
                      <span className="text-xs text-gray-500">
                        {ev.resident.name}
                        {ev.resident.roomNumber && ` · ${ev.resident.roomNumber}`}
                        {ev.resident.age && ` · ${ev.resident.age}세`}
                      </span>
                    </div>
                  )}

                  {ev.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ev.description}</p>
                  )}
                </div>

                {/* 아이콘 */}
                <div className="shrink-0">
                  <span className="text-2xl">{style.icon}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ParentLayout>
  )
}
