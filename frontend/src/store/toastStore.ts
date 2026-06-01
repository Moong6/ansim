import { create } from 'zustand'

type ToastType = 'success' | 'error'

interface ToastState {
  message: string | null
  type: ToastType
  show: (message: string, type?: ToastType) => void
  hide: () => void
}

// 모듈 스코프 타이머 (스토어 외부에 보관해야 set이 깔끔)
let timerId: number | null = null

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'success',

  show: (message, type = 'success') => {
    if (timerId !== null) window.clearTimeout(timerId)
    set({ message, type })
    timerId = window.setTimeout(() => {
      set({ message: null })
      timerId = null
    }, 3000)
  },

  hide: () => {
    if (timerId !== null) window.clearTimeout(timerId)
    timerId = null
    set({ message: null })
  },
}))
