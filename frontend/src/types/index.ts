/**
 * 공유 타입 정의
 *
 * Pydantic 응답 스키마와 1:1 대응. 백엔드 변경 시 여기도 함께 수정.
 */

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface Facility {
  id: number
  name: string
  address: string | null
}

/** 2차 스프린트: 지원 언어 코드 (ISO 639-1) */
export type Lang = 'ko' | 'vi' | 'zh' | 'en'

export interface User {
  id: number
  name: string
  role: 'CAREGIVER' | 'SOCIAL_WORKER' | 'ADMIN' | 'GUARDIAN'
  preferredLang: Lang    // 2차: 직원 기본 메모 입력 언어
  facility: Facility
}

export interface LoginResponse {
  token: string
  user: User
}

// ─── Program ──────────────────────────────────────────────────────────────────
export interface Program {
  id: number
  startTime: string   // "HH:MM"
  title: string
  description: string | null
}

export interface ProgramsResponse {
  date: string        // "YYYY-MM-DD"
  programs: Program[]
}

// ─── Resident ─────────────────────────────────────────────────────────────────
export type TodayStatus = 'NONE' | 'SENT'

export interface ResidentCard {
  id: number
  name: string
  age: number
  roomNumber: string
  profileImageUrl: string | null
  careLevel: string
  todayStatus: TodayStatus
  todayNoticeId: number | null
  sentAt: string | null
}

export interface ResidentsResponse {
  summary: { total: number; completed: number }
  residents: ResidentCard[]
}

// ─── Notice ───────────────────────────────────────────────────────────────────
export type Tone = 'FRIENDLY' | 'POLITE' | 'EMPATHETIC'

export interface StructuredStatus {
  health: 'GOOD' | 'NORMAL' | 'NEEDS_OBSERVATION'
  mood: 'GOOD' | 'NORMAL' | 'ANXIOUS'
  meal: 'FULL' | 'NORMAL' | 'LITTLE' | 'REFUSED'
  medication: 'DONE' | 'NONE'
}

export interface Draft {
  index: number
  label: string    // "A" | "B" | "C"
  text: string
}

/** /api/notices/generate 응답의 appliedPrograms 요소 */
export interface AppliedProgram {
  programId: number
  title: string
  startTime: string   // "HH:MM"
}

export interface GenerateResponse {
  drafts: Draft[]
  softenedCount: number
  appliedPrograms: AppliedProgram[]
  detectedLang: string    // 2차: 서버가 감지/확인한 메모 언어
}

export interface RefineResponse {
  refinedText: string
  changed: boolean
}

export interface NoticeSentResponse {
  notice: {
    id: number
    version: number
    status: 'SENT'
    isEdited: boolean
    sentAt: string
  }
}

// ─── 단건 조회 (GET /api/notices/{id}) ────────────────────────────────────────

/** notice.participated_programs JSONB 스냅샷 한 항목 (snake_case 보존) */
export interface ParticipatedProgramSnapshot {
  program_id: number
  title: string
  start_time: string | null
}

export interface NoticeDetail {
  id: number
  residentId: number
  version: number
  status: 'DRAFT' | 'SENT'
  isEdited: boolean
  structuredStatus: StructuredStatus
  participatedPrograms: ParticipatedProgramSnapshot[]
  rawMemo: string | null
  tone: Tone
  selectedDraftIndex: number | null
  isRefined: boolean
  finalText: string | null
  sentAt: string | null
  readAt: string | null
}

export interface NoticeDetailResponse {
  notice: NoticeDetail
}

// =============================================================================
// 3차 스프린트: 주간 안심 리포트
// =============================================================================

export type DataLevel = 'NONE' | 'SPARSE' | 'SUFFICIENT'

export interface TopProgram {
  title: string
  count: number
}

