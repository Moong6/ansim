/**
 * 보호자 식단표 /parent/meals (읽기 전용)
 * 6차 스프린트
 */
import { useCallback, useEffect, useState } from 'react'
import ParentLayout from '../../components/ParentLayout'
import { useToastStore } from '../../store/toastStore'
import { getParentMeals } from '../../api/meals'
import type { MealItemParent, MealsDayParentResponse, MealType } from '../../types'

const MEAL_ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

const MEAL_META: Record<MealType, { icon: string; label: string; color: string }> = {
  BREAKFAST: { icon: '🌅', label: '아침', color: 'bg-orange-100 text-orange-700' },
  LUNCH:     { icon: '🍚', label: '점심', color: 'bg-green-100 text-green-700'  },
  DINNER:    { icon: '🌙', label: '저녁', color: 'bg-indigo-100 text-indigo-700' },
  SNACK:     { icon: '🍪', label: '간식', color: 'bg-yellow-100 text-yellow-700' },
}

const WEEKDAY_KO: Record<string, string> = {
  MONDAY: '월', TUESDAY: '화', WEDNESDAY: '수',
  THURSDAY: '목', FRIDAY: '금', SATURDAY: '토', SUNDAY: '일',
}

const BASE_URL = 'http://localhost:8000'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatDateKo(dateStr: string, weekday: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일 (${WEEKDAY_KO[weekday] ?? ''})`
}

export default function ParentMealsPage() {
  const { show: toast } = useToastStore()

  const today         = todayStr()
  const [currentDate, setCurrentDate] = useState<string>(today)
  const [dayData,     setDayData]     = useState<MealsDayParentResponse | null>(null)
  const [loading,     setLoading]     = useState(true)

  const loadMeals = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const data = await getParentMeals(date)
      setDayData(data)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '식단을 불러오지 못했습니다'
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadMeals(currentDate)
  }, [currentDate, loadMeals])

  const mealsMap = new Map<MealType, MealItemParent>(
    dayData?.meals.map((m) => [m.mealType, m]) ?? []
  )

  return (
    <ParentLayout title="오늘의 식단" back="/parent/home">
      {/* 날짜 네비 */}
      <div className="flex items-center justify-center gap-3 mb-4 bg-white rounded-2xl p-3
        border border-orange-100 shadow-sm">
        <button
          onClick={() => setCurrentDate((prev) => addDays(prev, -1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500
            hover:bg-gray-100 transition-colors"
        >
          ◀
        </button>

        <div className="text-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">
              {dayData ? formatDateKo(dayData.date, dayData.weekday) : currentDate}
            </span>
            {dayData?.isToday && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                오늘
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            if (currentDate < today) setCurrentDate((prev) => addDays(prev, 1))
          }}
          disabled={currentDate >= today}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500
            hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ▶
        </button>

        {currentDate !== today && (
          <button
            onClick={() => setCurrentDate(today)}
            className="ml-1 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600
              hover:bg-gray-200 transition-colors"
          >
            오늘로
          </button>
        )}
      </div>

      {/* 식사 4행 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {MEAL_ORDER.map((type) => {
            const meal = mealsMap.get(type)
            const meta = MEAL_META[type]

            if (meal) {
              return (
                <div
                  key={type}
                  className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden"
                >
                  <div className="flex gap-0">
                    {meal.photos.length > 0 ? (
                      <div className="flex-none w-[160px] flex gap-px">
                        {meal.photos.map((p, idx) => (
                          <img
                            key={idx}
                            src={`${BASE_URL}${p.url}`}
                            alt={`${meta.label} 사진${idx + 1}`}
                            className={`object-cover ${meal.photos.length > 1 ? 'w-1/2' : 'w-full'} h-[110px]`}
                            draggable={false}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex-none w-[50px] flex items-center justify-center
                        bg-orange-50 text-xl h-[110px]">
                        {meta.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {meal.photos.length === 0 && (
                          <span className="text-sm">{meta.icon}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                        {meal.menuText}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }

            // 빈 행 (보호자 읽기 전용)
            return (
              <div
                key={type}
                className="bg-white rounded-2xl border border-dashed border-orange-100 p-4"
              >
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="text-sm">{meta.label} 등록 예정</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ParentLayout>
  )
}
