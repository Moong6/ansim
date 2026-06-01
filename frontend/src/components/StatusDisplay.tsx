import type { StructuredStatus } from '../types'

interface StatusDisplayProps {
  status?: StructuredStatus
}

export default function StatusDisplay({ status }: StatusDisplayProps) {
  if (!status) return null

  const healthMap = {
    GOOD: { emoji: '🌟', label: '좋음' },
    NORMAL: { emoji: '🌤️', label: '보통' },
    NEEDS_OBSERVATION: { emoji: '🩺', label: '관찰 필요' },
  }

  const moodMap = {
    GOOD: { emoji: '😊', label: '좋음' },
    NORMAL: { emoji: '🙂', label: '보통' },
    ANXIOUS: { emoji: '😔', label: '다소 불편' },
  }

  const mealMap = {
    FULL: { emoji: '🍚', label: '완식' },
    NORMAL: { emoji: '🥄', label: '보통' },
    LITTLE: { emoji: '🌱', label: '조금' },
    REFUSED: { emoji: '—', label: '거의 못 드심' },
  }

  const health = healthMap[status.health]
  const mood = moodMap[status.mood]
  const meal = mealMap[status.meal]
  const showMed = status.medication === 'DONE'

  const columnsCount = 3 + (showMed ? 1 : 0)
  const gridColsClass = columnsCount === 4 ? 'grid-cols-4' : 'grid-cols-3'

  return (
    <div className={`grid ${gridColsClass} gap-2 mb-5`}>
      {/* 건강 */}
      {health && (
        <div className="bg-[#FFFDFB] border border-orange-100 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-2xl mb-1">{health.emoji}</span>
          <span className="text-[10px] text-gray-400 font-medium">건강</span>
          <span className="text-xs text-gray-700 font-bold mt-0.5">{health.label}</span>
        </div>
      )}
      {/* 기분 */}
      {mood && (
        <div className="bg-[#FFFDFB] border border-orange-100 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-2xl mb-1">{mood.emoji}</span>
          <span className="text-[10px] text-gray-400 font-medium">기분</span>
          <span className="text-xs text-gray-700 font-bold mt-0.5">{mood.label}</span>
        </div>
      )}
      {/* 식사 */}
      {meal && (
        <div className="bg-[#FFFDFB] border border-orange-100 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-2xl mb-1">{meal.emoji}</span>
          <span className="text-[10px] text-gray-400 font-medium">식사</span>
          <span className="text-xs text-gray-700 font-bold mt-0.5">{meal.label}</span>
        </div>
      )}
      {/* 투약 */}
      {showMed && (
        <div className="bg-[#FFFDFB] border border-orange-100 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-2xl mb-1">💊</span>
          <span className="text-[10px] text-gray-400 font-medium">투약</span>
          <span className="text-xs text-gray-700 font-bold mt-0.5">완료</span>
        </div>
      )}
    </div>
  )
}
