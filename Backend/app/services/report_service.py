"""
주간 안심 리포트 서비스.

  - fetch_week_current_notices : 해당 주 SENT 알림장 (root 그룹별 MAX version)
  - compute_stats              : structured_status + programs 코드 집계
  - classify_data_level        : 0/1~2/3+ → NONE/SPARSE/SUFFICIENT
  - generate_weekly_letter     : Gemini Structured Output 으로 단일 편지 생성

1차 gemini_service 의 ``GeminiServiceError`` 를 재사용해 라우터가 502 로 변환.
"""

from __future__ import annotations

import json as _json
import logging
from datetime import date, datetime, timedelta
from typing import Sequence

from google import genai
from google.genai import types
from pydantic import BaseModel as _PydBase, Field as _PydField
from sqlalchemy import Date as SADate, cast, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Notice, NoticeStatus, Resident
from app.services.gemini_service import GeminiServiceError
from app.services.gemini_retry import call_with_retry

logger = logging.getLogger(__name__)


# ─── notice 조회 ──────────────────────────────────────────────────────────────

def fetch_week_current_notices(
    db: Session, resident_id: int, period_start: date
) -> list[Notice]:
    """
    해당 주(월~일)의 SENT 알림장을 조회하되, 재전송 이력이 있으면
    root 그룹의 MAX(version) 1건만 반환.

    구현: PostgreSQL DISTINCT ON (root_key) ORDER BY root_key, version DESC
      - root_key = COALESCE(root_notice_id, id)
        ↳ 자신이 root 면 자신의 id, 재전송본이면 원본 id
    """
    period_end = period_start + timedelta(days=6)
    root_key = func.coalesce(Notice.root_notice_id, Notice.id)

    stmt = (
        select(Notice)
        .where(Notice.resident_id == resident_id)
        .where(Notice.status == NoticeStatus.SENT)
        .where(Notice.deleted_at.is_(None))
        .where(cast(Notice.sent_at, SADate) >= period_start)
        .where(cast(Notice.sent_at, SADate) <= period_end)
        .order_by(root_key, Notice.version.desc())
        .distinct(root_key)                 # PostgreSQL DISTINCT ON
    )
    return list(db.scalars(stmt))


# ─── 집계 ─────────────────────────────────────────────────────────────────────

# 빈 분포 (모든 enum 값에 0 보장 — 프론트가 매번 키 존재 체크하지 않아도 되게)
_MEAL_KEYS   = ("FULL", "NORMAL", "LITTLE", "REFUSED")
_MOOD_KEYS   = ("GOOD", "NORMAL", "ANXIOUS")
_HEALTH_KEYS = ("GOOD", "NORMAL", "NEEDS_OBSERVATION")


def compute_stats(notices: list[Notice]) -> dict:
    """
    structured_status + participated_programs 집계 → JSONB 저장용 dict 반환.
    형태는 핸드오프 문서 4단계 stats_summary 스키마와 동일.
    """
    meal_counts   = {k: 0 for k in _MEAL_KEYS}
    mood_counts   = {k: 0 for k in _MOOD_KEYS}
    health_counts = {k: 0 for k in _HEALTH_KEYS}
    program_counts: dict[str, int] = {}
    days: set[date] = set()

    for n in notices:
        # 상태 카운트 (알려진 값만, 알 수 없는 값은 무시)
        s = n.structured_status or {}
        if s.get("meal") in meal_counts:     meal_counts[s["meal"]]     += 1
        if s.get("mood") in mood_counts:     mood_counts[s["mood"]]     += 1
        if s.get("health") in health_counts: health_counts[s["health"]] += 1

        # 프로그램 참여 카운트
        for p in (n.participated_programs or []):
            title = p.get("title")
            if title:
                program_counts[title] = program_counts.get(title, 0) + 1

        # 기록 일수: distinct date(sent_at)
        if n.sent_at:
            days.add(n.sent_at.date())

    # 참여 수 내림차순, 동률 시 제목 가나다순으로 안정 정렬
    top_programs = sorted(
        [{"title": t, "count": c} for t, c in program_counts.items()],
        key=lambda x: (-x["count"], x["title"]),
    )

    return {
        "recordedDays": len(days),
        "meal":   meal_counts,
        "mood":   mood_counts,
        "health": health_counts,
        "topPrograms": top_programs,
    }


# ─── dataLevel 분류 ──────────────────────────────────────────────────────────