export interface ReportStatsSummary {
  recordedDays: number
  meal:   Record<string, number>   // { FULL, NORMAL, LITTLE, REFUSED }
  mood:   Record<string, number>   // { GOOD, NORMAL, ANXIOUS }
  health: Record<string, number>   // { GOOD, NORMAL, NEEDS_OBSERVATION }
  topPrograms: TopProgram[]
}

export interface PreviewReportResponse {
  residentId:     number
  periodStart:    string           // "YYYY-MM-DD"
  periodEnd:      string
  recordedDays:   number
  dataLevel:      DataLevel
  statsSummary:   ReportStatsSummary
  sourceNoticeIds: number[]
}

export interface GenerateReportResponse {
  residentId:     number
  periodStart:    string
  periodEnd:      string
  recordedDays:   number
  reportText:     string
  statsSummary:   ReportStatsSummary
  sourceNoticeIds: number[]
}

export interface SendReportResponse {
  report: {
    id:     number
    status: 'SENT'
    sentAt: string
  }
}

// =============================================================================
// 4차 스프린트: 홈 / 어르신 PATCH / 공지사항
// =============================================================================

export interface ResidentDetail {
  id:             number
  name:           string
  age:            number
  birthDate:      string | null
  roomNumber:     string | null
  careLevel:      string | null
  precautions:    string | null
  gender:         string | null
  profileImageUrl: string | null
}

export interface ResidentDetailResponse {
  resident: ResidentDetail
}

export interface BoardAuthor {
  id:   number
  name: string
  role: string
}

export interface BoardItem {
  id:        number
  title:     string
  preview:   string
  author:    BoardAuthor
  createdAt: string
  canEdit:   boolean
}

export interface BoardListResponse {
  total: number
  items: BoardItem[]
}

export interface BoardPost {
  id:        number
  title:     string
  content:   string
  author:    BoardAuthor
  createdAt: string
  updatedAt: string
  canEdit:   boolean
}

export interface BoardDetailResponse {
  post: BoardPost
}

// =============================================================================
// 5차 스프린트: 보호자 채널 + AI 문의 분류
// =============================================================================

export type InquiryCategory = 'HEALTH' | 'ADMIN_AFFAIRS' | 'VISIT' | 'MEAL' | 'OTHER'
export type InquiryStatus   = 'UNREAD' | 'READ' | 'ANSWERED'   // 8차: ANSWERED 추가

// 8차: 답변 타입
export interface InquiryAnswerAuthor {
  id:   number
  name: string
  role: string
}

export interface InquiryAnswer {
  id:        number
  inquiryId: number
  content:   string
  author:    InquiryAnswerAuthor
  createdAt: string
  updatedAt: string
  canEdit:   boolean
}

// 8차: 보호자용 답변 (author.id 없음)
export interface ParentInquiryAnswerAuthor {
  name: string
  role: string
}

export interface ParentInquiryAnswer {
  content:   string
  author:    ParentInquiryAnswerAuthor
  createdAt: string
}

// ── HomeSummary (8차에서 확장) ─────────────────────────────────────────────
export interface HomeSummary {
  alimjang:  { todayTotal: number; todayCompleted: number }
  report:    { lastWeekAvailable: boolean }
  board:     { unreadCount: number }
  residents: { assignedCount: number }
  inquiry:   { unreadCount: number; needsAnswerCount: number }  // 8차: needsAnswerCount 추가
  meals:     { todayRegisteredCount: number; todayTotal: number }
  schedule:  { thisMonthCount: number }
  albums:    { thisMonthCount: number }
}

// ── /api/parent/me ──────────────────────────────────────────────────────────
export interface ParentUser {
  id:    number
  name:  string
  email: string
  role:  string
}

export interface ParentResident {
  id:           number
  name:         string
  age:          number
  roomNumber:   string | null
  careLevel:    string | null
  relationship: string | null
}

