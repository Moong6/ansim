/**
 * 식단표 API
 * GET  /api/meals          (직원)
 * POST /api/meals          (직원: SOCIAL_WORKER/ADMIN)
 * PATCH /api/meals/{id}
 * DELETE /api/meals/{id}
 */
import { api } from './client'
import type { MealsDayResponse, PhotoItem } from '../types'

export function getMeals(date: string): Promise<MealsDayResponse> {
  return api.get<MealsDayResponse>(`/api/meals?date=${date}`)
}

export function createMeal(body: {
  mealDate:  string
  mealType:  string
  menuText:  string
  photos:    PhotoItem[]
}) {
  return api.post<{ id: number; message: string }>('/api/meals', body)
}

export function updateMeal(id: number, body: {
  mealType?:  string
  menuText?:  string
  photos?:    PhotoItem[]
}) {
  return api.patch<{ id: number; message: string }>(`/api/meals/${id}`, body)
}

export function deleteMeal(id: number) {
  return api.delete<{ message: string }>(`/api/meals/${id}`)
}

// 보호자
export function getParentMeals(date: string) {
  return api.get<import('../types').MealsDayParentResponse>(`/api/parent/meals?date=${date}`)
}
