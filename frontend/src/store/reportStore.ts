import { create } from 'zustand'
import {
  type PreviewReportResponse,
  type Tone,
} from '../types'
import {
  generateReport,
  previewReport,
  sendReport,
} from '../api/reports'
import { ApiException } from '../api/client'
import { useToastStore } from './toastStore'

// ─── 상태 ─────────────────────────────────────────────────────────────────────

interface ReportState {
  // R1: 선택
  selectedResidentId: number | null
  periodStart: string | null              // "YYYY-MM-DD" (월요일)

  // R2: preview
  preview: PreviewReportResponse | null
  previewLoading: boolean
  previewError: string | null

  // R3: AI 편지
  aiGeneratedText: string                  // AI 원본 (send 시 ai_generated_text 로 저장)
  reportText: string                       // 편집 가능 본문 (send 시 finalText)
  generating: boolean
  generateError: string | null

  // R4: 톤 + 전송
  tone: Tone
  sending: boolean
  sendError: string | null
  justSentReportId: number | null          // 전송 직후 표시용

  // ── 액션 ────────────────────────────────────────────────────────────────────
  setResident: (id: number | null) => void
  setPeriodStart: (start: string | null) => void
  setTone: (tone: Tone) => void
  setReportText: (text: string) => void

  /** preview API 호출 후 응답 반환 (dataLevel 분기는 호출 측이 결정) */
  loadPreview: () => Promise<PreviewReportResponse | null>
  /** generate API 호출 → reportText / aiGeneratedText 갱신 */
  generateLetter: () => Promise<void>
  /** send API 호출 → 성공 시 R2~R4 초기화, R1 유지 */
  send: () => Promise<void>
  clearJustSent: () => void

  /** R2~R4 초기화 (R1 유지). R1 변경 시 호출. */
  clearGenerated: () => void
  /** 전체 초기화 */
  reset: () => void
}


const initial = {
  selectedResidentId: null as number | null,
  periodStart: null as string | null,

  preview: null as PreviewReportResponse | null,
  previewLoading: false,
  previewError: null as string | null,

  aiGeneratedText: '',
  reportText: '',
  generating: false,
  generateError: null as string | null,

  tone: 'POLITE' as Tone,
  sending: false,
  sendError: null as string | null,
  justSentReportId: null as number | null,
}


// ─── 스토어 ───────────────────────────────────────────────────────────────────

export const useReportStore = create<ReportState>((set, get) => ({
  ...initial,

  setResident: (id) => {
    // R1 변경 시 하위 단계 결과 무효화
    set({
      selectedResidentId: id,
      preview: null,
      previewError: null,
      aiGeneratedText: '',
      reportText: '',
      generateError: null,
      justSentReportId: null,
      sendError: null,
    })
  },

  setPeriodStart: (start) => {
    set({
      periodStart: start,
      preview: null,
      previewError: null,
      aiGeneratedText: '',
      reportText: '',
      generateError: null,
      justSentReportId: null,
      sendError: null,
    })
  },

  setTone: (tone) => set({ tone }),

  setReportText: (text) => set({ reportText: text }),

  // ── preview ────────────────────────────────────────────────────────────────
  loadPreview: async () => {
    const { selectedResidentId, periodStart } = get()
    if (selectedResidentId === null || !periodStart) {
      set({ previewError: '어르신과 주차를 선택해 주세요.' })
      return null
    }

    set({
      previewLoading: true,
      previewError: null,
      preview: null,
      aiGeneratedText: '',
      reportText: '',
      generateError: null,
      justSentReportId: null,
    })

    try {
      const res = await previewReport(selectedResidentId, periodStart)
      set({ preview: res, previewLoading: false })
      return res
    } catch (e) {
      const msg = e instanceof ApiException
        ? e.error.message
        : '주차 데이터를 불러오지 못했습니다.'
      set({ previewLoading: false, previewError: msg })
      return null
    }
  },

  // ── generate ───────────────────────────────────────────────────────────────
  generateLetter: async () => {
    const { selectedResidentId, periodStart, tone, preview } = get()
    if (selectedResidentId === null || !periodStart) return
    if (preview === null || preview.dataLevel === 'NONE') return

    // ★ 재생성 실패 시 기존 본문 보존 — 성공 시에만 reportText 교체
    set({ generating: true, generateError: null })

    try {
      const res = await generateReport({
        residentId: selectedResidentId,
        periodStart,
        tone,
      })
      set({
        aiGeneratedText: res.reportText,
        reportText: res.reportText,
        generating: false,
      })
    } catch (e) {
      const msg = e instanceof ApiException
        ? e.error.message
        : 'AI 편지 생성에 실패했습니다.'
      // 본문은 그대로 두고 에러만 표시
      set({ generating: false, generateError: msg })
    }
  },

  // ── send ────────────────────────────────────────────────────────────────────
  send: async () => {
    const s = get()
    if (
      s.selectedResidentId === null ||
      !s.periodStart ||
      !s.preview ||
      s.preview.dataLevel === 'NONE' ||
      !s.reportText.trim()
    ) {
      set({ sendError: '전송할 내용이 준비되지 않았습니다.' })
      return
    }

    set({ sending: true, sendError: null })

    try {
      const res = await sendReport({
        residentId:      s.selectedResidentId,
        periodStart:     s.preview.periodStart,
        periodEnd:       s.preview.periodEnd,
        recordedDays:    s.preview.recordedDays,
        tone:            s.tone,
        statsSummary:    s.preview.statsSummary,
        sourceNoticeIds: s.preview.sourceNoticeIds,
        aiGeneratedText: s.aiGeneratedText || null,
        finalText:       s.reportText.trim(),
      })

      useToastStore.getState().show('주간 리포트가 전송되었습니다', 'success')

      // R3~R4 초기화. R1 (어르신/주차/톤) 유지.
      set({
        sending: false,
        justSentReportId: res.report.id,
        preview: null,
        aiGeneratedText: '',
        reportText: '',
      })
    } catch (e) {
      const msg = e instanceof ApiException
        ? e.error.message
        : '리포트 전송에 실패했습니다.'
      set({ sending: false, sendError: msg })
      useToastStore.getState().show(msg, 'error')
    }
  },

  clearJustSent: () => set({ justSentReportId: null }),

  clearGenerated: () =>
    set({
      preview: null,
      previewError: null,
      aiGeneratedText: '',
      reportText: '',
      generateError: null,
      justSentReportId: null,
      sendError: null,
    }),

  reset: () => set(initial),
}))
