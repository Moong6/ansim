/**
 * 어르신 API
 * GET /api/residents/assigned
 * GET /api/residents/all   (앨범 참여자 선택용, 7차 추가)
 * GET /api/residents/:id
 */
import { api } from './client'
import { type ResidentCard, type ResidentDetailResponse, type ResidentsResponse } from '../types'

export function fetchAssignedResidents(): Promise<ResidentsResponse> {
  return api.get<ResidentsResponse>('/api/residents/assigned')
}

/** 앨범 등록·수정 시 참여자 선택용: 시설 전체 어르신 목록 (content_editor 전용) */
export function fetchAllResidents(): Promise<ResidentCard[]> {
  return api.get<ResidentCard[]>('/api/residents/all')
}

export function fetchResident(id: number): Promise<ResidentDetailResponse> {
  return api.get<ResidentDetailResponse>(`/api/residents/${id}`)
}

export function patchResidentPrecautions(id: number, precautions: string): Promise<void> {
  return api.patch<void>(`/api/residents/${id}`, { precautions })
}