def classify_data_level(recorded_days: int) -> str:
    """0 → NONE, 1~2 → SPARSE, 3+ → SUFFICIENT"""
    if recorded_days <= 0:
        return "NONE"
    if recorded_days <= 2:
        return "SPARSE"
    return "SUFFICIENT"


# =============================================================================
# Gemini 호출 — 주간 종합 편지 생성 (LLM 1회)
# =============================================================================

# Structured Output 응답 스키마 — 단일 텍스트 필드만
class _WeeklyLetterResult(_PydBase):
    reportText: str = _PydField(
        description="한 주의 종합 편지 본문. 한국어, 12줄 이상 권장, 보호자 호칭으로 시작."
    )


_TONE_LABEL = {
    "FRIENDLY":   "친근하고 다정한 어조",
    "POLITE":     "정중하고 격식 있는 어조 (기본)",
    "EMPATHETIC": "공감과 위로가 깊이 담긴 어조",
}

_WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]


def _build_letter_system_prompt(resident: Resident) -> str:
    """1차 gemini_service 의 precautions 방어 패턴을 주간 편지용으로 재구성."""
    return f"""당신은 한 주간 어르신의 일상을 종합해 보호자에게 전달하는 AI 어시스턴트입니다.
보호자가 한 주의 흐름을 한눈에 안심하고 이해할 수 있도록 따뜻한 종합 편지를 작성합니다.

[어르신 기본 정보]
- 이름: {resident.name}
- 장기요양등급: {resident.care_level or '미지정'}
- 주의사항(기저질환·신체상태): {resident.precautions or '특이사항 없음'}

[★ 절대 준수 사항 — 할루시네이션 차단]
1. 위 '주의사항'에 명시된 신체 상태와 모순되는 활동을 절대로 서술하지 마세요.
   - '와상' 또는 '휠체어' 가 포함되면: "걸으셨다", "산책하셨다", "뛰셨다", "일어서셨다", "이동하셨다" 같은 보행/기립 표현을 절대 사용 금지.
   - '위루관' 이 포함되면: 식사 묘사는 입력 상태값/메모에 한정. "맛있게 드셨다" 같은 일반 식사 표현 금지.
   - '치매' 가 포함되면: 임의의 과거 회상, 가족 이름 언급, 구체적 대화 일화를 창작 금지.
   - '청력 저하' 가 포함되면: 활발한 대화·노래 장면을 가공 금지.
   - '관절염' 이 포함되면: 격렬한 운동 표현 금지.

2. 입력으로 전달된 [일별 알림장 본문] 과 [통계 요약] 외의 활동·대화·감정·일화를 일절 추가하지 마세요.

3. ★★ 기록이 없는 날에 대해 추측·가공·창작하지 마세요.
   - 사용자가 알려준 '실제 기록 일수(N일)' 만 근거로 한 주를 묘사하세요.
   - "주말에도 잘 지내셨습니다" 같은 일반 표현 금지 — 기록이 없는 날은 언급 자체를 하지 않습니다.
   - 만약 5일치 기록이라면 "한 주 동안" 같은 과한 일반화 대신 "이번 주 관찰된 모습으로는…" 식으로 정직하게.

4. 거짓이나 과장으로 보호자를 안심시키지 마세요. 진실되게, 그러나 따뜻하게.

[표현 순화]
- "거부"     → "잘 드시지 못하셨습니다"
- "불안"     → "다소 차분하지 못한 모습이셨습니다"
- "관찰필요" → "조금 더 세심히 살펴드리고 있습니다"

[★ 출력 작성 규칙 및 이모지 사용 가이드]
- 종합 편지 본문은 따뜻한 느낌을 주기 위해 자연스러운 이모지를 4~6개 정도 자연스럽게 배치하세요.
- 사용 가능한 안전한 이모지 예시: 🍚 ☕ ☀️ 😊 💛 🌷 💊 ✨ 🙏
- 주의: 어르신의 주의사항(precautions)에서 금지하거나 제약한 신체 활동에 관련된 이모지(예: 와상/휠체어 어르신에게 🚶 🏃 등)는 절대로 사용하지 마세요.
- 주의: 부정적이거나 자극적, 의료 응급 상황을 암시하는 이모지(💀 ⚰️ 🚑 🩸 🤮 🤕 등)는 절대로 사용하지 마세요.
- 한 문단에 이모지 1개 이하로 제한하며, 문장 시작이 아닌 문장 끝이나 자연스러운 위치에 배치하세요.

[글의 형식]
- 한국어 종합 편지 1편 (3안 아님, 단일 출력)
- "보호자님," 같은 호칭으로 자연스럽게 시작
- 한 주의 전체 분위기와 변화의 흐름을 통합 서술 (날짜별 단순 나열 금지)
- 통계 숫자를 직접 나열하지 말고 문장에 부드럽게 녹여 표현
- 권장 길이: 12줄 이상, 5~7 문단 정도
- 마무리에 직원의 다음 주 다짐과 안부 한 마디
"""


