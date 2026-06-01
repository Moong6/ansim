import { create } from 'zustand'
import {
  type Draft,
  type Lang,
  type NoticeDetail,
  type StructuredStatus,
  type Tone,
  type AppliedProgram,
} from '../types'
import { fetchNotice, generateDrafts, refineText, sendNotice } from '../api/notices'
import { ApiException } from '../api/client'
import { useDashboardStore } from './dashboardStore'
import { useToastStore } from './toastStore'
import { useAuthStore } from './authStore'
import { clearDraft, loadDraft } from '../utils/draftStorage'

// ─── 상태 정의 ────────────────────────────────────────────────────────────────

type Mode = 'editing' | 'reading'

interface NoticeState {
  // ── 모드 (작성 vs 읽기 전용) ───────────────────────────────────────────────
  mode: Mode
  readingNotice: NoticeDetail | null
  readingLoading: boolean
  readingError: string | null

  // ── 작성 입력 ───────────────────────────────────────────────────────────────
  participatedProgramIds: number[]
  status: Partial<StructuredStatus>
  memo: string
  tone: Tone
  memoLang: Lang    // 2차: 현재 메모 입력 언어

  // ── AI 결과 ────────────────────────────────────────────────────────────────
  drafts: Draft[] | null
  softenedCount: number
  appliedPrograms: AppliedProgram[]
  generating: boolean
  generateError: string | null

  // ── S4 선택/편집 ───────────────────────────────────────────────────────────
  selectedDraftIndex: number | null
  editedText: string
  isRefined: boolean
  refining: boolean

  // ── 전송 ────────────────────────────────────────────────────────────────────
  previousNoticeId: number | null    // 재전송 시 v+1 처리용
  sending: boolean
  sendError: string | null
  justSentNoticeId: number | null

  // ── 액션 ────────────────────────────────────────────────────────────────────
  /** 작성 모드 진입 (LS 복원 또는 빈 상태 초기화) */
  enterEditingMode: (residentId: number, allProgramIds: number[]) => void
  /** 읽기 전용 모드 진입 (✅ 카드 클릭) */
  enterReadingMode: (noticeId: number) => Promise<void>
  /** 읽기 → 작성 전환 ([수정하여 재전송하기]) — 상태값/체크/메모만 복원 */
  restoreForResend: () => void

  setParticipatedPrograms: (ids: number[]) => void
  toggleProgram: (id: number) => void
  setStatusField: <K extends keyof StructuredStatus>(field: K, value: StructuredStatus[K]) => void
  setMemo: (memo: string) => void
  appendMemo: (text: string) => void
  setTone: (tone: Tone) => void
  setMemoLang: (lang: Lang) => void    // 2차

  generate: (residentId: number) => Promise<void>

  selectDraft: (index: number) => void
  setEditedText: (text: string) => void

  refine: () => Promise<void>

  send: (residentId: number) => Promise<void>
  clearJustSent: () => void

  /** S2 카드 클릭 시 "이동해도 안전한가?" 검사 (방어 1) */
  hasUnsavedWork: () => boolean

  reset: () => void
}

// ─── 초기값 ───────────────────────────────────────────────────────────────────

const initial = {
  mode: 'editing' as Mode,
  readingNotice: null as NoticeDetail | null,
  readingLoading: false,
  readingError: null as string | null,

  participatedProgramIds: [] as number[],
  status: {} as Partial<StructuredStatus>,
  memo: '',
  tone: 'POLITE' as Tone,
  memoLang: 'ko' as Lang,

  drafts: null as Draft[] | null,
  softenedCount: 0,
  appliedPrograms: [] as AppliedProgram[],
  generating: false,
  generateError: null as string | null,

  selectedDraftIndex: null as number | null,
  editedText: '',
  isRefined: false,
  refining: false,

  previousNoticeId: null as number | null,
  sending: false,
  sendError: null as string | null,
  justSentNoticeId: null as number | null,
}

// ─── 스토어 ───────────────────────────────────────────────────────────────────

