/**
 * 직원 식단표 /meals
 * 6차 스프린트
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import MealModal from '../components/MealModal'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { getMeals } from '../api/meals'
import type { MealItem, MealsDayResponse, MealType } from '../types'

// ─── 상수 ─────────────────────────────────────────────────────────────────────

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

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────────

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

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function MealsPage() {
  const navigate      = useNavigate()
  const user          = useAuthStore((s) => s.user)
  const { show: toast } = useToastStore()

  const canEdit = user?.role === 'SOCIAL_WORKER' || user?.role === 'ADMIN'

  const [currentDate, setCurrentDate] = useState<string>(todayStr())
  const [dayData,     setDayData]     = useState<MealsDayResponse | null>(null)
  const [loading,     setLoading]     = useState(true)

  // 모달 상태
  const [modalOpen,        setModalOpen]        = useState(false)
  const [editMeal,         setEditMeal]         = useState<MealItem | null>(null)
  const [defaultMealType,  setDefaultMealType]  = useState<MealType>('BREAKFAST')

  const today = todayStr()

  const loadMeals = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const data = await getMeals(date)
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

  // 키보드 ←/→ 날짜 이동
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') {
        setCurrentDate((prev) => addDays(prev, -1))
      } else if (e.key === 'ArrowRight') {
        if (currentDate < today) setCurrentDate((prev) => addDays(prev, 1))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentDate, today])

  function openNewMeal(type: MealType) {
    setEditMeal(null)
    setDefaultMealType(type)
    setModalOpen(true)
  }

  function openEditMeal(meal: MealItem) {
    setEditMeal(meal)
    setDefaultMealType(meal.mealType)
    setModalOpen(true)
  }

  function handleModalSaved() {
    loadMeals(currentDate)
  }

  const mealsMap = new Map(dayData?.meals.map((m) => [m.mealType, m]) ?? [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 헤더 행 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/home')}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ← 홈
            </button>
            <h1 className="text-lg font-bold text-gray-800">🍱 식단표</h1>
          </div>
          {canEdit && (
            <button
              onClick={() => openNewMeal('BREAKFAST')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-white
                text-xs font-semibold hover:bg-green-600 transition-colors"
            >
              <span>+</span>
              <span>식단 등록</span>
            </button>
          )}
        </div>

        {/* 날짜 네비 */}
        <div className="flex items-center justify-center gap-3 mb-5 bg-white rounded-2xl p-3
          border border-gray-100 shadow-sm">
          <button
            onClick={() => setCurrentDate((prev) => addDays(prev, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500
              hover:bg-gray-100 transition-colors"
            aria-label="이전 날짜"
          >
            ◀
          </button>

          <div className="text-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">
                {dayData ? formatDateKo(dayData.date, dayData.weekday) : currentDate}
              </span>
              {dayData?.isToday && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
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
            aria-label="다음 날짜"
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
            <div className="w-8 h-8 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {MEAL_ORDER.map((type) => {
              const meal = mealsMap.get(type)
              const meta = MEAL_META[type]

              if (meal) {
                // 채워진 행
                return (
                  <div
                    key={type}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <div className="flex gap-0">
                      {/* 사진 영역 (최대 200px 폭) */}
                      {meal.photos.length > 0 ? (
                        <div className="flex-none w-[200px] flex gap-px">
                          {meal.photos.map((p, idx) => (
                            <img
                              key={idx}
                              src={`${BASE_URL}${p.url}`}
                              alt={`${meta.label} 사진${idx + 1}`}
                              className={`object-cover ${meal.photos.length > 1 ? 'w-1/2' : 'w-full'} h-[120px]`}
                              draggable={false}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex-none w-[60px] flex items-center justify-center
                          bg-gray-50 text-2xl h-[120px]">
                          {meta.icon}
                        </div>
                      )}

                      {/* 텍스트 영역 */}
                      <div className="flex-1 min-w-0 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            {meal.photos.length === 0 && (
                              <span className="text-sm">{meta.icon}</span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          {canEdit && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => openEditMeal(meal)}
                                className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50
                                  rounded-lg transition-colors text-xs"
                                title="수정"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                          {meal.menuText}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {meal.author.name}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              }

              // 빈 행 (직원)
              if (canEdit) {
                return (
                  <button
                    key={type}
                    onClick={() => openNewMeal(type)}
                    className="w-full text-left bg-white rounded-2xl border-2 border-dashed border-gray-200
                      p-4 hover:border-green-300 hover:bg-green-50/30 transition-all group"
                  >
                    <div className="flex items-center gap-2 text-gray-400 group-hover:text-green-600">
                      <span className="text-xl">{meta.icon}</span>
                      <span className="text-sm">{meta.label} 식단 등록하기</span>
                      <span className="ml-auto w-6 h-6 flex items-center justify-center rounded-full
                        bg-gray-100 group-hover:bg-green-100 text-xs font-bold transition-colors">
                        +
                      </span>
                    </div>
                  </button>
                )
              }

              // 빈 행 (CAREGIVER — 조회만)
              return (
                <div
                  key={type}
                  className="bg-white rounded-2xl border border-dashed border-gray-200 p-4"
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
      </main>

      <MealModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        meal={editMeal}
        defaultDate={currentDate}
        defaultMealType={defaultMealType}
        onSaved={handleModalSaved}
      />
    </div>
  )
}
