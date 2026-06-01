from pydantic import BaseModel


class AlimjangSummary(BaseModel):
    todayTotal:     int
    todayCompleted: int


class ReportSummary(BaseModel):
    lastWeekAvailable: bool


class BoardSummary(BaseModel):
    unreadCount: int


class ResidentsSummary(BaseModel):
    assignedCount: int


class InquirySummaryHome(BaseModel):
    unreadCount:      int
    needsAnswerCount: int = 0   # 8차 추가 (READ 상태 카운트)


# 6차 추가
class MealsSummaryHome(BaseModel):
    todayRegisteredCount: int
    todayTotal:           int = 4   # 항상 4 (아침/점심/저녁/간식)


class ScheduleSummaryHome(BaseModel):
    thisMonthCount: int


# 7차 추가
class AlbumsSummaryHome(BaseModel):
    thisMonthCount: int


class HomeSummaryResponse(BaseModel):
    alimjang:  AlimjangSummary
    report:    ReportSummary
    board:     BoardSummary
    residents: ResidentsSummary
    inquiry:   InquirySummaryHome   = InquirySummaryHome(unreadCount=0)
    meals:     MealsSummaryHome     = MealsSummaryHome(todayRegisteredCount=0)
    schedule:  ScheduleSummaryHome  = ScheduleSummaryHome(thisMonthCount=0)
    albums:    AlbumsSummaryHome    = AlbumsSummaryHome(thisMonthCount=0)