export interface ParentSummary {
  unreadBoardCount:      number
  unreadNoticeCount:     number
  newReportCount:        number
  pendingInquiryCount:   number
  inquiryNewAnswerCount: number   // 8차 추가
  meals:    { todayRegisteredCount: number }
  schedule: { thisMonthCount: number }
  albums:   { myResidentInThisMonth: number }
}

export interface ParentMeResponse {
  user:      ParentUser
  residents: ParentResident[]
  summary:   ParentSummary
}

// ── /api/parent/board ──────────────────────────────────────────────────────
export interface ParentBoardItem {
  id:        number
  title:     string
  preview:   string
  createdAt: string
  canEdit:   false
}

export interface ParentBoardPost {
  id:        number
  title:     string
  content:   string
  createdAt: string
  updatedAt: string
  canEdit:   false
}

// ── /api/parent/notices ────────────────────────────────────────────────────
export interface ParentNoticeItem {
  id:           number
  residentId:   number
  residentName: string
  preview:      string
  sentAt:       string | null
  readAt:       string | null
}

export interface ParentNoticeDetail {
  id:           number
  residentName: string
  finalText:    string | null
  structuredStatus?: StructuredStatus
  sentAt:       string | null
  readAt:       string | null
}

// ── /api/parent/reports ────────────────────────────────────────────────────
export interface ParentReportItem {
  id:           number
  residentId:   number
  residentName: string
  preview:      string
  sentAt:       string | null
  readAt:       string | null
}

export interface ParentReportWeekStats {
  recordedDays: number
  topMood: string
  topMeal: string
}

export interface ParentReportDetail {
  id:           number
  residentName: string
  finalText:    string | null
  weekStats?:   ParentReportWeekStats
  sentAt:       string | null
  readAt:       string | null
}

// ── /api/parent/inquiries ─────────────────────────────────────────────────
export interface ParentInquiryItem {
  id:            number
  category:      InquiryCategory
  preview:       string
  status:        InquiryStatus
  createdAt:     string
  hasNewAnswer:  boolean          // 8차 추가
  answerPreview: string | null    // 8차 추가
}

export interface ParentInquiryDetail {
  id:        number
  category:  InquiryCategory
  title:     string | null
  content:   string
  status:    InquiryStatus
  createdAt: string
  answer:    ParentInquiryAnswer | null   // 8차 추가
}

export interface InquiryCreated {
  id:        number
  category:  InquiryCategory
  status:    InquiryStatus
  createdAt: string
}

// ── /api/inquiries (직원) ──────────────────────────────────────────────────
export interface StaffInquiryItem {
  id:                 number
  category:           InquiryCategory
  preview:            string
  guardianName:       string
  residentName:       string
  residentRoomNumber: string | null
  status:             InquiryStatus
  hasAnswer:          boolean    // 8차 추가
  createdAt:          string
}

export interface StaffInquirySummary {
  unread:      number
  needsAnswer: number   // 8차 추가
  answered:    number   // 8차 추가
  byCategory:  Record<InquiryCategory, number>
}

export interface StaffInquiryListResponse {
  total:   number
  summary: StaffInquirySummary
  items:   StaffInquiryItem[]
}

export interface StaffInquiryDetail {
  id:        number
  category:  InquiryCategory
  title:     string | null
  content:   string
  status:    InquiryStatus
  guardian:  { id: number; name: string; phone: string | null }
  resident:  { id: number; name: string; roomNumber: string | null; careLevel: string | null; precautions: string | null }
  answer:    InquiryAnswer | null   // 8차 추가
  createdAt: string
  readBy:    number | null
  readAt:    string | null
}

// =============================================================================
// 6차 스프린트: 식단표 + 일정표
// =============================================================================

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
export type ScheduleEventType = 'FACILITY_EVENT' | 'BIRTHDAY' | 'HOLIDAY'

export interface PhotoItem {
  url: string
}

export interface MealAuthor {
  id:   number
  name: string
}

