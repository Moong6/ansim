/**
 * 인증 API
 * POST /api/auth/login
 */
import { api } from './client'
import { type LoginResponse } from '../types'

export function login(email: string, password: string): Promise<LoginResponse> {
  return api.post<LoginResponse>('/api/auth/login', { email, password }, false)
}
