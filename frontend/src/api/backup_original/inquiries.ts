/**
 * 5차 스프린트: 직원 문의 처리 API 클라이언트
 * GET   /api/inquiries
 * GET   /api/inquiries/{id}
 * PATCH /api/inquiries/{id}/read
 */

import { api } from './client'
import type { StaffInquiryDetail, StaffInquiryListResponse } from '../types'

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
