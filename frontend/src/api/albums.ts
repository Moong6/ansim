/**
 * 7차 스프린트: 앨범 API
 *
 * 직원:
 *   GET    /api/albums?year=&month=
 *   GET    /api/albums/{id}
 *   POST   /api/albums
 *   PATCH  /api/albums/{id}
 *   DELETE /api/albums/{id}
 *
 * 보호자:
 *   GET  /api/parent/albums?year=&month=
 *   GET  /api/parent/albums/{id}
 *
 * 업로드:
 *   POST /api/uploads/album-photo
 */
import { api, getToken, ApiException } from './client'
import type {
  AlbumDetailResponse,
  AlbumListResponse,
  AlbumDetailParentResponse,
  AlbumListParentResponse,
  UploadPhotoResponse,
} from '../types'

// ─── 직원 ─────────────────────────────────────────────────────────────────────

export function getAlbums(year: number, month: number): Promise<AlbumListResponse> {
  return api.get<AlbumListResponse>(`/api/albums?year=${year}&month=${month}`)
}

export function getAlbum(id: number): Promise<AlbumDetailResponse> {
  return api.get<AlbumDetailResponse>(`/api/albums/${id}`)
}

export function createAlbum(body: {
  activityDate: string
  title:        string
  description?: string | null
  residentIds:  number[]
  photos:       { url: string }[]
}): Promise<{ id: number; message: string }> {
  return api.post('/api/albums', body)
}

export function updateAlbum(id: number, body: {
  activityDate?: string
  title?:        string
  description?:  string | null
  residentIds?:  number[]
  photos?:       { url: string }[]
}): Promise<{ id: number; message: string }> {
  return api.patch(`/api/albums/${id}`, body)
}

export function deleteAlbum(id: number): Promise<{ message: string }> {
  return api.delete(`/api/albums/${id}`)
}

// ─── 보호자 ───────────────────────────────────────────────────────────────────

export function getParentAlbums(year: number, month: number): Promise<AlbumListParentResponse> {
  return api.get<AlbumListParentResponse>(`/api/parent/albums?year=${year}&month=${month}`)
}

export function getParentAlbum(id: number): Promise<AlbumDetailParentResponse> {
  return api.get<AlbumDetailParentResponse>(`/api/parent/albums/${id}`)
}

// ─── 앨범 사진 업로드 ─────────────────────────────────────────────────────────

export async function uploadAlbumPhoto(file: File): Promise<UploadPhotoResponse> {
  const token = getToken()

  const form = new FormData()
  form.append('file', file)

  const response = await fetch('/api/uploads/album-photo', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })

  const data = await response.json()

  if (!response.ok) {
    const apiError =
      data?.error ??
      data?.detail ??
      { code: 'UPLOAD_ERROR', message: `HTTP ${response.status}` }
    throw new ApiException(response.status, apiError)
  }

  return data as UploadPhotoResponse
}