// ── /api/meals (직원) ─────────────────────────────────────────────────────
export interface MealItem {
  id:        number
  mealType:  MealType
  menuText:  string
  photos:    PhotoItem[]
  author:    MealAuthor
  createdAt: string
}

export interface MealsDayResponse {
  date:    string    // "YYYY-MM-DD"
  weekday: string    // "MONDAY" ~ "SUNDAY"
  isToday: boolean
  meals:   MealItem[]
}

// ── /api/parent/meals (보호자) ─────────────────────────────────────────────
export interface MealItemParent {
  mealType:  MealType
  menuText:  string
  photos:    PhotoItem[]
}

export interface MealsDayParentResponse {
  date:    string
  weekday: string
  isToday: boolean
  meals:   MealItemParent[]
}

// ── /api/schedule (직원) ──────────────────────────────────────────────────
export interface ScheduleResident {
  id:         number
  name:       string
  roomNumber: string | null
  age:        number | null
}

export interface ScheduleEventItem {
  id:          number
  eventDate:   string   // "YYYY-MM-DD"
  eventType:   ScheduleEventType
  title:       string
  description: string | null
  resident:    ScheduleResident | null
  author:      MealAuthor | null
  createdAt:   string
}

export interface ScheduleMonthResponse {
  year:   number
  month:  number
  events: ScheduleEventItem[]
}

// ── /api/parent/schedule (보호자) ─────────────────────────────────────────
export interface ScheduleEventParentItem {
  id:          number
  eventDate:   string
  eventType:   ScheduleEventType
  title:       string
  description: string | null
  resident:    ScheduleResident | null
}

export interface ScheduleMonthParentResponse {
  year:   number
  month:  number
  events: ScheduleEventParentItem[]
}

// ── 업로드 응답 ────────────────────────────────────────────────────────────
export interface UploadPhotoResponse {
  url:       string
  filename:  string
  sizeBytes: number
}

// =============================================================================
// 7차 스프린트: 앨범
// =============================================================================

export interface AlbumParticipant {
  id:         number
  name:       string
  roomNumber: string | null  // 보호자용은 없음
}

export interface AlbumAuthor {
  id:   number
  name: string
}

// ── 직원 목록 (/api/albums) ───────────────────────────────────────────────
export interface AlbumListItem {
  id:           number
  activityDate: string        // "YYYY-MM-DD"
  title:        string
  description:  string | null
  photoCount:   number
  thumbnailUrl: string | null
  participants: AlbumParticipant[]
  author:       AlbumAuthor
  canEdit:      boolean
  createdAt:    string
}

export interface AlbumListResponse {
  year:  number
  month: number
  total: number
  items: AlbumListItem[]
}

// ── 직원 단건 (/api/albums/{id}) ──────────────────────────────────────────
export interface AlbumDetail {
  id:           number
  activityDate: string
  title:        string
  description:  string | null
  photos:       PhotoItem[]
  participants: AlbumParticipant[]
  author:       AlbumAuthor
  canEdit:      boolean
  createdAt:    string
  updatedAt:    string
}

export interface AlbumDetailResponse {
  album: AlbumDetail
}

// ── 보호자 목록 (/api/parent/albums) ──────────────────────────────────────
export interface AlbumListItemParent {
  id:           number
  activityDate: string
  title:        string
  description:  string | null
  photoCount:   number
  thumbnailUrl: string | null
  participants: { id: number; name: string }[]
}

export interface AlbumListParentResponse {
  year:  number
  month: number
  total: number
  items: AlbumListItemParent[]
}

// ── 보호자 단건 (/api/parent/albums/{id}) ─────────────────────────────────
export interface AlbumDetailParent {
  id:           number
  activityDate: string
  title:        string
  description:  string | null
  photos:       PhotoItem[]
  participants: { id: number; name: string }[]
}

export interface AlbumDetailParentResponse {
  album: AlbumDetailParent
}
