/**
 * 어르신 API
 * GET /api/residents/assigned
 * GET /api/residents/:id
 */
import { api } from './client'
import { type ResidentDetailResponse, type ResidentsResponse } from '../types'

export function fetchAssignedResidents(): Promise<ResidentsResponse> {
  return api.get<ResidentsResponse>('/api/residents/assigned')
}

export function fetchResident(id: number): Promise<ResidentDetailResponse> {
  return api.get<ResidentDetailResponse>(`/api/residents/${id}`)
}

export function patchResidentPrecautions(id: number, precautions: string): Promise<void> {
  return api.patch<void>(`/api/residents/${id}`, { precautions })
}
