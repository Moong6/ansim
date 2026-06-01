from pydantic import BaseModel


class ProgramOut(BaseModel):
    id:          int
    startTime:   str | None    # "HH:MM"
    title:       str
    description: str | None = None


class ProgramsResponse(BaseModel):
    date:     str              # "YYYY-MM-DD"
    programs: list[ProgramOut]
