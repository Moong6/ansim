import { type ResidentCard as ResidentCardType } from '../types'

interface Props {
  resident: ResidentCardType
  selected: boolean
  onClick: () => void
}

export default function ResidentCard({ resident, selected, onClick }: Props) {
  const isDone = resident.todayStatus === 'SENT'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative p-4 rounded-xl text-left transition-all
        bg-white border-2
        ${selected
          ? 'border-teal-500 shadow-md ring-4 ring-teal-100'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
        }
      `}
    >
      {/* ── 상태 뱃지 (우측 상단) ── */}
      <div className="absolute top-3 right-3">
        {isDone ? (
          <span
            className="
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full
              bg-teal-50 text-teal-700 text-xs font-medium
              border border-teal-200
            "
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z"
                clipRule="evenodd" />
            </svg>
            작성완료
          </span>
        ) : (
          <span
            className="
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full
              bg-gray-50 text-gray-500 text-xs font-medium
              border border-gray-200
            "
          >
            <span className="w-2 h-2 rounded-full border border-gray-400" />
            미작성
          </span>
        )}
      </div>

      {/* ── 프로필 + 이름 + 정보 ── */}
      <div className="flex items-start gap-3 pr-16">
        {/* 프로필 (없으면 이니셜 원형) */}
        {resident.profileImageUrl ? (
          <img
            src={resident.profileImageUrl}
            alt={resident.name}
            className="w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-teal-700">
              {resident.name.charAt(0)}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-800 text-base leading-tight">{resident.name}</p>
          <p className="text-xs text-gray-500 mt-1">
            {resident.age}세 · {resident.roomNumber ?? '호실 미지정'}
          </p>
          {resident.careLevel && (
            <p className="text-xs text-gray-400 mt-0.5">{resident.careLevel}</p>
          )}
        </div>
      </div>
    </button>
  )
}
