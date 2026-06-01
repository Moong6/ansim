/**
 * 알림장 API
 * GET  /api/notices/:id
 * POST /api/notices/generate
 * POST /api/notices/refine
 * POST /api/notices/send
 */
import { api } from './client'
import {
  type Draft,
  type GenerateResponse,
  type Lang,
  type NoticeDetailResponse,
  type NoticeSentResponse,
  type RefineResponse,
  type StructuredStatus,
  type Tone,
} from '../types'

export function fetchNotice(id: number): Promise<NoticeDetailResponse> {
  return api.get<NoticeDetailResponse>(`/api/notices/${id}`)
}

export interface GeneratePayload {
  residentId: number
  participatedProgramIds: number[]
  status: StructuredStatus
  memo: string
  tone: Tone
  memoLang?: Lang        // 2차: 미전송 시 서버 자동 감지
}

export function generateDrafts(payload: GeneratePayload): Promise<GenerateResponse> {
  return api.post<GenerateResponse>('/api/notices/generate', payload)
}

export function refineText(text: string, tone: Tone): Promise<RefineResponse> {
  return api.post<RefineResponse>('/api/notices/refine', { text, tone })
}

export interface SendPayload {
  residentId: number
  rawMemo: string
  status: StructuredStatus
  participatedProgramIds: number[]
  tone: Tone
  aiGeneratedTexts: Draft[]
  selectedDraftIndex: number
  isRefined: boolean
  finalText: string
  previousNoticeId: number | null
  memoLang: Lang         // 2차: notice.memo_lang 저장용
}

export function sendNotice(payload: SendPayload): Promise<NoticeSentResponse> {
  return api.post<NoticeSentResponse>('/api/notices/send', payload)
}
