"""
7차 스프린트: 앨범 Pydantic 스키마
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── 공통 서브 객체 ─────────────────────────────────────────────────────────────

class PhotoItemOut(BaseModel):
    url: str


class ParticipantOut(BaseModel):
    id:         int
    name:       str
    roomNumber: str | None = None   # 직원용에만 포함, 보호자용은 None 세팅


class AuthorOut(BaseModel):
    id:   int
    name: str


# ── 직원 목록 (/api/albums) ────────────────────────────────────────────────────

class AlbumListItem(BaseModel):
    id:           int
    activityDate: date
    title:        str
    description:  str | None
    photoCount:   int
    thumbnailUrl: str | None
    participants: list[ParticipantOut]
    author:       AuthorOut
    canEdit:      bool
    createdAt:    datetime

    model_config = {"from_attributes": True}


class AlbumListResponse(BaseModel):
    year:  int
    month: int
    total: int
    items: list[AlbumListItem]


# ── 직원 단건 (/api/albums/{id}) ───────────────────────────────────────────────

class AlbumDetail(BaseModel):
    id:           int
    activityDate: date
    title:        str
    description:  str | None
    photos:       list[PhotoItemOut]
    participants: list[ParticipantOut]
    author:       AuthorOut
    canEdit:      bool
    createdAt:    datetime
    updatedAt:    datetime

    model_config = {"from_attributes": True}


class AlbumDetailResponse(BaseModel):
    album: AlbumDetail


# ── 생성 요청 (POST /api/albums) ──────────────────────────────────────────────

class AlbumPhotoIn(BaseModel):
    url: str


class AlbumCreateRequest(BaseModel):
    activityDate: date
    title:        str = Field(min_length=1, max_length=100)
    description:  str | None = Field(default=None, max_length=500)
    residentIds:  list[int]
    photos:       list[AlbumPhotoIn] = Field(default_factory=list)


# ── 수정 요청 (PATCH /api/albums/{id}) ────────────────────────────────────────

class AlbumUpdateRequest(BaseModel):
    activityDate: date | None = None
    title:        str | None = Field(default=None, min_length=1, max_length=100)
    description:  str | None = Field(default=None, max_length=500)
    residentIds:  list[int] | None = None
    photos:       list[AlbumPhotoIn] | None = None


# ── 업로드 응답 ────────────────────────────────────────────────────────────────

class AlbumPhotoUploadResponse(BaseModel):
    url:       str
    filename:  str
    sizeBytes: int


# ── 보호자용 (/api/parent/albums) ─────────────────────────────────────────────

class ParticipantParentOut(BaseModel):
    id:   int
    name: str


class AlbumListItemParent(BaseModel):
    id:           int
    activityDate: date
    title:        str
    description:  str | None
    photoCount:   int
    thumbnailUrl: str | None
    participants: list[ParticipantParentOut]

    model_config = {"from_attributes": True}


class AlbumListParentResponse(BaseModel):
    year:  int
    month: int
    total: int
    items: list[AlbumListItemParent]


class AlbumDetailParent(BaseModel):
    id:           int
    activityDate: date
    title:        str
    description:  str | None
    photos:       list[PhotoItemOut]
    participants: list[ParticipantParentOut]

    model_config = {"from_attributes": True}


class AlbumDetailParentResponse(BaseModel):
    album: AlbumDetailParent


# ── 홈 카운트 ─────────────────────────────────────────────────────────────────

class AlbumsSummaryHome(BaseModel):
    thisMonthCount: int


class AlbumsSummaryParent(BaseModel):
    myResidentInThisMonth: int
