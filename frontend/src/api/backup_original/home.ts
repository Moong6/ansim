import { api } from './client'
import { type HomeSummary } from '../types'

export function fetchHomeSummary(): Promise<HomeSummary> {
  return api.get<HomeSummary>('/api/home/summary')
}
