/**
 * 공용 모달 컴포넌트
 * 6차 스프린트: 식단·일정 등록/수정/상세에서 공용 재사용
 * 7차 앨범에서도 재사용 가능하도록 범용성 유지
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  /** 모달 표시 여부 */
  open: boolean
  /** 닫기 요청 (X 버튼 / 배경 클릭) */
  onClose: () => void
  /** 헤더 제목 */
  title: string
  /** 본문 */
  children: React.ReactNode
  /** 푸터 버튼 목록 */
  actions?: React.ReactNode
  /**
   * 닫기 전 확인 콜백. 반환값이 false면 닫기 차단.
   * async도 지원: Promise<boolean> 반환 가능
   */
  onBeforeClose?: () => boolean | Promise<boolean>
  /** 모달 폭 (Tailwind max-w-* 클래스) */
  maxWidth?: string
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  onBeforeClose,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 모달 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleClose() {
    if (onBeforeClose) {
      const ok = await onBeforeClose()
      if (!ok) return
    }
    onClose()
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) {
      handleClose()
    }
  }

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div
        className={`
          relative bg-white rounded-2xl shadow-xl w-full ${maxWidth}
          flex flex-col max-h-[90vh]
          animate-in fade-in slide-in-from-bottom-4 duration-200
        `}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
              hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>

        {/* 푸터 */}
        {actions && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
