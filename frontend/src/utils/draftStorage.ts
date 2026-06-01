/**
 * localStorage 기반 작성 임시저장
 *
 * 키 형식: caregiver-draft-{userId}-{residentId}-{YYYYMMDD}
 *  - userId/residentId 다르면 다른 키 → 어르신·계정별 격리
 *  - 날짜가 바뀌면 다른 키 → 어제 작성 흔적이 오늘로 새지 않음 (만료 효과)
 *
 * 저장 대상: S3 입력값(programs, status, memo, tone) 만.
 *   AI 결과(drafts/editedText)는 휘발성으로 둠 — 재생성 비용은 한 번만.
 */
import { type StructuredStatus, type Tone } from '../types'

export interface DraftSnapshot {
  participatedProgramIds: number[]
  status: Partial<StructuredStatus>
  memo: string
  tone: Tone
}

function todayYYYYMMDD(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function makeKey(userId: number, residentId: number): string {
  return `caregiver-draft-${userId}-${residentId}-${todayYYYYMMDD()}`
}

export function saveDraft(userId: number, residentId: number, data: DraftSnapshot): void {
  try {
    localStorage.setItem(makeKey(userId, residentId), JSON.stringify(data))
  } catch {
    /* QuotaExceeded 등은 무시 — 임시저장 실패는 치명적이지 않음 */
  }
}

export function loadDraft(userId: number, residentId: number): DraftSnapshot | null {
  try {
    const raw = localStorage.getItem(makeKey(userId, residentId))
    return raw ? (JSON.parse(raw) as DraftSnapshot) : null
  } catch {
    return null
  }
}

export function clearDraft(userId: number, residentId: number): void {
  try {
    localStorage.removeItem(makeKey(userId, residentId))
  } catch {
    /* ignore */
  }
}