export const useNoticeStore = create<NoticeState>((set, get) => ({
  ...initial,

  // ── 모드 진입 ──────────────────────────────────────────────────────────────
  enterEditingMode: (residentId, allProgramIds) => {
    const user = useAuthStore.getState().user
    const userLang: Lang = user?.preferredLang ?? 'ko'
    const restored = user ? loadDraft(user.id, residentId) : null

    if (restored) {
      // localStorage 복원: 사용자가 한 입력 그대로 살리기
      set({
        ...initial,
        mode: 'editing',
        participatedProgramIds: restored.participatedProgramIds,
        status: restored.status,
        memo: restored.memo,
        tone: restored.tone,
        memoLang: userLang,
      })
      useToastStore.getState().show('작성 중이던 내용을 복원했습니다', 'success')
    } else {
      // 신규: 프로그램 전체 체크 + 직원 기본 언어 기본값
      set({
        ...initial,
        mode: 'editing',
        participatedProgramIds: allProgramIds,
        memoLang: userLang,
      })
    }
  },

  enterReadingMode: async (noticeId) => {
    set({
      ...initial,
      mode: 'reading',
      readingLoading: true,
    })
    try {
      const res = await fetchNotice(noticeId)
      set({ readingNotice: res.notice, readingLoading: false })
    } catch (e) {
      const msg =
        e instanceof ApiException ? e.error.message : '알림장을 불러오지 못했습니다.'
      set({ readingLoading: false, readingError: msg })
    }
  },

  restoreForResend: () => {
    const n = get().readingNotice
    if (!n) return
    const userLang: Lang = useAuthStore.getState().user?.preferredLang ?? 'ko'
    set({
      ...initial,
      mode: 'editing',
      participatedProgramIds: n.participatedPrograms.map((p) => p.program_id),
      status: n.structuredStatus,
      memo: n.rawMemo ?? '',
      tone: n.tone,
      memoLang: userLang,          // 2차: 현재 직원 기본 언어로 (메모 원문은 그대로 두되 다음 generate부터 적용)
      previousNoticeId: n.id,      // ★ 재전송 신호 — send 시 v+1 처리
    })
    useToastStore.getState().show('수정 모드로 전환되었습니다 (재생성해 주세요)', 'success')
  },

  // ── 입력 ────────────────────────────────────────────────────────────────────
  setParticipatedPrograms: (ids) => set({ participatedProgramIds: ids }),

  toggleProgram: (id) =>
    set((s) => ({
      participatedProgramIds: s.participatedProgramIds.includes(id)
        ? s.participatedProgramIds.filter((x) => x !== id)
        : [...s.participatedProgramIds, id],
    })),

  setStatusField: (field, value) =>
    set((s) => ({ status: { ...s.status, [field]: value } })),

  setMemo: (memo) => set({ memo }),

  appendMemo: (text) =>
    set((s) => ({ memo: s.memo + (s.memo && !s.memo.endsWith(' ') ? ' ' : '') + text })),

  setTone: (tone) => set({ tone }),

  setMemoLang: (lang) => set({ memoLang: lang }),

  // ── 생성 ────────────────────────────────────────────────────────────────────
  generate: async (residentId) => {
    const { participatedProgramIds, status, memo, tone, memoLang } = get()

    if (!status.health || !status.mood || !status.meal) {
      set({ generateError: '건강·기분·식사를 모두 선택해 주세요.' })
      return
    }

    set({
      generating: true,
      generateError: null,
      drafts: null,
      selectedDraftIndex: null,
      editedText: '',
      isRefined: false,
    })

    try {
      const res = await generateDrafts({
        residentId,
        participatedProgramIds,
        status: {
          health: status.health,
          mood: status.mood,
          meal: status.meal,
          medication: status.medication ?? 'NONE',
        },
        memo,
        tone,
        memoLang,            // 2차: 입력 언어 전달
      })
      set({
        drafts: res.drafts,
        softenedCount: res.softenedCount,
        appliedPrograms: res.appliedPrograms,
        generating: false,
        selectedDraftIndex: 0,
        editedText: res.drafts[0]?.text ?? '',
      })
    } catch (e) {
      const msg =
        e instanceof ApiException
          ? e.error.message
          : 'AI 알림장 생성 중 오류가 발생했습니다.'
      set({ generateError: msg, generating: false })
    }
  },

  // ── S4 ─────────────────────────────────────────────────────────────────────
  selectDraft: (index) => {
    const drafts = get().drafts
    if (!drafts || index < 0 || index >= drafts.length) return
    set({
      selectedDraftIndex: index,
      editedText: drafts[index].text,
      isRefined: false,
    })
  },

  setEditedText: (text) => set({ editedText: text }),

  refine: async () => {
    const s = get()
    if (s.isRefined || s.refining) return
    if (!s.editedText.trim()) {
      useToastStore.getState().show('다듬을 본문이 비어 있습니다', 'error')
      return
    }

    set({ refining: true })
    try {
      const res = await refineText(s.editedText, s.tone)
      set({
        editedText: res.refinedText,
        isRefined: true,
        refining: false,
      })
      useToastStore.getState().show(
        res.changed ? '표현을 다듬었어요' : '다듬을 부분이 없었습니다',
        'success',
      )
    } catch (e) {
      const msg = e instanceof ApiException ? e.error.message : '다듬기에 실패했습니다.'
      set({ refining: false })
      useToastStore.getState().show(msg, 'error')
    }
  },

  // ── 전송 ────────────────────────────────────────────────────────────────────
  send: async (residentId) => {
    const s = get()

    if (!s.drafts || s.selectedDraftIndex === null) {
      set({ sendError: '먼저 초안을 선택해 주세요.' })
      return
    }
    const text = s.editedText.trim()
    if (!text) {
      set({ sendError: '본문이 비어 있습니다.' })
      return
    }
    if (!s.status.health || !s.status.mood || !s.status.meal) {
      set({ sendError: '상태 정보가 누락되었습니다.' })
      return
    }

    set({ sending: true, sendError: null })

    try {
      const res = await sendNotice({
        residentId,
        rawMemo: s.memo,
        status: {
          health: s.status.health,
          mood: s.status.mood,
          meal: s.status.meal,
          medication: s.status.medication ?? 'NONE',
        },
        participatedProgramIds: s.participatedProgramIds,
        tone: s.tone,
        aiGeneratedTexts: s.drafts,
        selectedDraftIndex: s.selectedDraftIndex,
        isRefined: s.isRefined,
        finalText: text,
        previousNoticeId: s.previousNoticeId,   // 재전송이면 v+1
        memoLang: s.memoLang,                   // 2차: notice.memo_lang 저장
      })

      // 성공 후속 처리
      useDashboardStore
        .getState()
        .markResidentSent(residentId, res.notice.id, res.notice.sentAt)

      // localStorage 정리
      const userId = useAuthStore.getState().user?.id
      if (userId) clearDraft(userId, residentId)

      useToastStore.getState().show(
        res.notice.isEdited ? '수정 후 재전송 완료' : '전송 완료',
        'success',
      )

      set({ sending: false, justSentNoticeId: res.notice.id })
    } catch (e) {
      const msg = e instanceof ApiException ? e.error.message : '전송에 실패했습니다.'
      set({ sending: false, sendError: msg })
      useToastStore.getState().show(msg, 'error')
    }
  },

  clearJustSent: () => set({ justSentNoticeId: null }),

  // ── 방어 1 보조: dirty 검사 ────────────────────────────────────────────────
  hasUnsavedWork: () => {
    const s = get()
    if (s.mode !== 'editing') return false           // 읽기 모드는 dirty 아님
    if (s.justSentNoticeId !== null) return false    // 전송 직후 완료 화면도 dirty 아님
    return (
      s.memo.trim().length > 0 ||
      s.status.health !== undefined ||
      s.status.mood !== undefined ||
      s.status.meal !== undefined ||
      s.status.medication !== undefined ||
      s.drafts !== null
    )
  },

  reset: () => set(initial),
}))

// ─── 외부에서 자주 쓰는 셀렉터를 노출 ────────────────────────────────────────
/** 컴포넌트 외부(클릭 핸들러 등)에서 즉시 dirty 검사할 때 사용 */
export function hasUnsavedWorkNow(): boolean {
  return useNoticeStore.getState().hasUnsavedWork()
}
