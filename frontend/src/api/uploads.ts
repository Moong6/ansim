/**
 * 파일 업로드 API
 * POST /api/uploads/meal-photo
 *
 * multipart/form-data 방식 — JSON 래퍼 사용 불가.
 * client.ts의 api 헬퍼 대신 직접 fetch 사용.
 */
import { getToken } from './client'
import { ApiException } from './client'
import type { UploadPhotoResponse } from '../types'

const BASE_URL = ''

export async function uploadMealPhoto(file: File): Promise<UploadPhotoResponse> {
  const token = getToken()

  const form = new FormData()
  form.append('file', file)

  const response = await fetch(`${BASE_URL}/api/uploads/meal-photo`, {
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
