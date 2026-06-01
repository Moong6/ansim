from datetime import datetime

from pydantic import BaseModel, Field


class AuthorOut(BaseModel):
    id:   int
    name: str
    role: str


class BoardItemOut(BaseModel):
    id:        int
    title:     str
    preview:   str          # content[:100]
    author:    AuthorOut
    createdAt: str          # ISO 8601
    canEdit:   bool


class BoardListResponse(BaseModel):
    total: int
    items: list[BoardItemOut]


class BoardDetailOut(BaseModel):
    id:        int
    title:     str
    content:   str
    author:    AuthorOut
    createdAt: str
    updatedAt: str
    canEdit:   bool


class BoardDetailResponse(BaseModel):
    post: BoardDetailOut


class BoardCreateRequest(BaseModel):
    title:   str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)


class BoardUpdateRequest(BaseModel):
    title:   str | None = Field(None, max_length=200)
    content: str | None = None
