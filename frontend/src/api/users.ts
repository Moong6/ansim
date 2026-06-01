/**
 * 사용자 본인 정보 API
 * PATCH /api/users/me/language
 */
import { api } from './client'
import { type Lang } from '../types'

export interface LanguageUpdateResponse {
  preferredLang: Lang
}

/** 본인의 preferred_lang 즉시 저장. 별도 UI 버튼 없이 칩 변경 시 호출. */
export function updateLanguage(preferredLang: Lang): Promise<LanguageUpdateResponse> {
  return api.patch<LanguageUpdateResponse>('/api/users/me/language', { preferredLang })
}
