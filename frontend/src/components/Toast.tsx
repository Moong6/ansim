import { useToastStore } from '../store/toastStore'

export default function Toast() {
  const message = useToastStore((s) => s.message)
  const type    = useToastStore((s) => s.type)
  const hide    = useToastStore((s) => s.hide)

  if (!message) return null

  const isSuccess = type === 'success'

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div
        role="status"
        className={`
          pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-lg shadow-lg
          text-sm font-medium
          ${isSuccess
            ? 'bg-teal-600 text-white'
            : 'bg-red-600 text-white'}
        `}
      >
        {isSuccess ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z"
              clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1z"
              clipRule="evenodd" />
          </svg>
        )}
        <span>{message}</span>
        <button
          type="button"
          onClick={hide}
          className="ml-2 text-white/70 hover:text-white"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
