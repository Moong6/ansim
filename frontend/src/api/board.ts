import { api } from './client'
import { type BoardDetailResponse, type BoardListResponse } from '../types'

export function listBoard(limit = 20, offset = 0): Promise<BoardListResponse> {
  return api.get<BoardListResponse>(`/api/board?limit=${limit}&offset=${offset}`)
}

export function getBoard(id: number): Promise<BoardDetailResponse> {
  return api.get<BoardDetailResponse>(`/api/board/${id}`)
}

export function createBoard(title: string, content: string): Promise<BoardDetailResponse> {
  return api.post<BoardDetailResponse>('/api/board', { title, content })
}

export function updateBoard(id: number, fields: { title?: string; content?: string }): Promise<BoardDetailResponse> {
  return api.patch<BoardDetailResponse>(`/api/board/${id}`, fields)
}

export function removeBoard(id: number): Promise<void> {
  return api.delete<void>(`/api/board/${id}`)
}
