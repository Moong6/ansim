/**
 * 주간 안심 리포트 API
 *   GET  /api/reports/preview     주차 통계 + dataLevel (LLM 호출 없음)
 *   POST /api/reports/generate    AI 편지 생성 (LLM 1회)
 *   POST /api/reports/send        report INSERT + 발송
 */
import { api } from './client'
import {
  type GenerateReportResponse,
  type PreviewReportResponse,
  type ReportStatsSummary,
  type SendReportResponse,
  type Tone,
} from '../types'


// ─── GET /api/reports/preview ────────────────────────────────────────────────

export function previewReport(
  residentId: number,
  periodStart: string,        // "YYYY-MM-DD" (월요일)
): Promise<PreviewReportResponse> {
  const qs = `residentId=${residentId}&periodStart=${encodeURIComponent(periodStart)}`
  return api.get<PreviewReportResponse>(`/api/reports/preview?${qs}`)
}


// ─── POST /api/reports/generate ──────────────────────────────────────────────

export interface GenerateReportPayload {
  residentId:  number
  periodStart: string
  tone:        Tone
}

export function generateReport(payload: GenerateReportPayload): Promise<GenerateReportResponse> {
  return api.post<GenerateReportResponse>('/api/reports/generate', payload)
}


// ─── POST /api/reports/send ──────────────────────────────────────────────────

export interface SendReportPayload {
  residentId:      number
  periodStart:     string
  periodEnd:       string
  recordedDays:    number
  tone:            Tone
  statsSummary:    ReportStatsSummary
  sourceNoticeIds: number[]
  aiGeneratedText: string | null
  finalText:       string
}

export function sendReport(payload: SendReportPayload): Promise<SendReportResponse> {
  return api.post<SendReportResponse>('/api/reports/send', payload)
}
