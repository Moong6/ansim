/**
 * 프로그램 API
 * GET /api/programs/today
 */
import { api } from './client'
import { type ProgramsResponse } from '../types'

export function fetchTodayPrograms(): Promise<ProgramsResponse> {
  return api.get<ProgramsResponse>('/api/programs/today')
}
