/**
 * 일정표 API
 * GET  /api/schedule          (직원)
 * POST /api/schedule          (SOCIAL_WORKER/ADMIN)
 * PATCH /api/schedule/{id}
 * DELETE /api/schedule/{id}
 */
import { api } from './client'
import type { ScheduleMonthResponse } from '../types'

export function getSchedule(year: number, month: number): Promise<ScheduleMonthResponse> {
  return api.get<ScheduleMonthResponse>(`/api/schedule?year=${year}&month=${month}`)
}

export function createScheduleEvent(body: {
  eventDate:   string
  eventType:   string
  title:       string
  description: string | null
  residentId:  number | null
}) {
  return api.post<{ id: number; message: string }>('/api/schedule', body)
}

export function updateScheduleEvent(id: number, body: {
  eventDate?:   string
  eventType?:   string
  title?:       string
  description?: string | null
  residentId?:  number | null
}) {
  return api.patch<{ id: number; message: string }>(`/api/schedule/${id}`, body)
}

export function deleteScheduleEvent(id: number) {
  return api.delete<{ message: string }>(`/api/schedule/${id}`)
}

// 보호자
export function getParentSchedule(year: number, month: number) {
  return api.get<import('../types').ScheduleMonthParentResponse>(
    `/api/parent/schedule?year=${year}&month=${month}`
  )
}
