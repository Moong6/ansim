/**
 * 5차 스프린트: 직원 문의 처리 API 클라이언트
 * 8차 스프린트: 답변 CRUD 추가
 * GET   /api/inquiries
 * GET   /api/inquiries/{id}
 * PATCH /api/inquiries/{id}/read
 * POST  /api/inquiries/{id}/answer
 * PATCH /api/inquiries/{id}/answer
 * DELETE /api/inquiries/{id}/answer
 */

import { api } from './client'
import type { InquiryAnswer, StaffInquiryDetail, StaffInquiryListResponse } from '../types'

export function getStaffInquiries(params?: {
  category?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<StaffInquiryListResponse> {
  const q = new URLSearchParams()
  if (params?.category) q.set('category', params.category)
  if (params?.status)   q.set('status',   params.status)
  if (params?.limit)    q.set('limit',    String(params.limit))
  if (params?.offset)   q.set('offset',   String(params.offset))
  const qs = q.toString()
  return api.get(`/api/inquiries${qs ? `?${qs}` : ''}`)
}

export function getStaffInquiryDetail(id: number): Promise<{ inquiry: StaffInquiryDetail }> {
  return api.get(`/api/inquiries/${id}`)
}

export function markInquiryRead(id: number): Promise<{ inquiry: { id: number; status: string; readAt: string | null } }> {
  return api.patch(`/api/inquiries/${id}/read`, {})
}

// ── 8차: 답변 CRUD ────────────────────────────────────────────────────────────

export function createInquiryAnswer(
  inquiryId: number,
  content: string,
): Promise<{ answer: InquiryAnswer; inquiryStatus: string }> {
  return api.post(`/api/inquiries/${inquiryId}/answer`, { content })
}

export function updateInquiryAnswer(
  inquiryId: number,
  content: string,
): Promise<InquiryAnswer> {
  return api.patch(`/api/inquiries/${inquiryId}/answer`, { content })
}

export function deleteInquiryAnswer(inquiryId: number): Promise<void> {
  return api.delete(`/api/inquiries/${inquiryId}/answer`)
}