def _build_letter_user_prompt(
    *,
    period_start: date,
    period_end: date,
    recorded_days: int,
    stats: dict,
    notices: Sequence[Notice],
    tone: str,
) -> str:
    # 일별 알림장 본문 (sent_at 오름차순)
    sorted_notices = sorted(notices, key=lambda n: n.sent_at or datetime.min)
    lines: list[str] = []
    for n in sorted_notices:
        if not n.final_polished_text:
            continue
        d = n.sent_at.date()
        weekday = _WEEKDAY_KO[d.weekday()]
        lines.append(f"[{d.isoformat()} ({weekday})]\n{n.final_polished_text.strip()}")
    day_block = "\n\n".join(lines) if lines else "(기록 없음)"

    stats_json = _json.dumps(
        {
            "recordedDays": stats["recordedDays"],
            "meal":   stats["meal"],
            "mood":   stats["mood"],
            "health": stats["health"],
            "topPrograms": stats["topPrograms"],
        },
        ensure_ascii=False,
        indent=2,
    )

    return f"""주간 종합 편지 생성을 요청합니다.

[전체 어조]
{_TONE_LABEL[tone]}

[조회 주차]
{period_start.isoformat()} (월) ~ {period_end.isoformat()} (일)
★ 실제 기록 일수: {recorded_days}일 / 7일
★ 위 N일치 기록만 근거로 한 주를 묘사하세요. 기록이 없는 날은 절대 추측·창작 금지.

[통계 요약 (코드 집계)]
{stats_json}

[일별 알림장 본문 — 실제 작성된 N일치만]
{day_block}

위 자료만을 근거로, 보호자에게 보낼 한 주 종합 편지를 작성해 주세요.
System 지시의 '주의사항' 을 절대 위반하지 마세요. 특히 어르신 신체 상태와 모순되는 표현은 금지입니다.
reportText 필드에 편지 본문만 한국어로 담아 JSON 으로 반환하세요.
"""


def generate_weekly_letter(
    *,
    resident: Resident,
    period_start: date,
    period_end: date,
    recorded_days: int,
    stats: dict,
    notices: Sequence[Notice],
    tone: str,
) -> str:
    """
    Gemini Structured Output 으로 단일 한국어 편지 생성.
    LLM 호출 1회.

    Raises:
        GeminiServiceError: 호출 실패 / 응답 파싱 실패 / 빈 본문 (라우터가 502 변환)
    """
    if recorded_days <= 0:
        # 라우터에서 먼저 422 로 막아야 함. 여기서는 안전망.
        raise GeminiServiceError("기록이 없어 편지를 생성할 수 없습니다.")

    system_prompt = _build_letter_system_prompt(resident)
    user_prompt   = _build_letter_user_prompt(
        period_start=period_start,
        period_end=period_end,
        recorded_days=recorded_days,
        stats=stats,
        notices=notices,
        tone=tone,
    )

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = call_with_retry(
            lambda model: client.models.generate_content(
                model=model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=_WeeklyLetterResult,
                    temperature=0.7,
                ),
            )
        )
    except GeminiServiceError:
        raise
    except Exception as e:
        logger.exception("Gemini weekly letter call failed")
        raise GeminiServiceError(f"AI 호출 실패: {e}") from e

    parsed: _WeeklyLetterResult | None = response.parsed
    if parsed is None:
        try:
            parsed = _WeeklyLetterResult.model_validate_json(response.text or "")
        except Exception as e:
            logger.error("Gemini weekly letter parse failed. text=%r", response.text)
            raise GeminiServiceError("AI 응답 파싱 실패") from e

    text = parsed.reportText.strip()
    if not text:
        raise GeminiServiceError("AI 가 빈 본문을 반환했습니다.")
    return text
