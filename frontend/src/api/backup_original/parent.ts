/**
 * 5차 스프린트: 보호자 채널 API 클라이언트
 * GET  /api/parent/me
 * GET  /api/parent/board(/{id})
 * GET  /api/parent/notices(/{id})
 * GET  /api/parent/reports(/{id})
 * GET  /api/parent/inquiries(/{id})
 * POST /api/parent/inquiries
 */

import { api } from './client'
import type {
  InquiryCreated,
  ParentBoardItem,
  ParentBoardPost,
  ParentInquiryDetail,
  ParentInquiryItem,
  ParentMeResponse,
  ParentNoticeDetail,
  ParentNoticeItem,
  ParentReportDetail,
  ParentReportItem,
} from '../types'

// ── /api/parent/me ────────────────────────────────────────────────────────────
export function getParentMe(): Promise<ParentMeResponse> {
  return api.get<ParentMeResponse>('/api/parent/me')
}

// ── /api/parent/board ─────────────────────────────────────────────────────────
export function getParentBoardList(): Promise<{ total: number; items: ParentBoardItem[] }> {
  return api.get('/api/parent/board')
}

export function getParentBoardDetail(id: number): Promise<{ post: ParentBoardPost }> {
  return api.get(`/api/parent/board/${id}`)
}

// ── /api/parent/notices ───────────────────────────────────────────────────────
export function getParentNotices(): Promise<{ total: number; items: ParentNoticeItem[] }> {
  return api.get('/api/parent/notices')
}

export function getParentNoticeDetail(id: number): Promise<{ notice: ParentNoticeDetail }> {
  return api.get(`/api/parent/notices/${id}`)
}

// ── /api/parent/reports ───────────────────────────────────────────────────────
export function getParentReports(): Promise<{ total: number; items: ParentReportItem[] }> {
  return api.get('/api/parent/reports')
}

export function getParentReportDetail(id: number): Promise<{ report: ParentReportDetail }> {
  return api.get(`/api/parent/reports/${id}`)
}

// ── /api/parent/inquiries ─────────────────────────────────────────────────────
export function getParentInquiries(): Promise<{ total: number; items: ParentInquiryItem[] }> {
  return api.get('/api/parent/inquiries')
}

export function getParentInquiryDetail(id: number): Promise<{ inquiry: ParentInquiryDetail }> {
  return api.get(`/api/parent/inquiries/${id}`)
}

export function createParentInquiry(body: {
  residentId: number
  title?: string
  content: string
}): Promise<{ inquiry: InquiryCreated }> {
  return api.post('/api/parent/inquiries', body)
}
