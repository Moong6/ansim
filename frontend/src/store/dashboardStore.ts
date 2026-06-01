import { create } from 'zustand'
import { type Program, type ResidentCard } from '../types'
import { fetchTodayPrograms } from '../api/programs'
import { fetchAssignedResidents } from '../api/residents'
import { ApiException } from '../api/client'

interface DashboardState {
  // ── 데이터 ──────────────────────────────────────────────────────────────────
  programs: Program[]
  residents: ResidentCard[]
  summary: { total: number; completed: number }

  // ── 로딩/에러 ───────────────────────────────────────────────────────────────
  programsLoading: boolean
  programsError: string | null
  residentsLoading: boolean
  residentsError: string | null

  // ── 선택 상태 (S3/S4 활성화 트리거) ────────────────────────────────────────
  selectedResidentId: number | null

  // ── 액션 ────────────────────────────────────────────────────────────────────
  loadPrograms: () => Promise<void>
  loadResidents: () => Promise<void>
  selectResident: (id: number | null) => void
  /** 전송 성공 후 S2 카드를 SENT로 갱신 + 진행률 업데이트 */
  markResidentSent: (residentId: number, noticeId: number, sentAt: string) => void
  reset: () => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  programs: [],
  residents: [],
  summary: { total: 0, completed: 0 },

  programsLoading: false,
  programsError: null,
  residentsLoading: false,
  residentsError: null,

  selectedResidentId: null,

  loadPrograms: async () => {
    set({ programsLoading: true, programsError: null })
    try {
      const res = await fetchTodayPrograms()
      set({ programs: res.programs, programsLoading: false })
    } catch (e) {
      // ApiException(401)은 App.tsx의 AuthGuard가 처리 → 여기선 일반 에러만
      const msg =
        e instanceof ApiException
          ? e.error.message
          : '프로그램을 불러오지 못했습니다.'
      set({ programsError: msg, programsLoading: false })
    }
  },

  loadResidents: async () => {
    set({ residentsLoading: true, residentsError: null })
    try {
      const res = await fetchAssignedResidents()
      set({
        residents: res.residents,
        summary: res.summary,
        residentsLoading: false,
      })
    } catch (e) {
      const msg =
        e instanceof ApiException
          ? e.error.message
          : '어르신 목록을 불러오지 못했습니다.'
      set({ residentsError: msg, residentsLoading: false })
    }
  },

  selectResident: (id) => set({ selectedResidentId: id }),

  markResidentSent: (residentId, noticeId, sentAt) =>
    set((s) => {
      const before = s.residents.find((r) => r.id === residentId)
      const wasAlreadySent = before?.todayStatus === 'SENT'

      const updated = s.residents.map((r) =>
        r.id === residentId
          ? { ...r, todayStatus: 'SENT' as const, todayNoticeId: noticeId, sentAt }
          : r
      )
      // 미작성 우선 유지 — NONE이 앞으로
      updated.sort((a, b) => (a.todayStatus === b.todayStatus ? 0 : a.todayStatus === 'NONE' ? -1 : 1))

      return {
        residents: updated,
        summary: {
          ...s.summary,
          completed: wasAlreadySent ? s.summary.completed : s.summary.completed + 1,
        },
      }
    }),

  reset: () =>
    set({
      programs: [],
      residents: [],
      summary: { total: 0, completed: 0 },
      programsError: null,
      residentsError: null,
      selectedResidentId: null,
    }),
}))
