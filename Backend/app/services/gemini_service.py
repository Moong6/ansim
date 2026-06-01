"""
Gemini API 연동 서비스

핵심 책임:
  1) precautions 를 System Prompt에 주입 → 할루시네이션 차단
  2) Structured Output(response_schema) 으로 JSON 깨짐 방지
  3) 호출/파싱 실패는 GeminiServiceError로 통합 → 라우터가 502 변환
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Sequence

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import settings
from app.models.models import Program, Resident
from app.schemas.notices import DraftOut, StructuredStatus
from app.services.gemini_retry import GeminiServiceError as _RetryError, call_with_retry

logger = logging.getLogger(__name__)


# ─── LLM Structured Output 전용 내부 스키마 ──────────────────────────────────

class _LLMDraft(BaseModel):
    index: int = Field(description="0=A, 1=B, 2=C")
    label: str = Field(description="A 또는 B 또는 C")
    text:  str = Field(description="알림장 본문 (3~6 문장)")


class _LLMResult(BaseModel):
    drafts:        list[_LLMDraft] = Field(description="정확히 3개")
    softenedCount: int             = Field(description="입력에서 순화한 자극적 표현 개수, 0 이상")
    detectedLang:  str             = Field(
        description="감지된 메모 언어 코드. 'ko'(한국어) / 'vi'(베트남어) / 'zh'(중국어) / 'en'(영어) / 그 외는 코드 그대로"
    )


# ─── /refine 전용 응답 스키마 ────────────────────────────────────────────────

class _RefineResult(BaseModel):
    refinedText: str = Field(
        description="다듬은 본문. 입력의 의미·길이·문장 수를 보존해야 한다."
    )


# ─── 한글 라벨 매핑 (프롬프트용) ──────────────────────────────────────────────

_HEALTH = {"GOOD": "좋음", "NORMAL": "보통", "NEEDS_OBSERVATION": "관찰 필요"}
_MOOD   = {"GOOD": "좋음", "NORMAL": "보통", "ANXIOUS": "다소 불안/우울"}
_MEAL   = {"FULL": "완식", "NORMAL": "보통", "LITTLE": "적게 드심", "REFUSED": "거부"}
_MED    = {"DONE": "완료", "NONE": "해당없음"}
_TONE   = {
    "FRIENDLY":   "친근하고 다정한 어조",
    "POLITE":     "정중하고 격식 있는 어조 (기본)",
    "EMPATHETIC": "공감과 위로가 깊이 담긴 어조",
}


# ─── 예외 ─────────────────────────────────────────────────────────────────────

class GeminiServiceError(Exception):
    """LLM 호출/응답 파싱 실패를 라우터로 전달하기 위한 예외."""


# ─── 프롬프트 조립 ────────────────────────────────────────────────────────────

def _age(birth: date | None) -> str:
    if not birth:
        return "미상"
    today = date.today()
    a = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        a -= 1
    return f"{a}세"


_LANG_LABEL = {
    "ko": "한국어",
    "vi": "베트남어 (Tiếng Việt)",
    "zh": "중국어 (中文)",
    "en": "영어 (English)",
}


def _build_lang_section(memo_lang: str | None) -> str:
    """다국어 입력 처리 지시 블록. memo_lang=None 이면 자동 감지."""
    if memo_lang and memo_lang != "ko":
        label = _LANG_LABEL.get(memo_lang, memo_lang)
        return f"""
[★ 입력 언어 처리]
- [직원이 작성한 원본 메모]는 {label} 로 작성되었다고 사용자가 명시했다.
- 메모의 의미를 정확히 이해해 한국어로 번역하여 활용하라.
- 그러나 **출력 알림장 본문은 반드시 한국어로만** 작성하라. 외국어 단어/문장을 출력에 섞지 마라.
- 외국어 메모를 인용/재게시하지 마라. 의미만 한국어 문장으로 풀어내라.
- detectedLang 필드에는 '{memo_lang}' 를 그대로 기록하라.
"""
    if memo_lang is None or memo_lang == "":
        return """
[★ 입력 언어 처리]
- [직원이 작성한 원본 메모]의 언어를 자동 감지하라.
- 한국어가 아니라면 의미를 이해해 한국어로 번역하여 사용하라.
- 출력 알림장 본문은 반드시 한국어로만 작성하라. 외국어를 출력에 섞지 마라.
- detectedLang 필드에 감지한 언어 코드를 정확히 기록하라. ko/vi/zh/en 중 하나, 또는 그 외 ISO 639-1 코드.
"""
    # memo_lang == 'ko' 또는 기타 명시값
    return f"""
[입력 언어 처리]
- [직원이 작성한 원본 메모]는 한국어로 작성되었다.
- detectedLang 필드에 'ko' 를 기록하라.
"""


def _build_system_prompt(resident: Resident, memo_lang: str | None = None) -> str:
    """
    System Context.
    precautions 를 강제 주입하고, 신체상태와 모순되는 표현을 금지하는 규칙을 명시.
    2차: memo_lang 에 따라 외국어 입력 → 한국어 변환 지시 블록 추가.
    """
    return f"""당신은 요양원에서 일하는 요양보호사를 돕는 AI 전문 어시스턴트입니다.
보호자(어르신의 가족)에게 전달할 알림장 초안을 작성하는 것이 당신의 역할입니다.
{_build_lang_section(memo_lang)}

[어르신 기본 정보]
- 이름: {resident.name}
- 연령: {_age(resident.birth_date)}
- 장기요양등급: {resident.care_level or '미지정'}
- 주의사항(기저질환·신체상태): {resident.precautions or '특이사항 없음'}

[★ 절대 준수 사항 — 할루시네이션 차단]
1. 위 '주의사항'에 명시된 신체 상태와 모순되는 활동을 절대로 서술하지 마세요.
   - '와상' 또는 '휠체어' 가 포함되면: "걸으셨다", "산책하셨다", "뛰셨다", "일어서셨다", "이동하셨다" 같은 보행/기립 표현을 절대 사용 금지.
   - '위루관' 이 포함되면: 식사 묘사는 입력 상태값/메모에 한정. "맛있게 드셨다" 같은 일반 식사 표현 금지.
   - '치매' 가 포함되면: 임의의 과거 회상, 가족 이름 언급, 구체적 대화 일화를 창작 금지.
   - '청력 저하' 가 포함되면: 활발한 대화·노래 장면을 가공 금지.
   - '관절염' 이 포함되면: 격렬한 운동 표현 금지.
2. 입력으로 전달된 사실(메모·상태값·참여 프로그램) 외의 활동·대화·감정·일화를 일절 추가하지 마세요.
3. 직원이 '참여 안 함'으로 표시한 프로그램은 언급조차 하지 마세요.
4. 거짓이나 과장으로 보호자를 안심시키지 마세요. 진실되게, 그러나 따뜻하게.

[표현 순화 지시]
입력의 자극적·딱딱한 표현은 보호자가 불안하지 않게 부드럽게 다듬으세요.
- "거부"  → "잘 드시지 못하셨습니다", "다소 식사량이 적으셨습니다"
- "불안"  → "다소 차분하지 못한 모습이셨습니다"
- "관찰필요" → "조금 더 세심히 살펴드리고 있습니다"
- 순화한 표현의 총 개수를 softenedCount(정수) 에 기록하세요. 없으면 0.

[★ 출력 작성 규칙 및 이모지 사용 가이드]
- 알림장 본문은 따뜻한 느낌을 주기 위해 자연스러운 이모지를 2~4개 정도 자연스럽게 배치하세요.
- 사용 가능한 안전한 이모지 예시: 🍚 ☕ ☀️ 😊 💛 🌷 💊 ✨ 🙏
- 주의: 어르신의 주의사항(precautions)에서 금지하거나 제약한 신체 활동에 관련된 이모지(예: 와상/휠체어 어르신에게 🚶 🏃 등)는 절대로 사용하지 마세요.
- 주의: 부정적이거나 자극적, 의료 응급 상황을 암시하는 이모지(💀 ⚰️ 🚑 🩸 🤮 🤕 등)는 절대로 사용하지 마세요.
- 한 문단에 이모지 1개 이하로 제한하며, 문장 시작이 아닌 문장 끝이나 자연스러운 위치에 배치하세요.

[초안 차별화 — 3개 모두 다른 어조/구성]
- index 0, label "A": 표준 톤, 사실을 충실하고 정중하게 전달
- index 1, label "B": 따뜻하고 감성적인 어조 강화, 보호자 마음을 다독이는 문장 포함
- index 2, label "C": 간결하고 핵심만 압축 (2~3 문장)

[글 길이]
각 초안은 한국어 자연 문장으로, A·B는 3~6 문장, C는 2~3 문장.
"""


def _build_user_prompt(
    status: StructuredStatus,
    memo: str,
    programs: Sequence[Program],
    tone: str,
) -> str:
    # 참여 프로그램
    if programs:
        lines = []
        for p in programs:
            t = p.start_time.strftime("%H:%M") if p.start_time else "(시간 미정)"
            desc = f" / {p.description}" if p.description else ""
            lines.append(f"  - {t} {p.title}{desc}")
        prog_block = "[오늘 참여한 공통 프로그램]\n" + "\n".join(lines)
    else:
        prog_block = (
            "[오늘 참여한 공통 프로그램]\n"
            "  (없음 — 프로그램 관련 문장을 포함하지 마세요)"
        )

    # 메모
    memo_block = (
        f"[직원이 작성한 원본 메모]\n{memo.strip()}"
        if memo and memo.strip()
        else "[직원이 작성한 원본 메모]\n(메모 없음)"
    )

    return f"""오늘의 알림장 초안 생성을 요청합니다.

[전체 어조 지시]
{_TONE[tone]}

[어르신의 오늘 상태]
- 건강: {_HEALTH[status.health]}
- 기분: {_MOOD[status.mood]}
- 식사: {_MEAL[status.meal]}
- 투약: {_MED[status.medication]}

{prog_block}

{memo_block}

★ 다시 강조: System 지시의 '주의사항'에 위배되는 표현(특히 신체 상태와 모순되는 활동)을 절대 쓰지 마세요.
★ 입력에 없는 활동·대화·감정을 창작하지 마세요.

3개 초안(A, B, C)을 JSON 으로 반환하세요.
"""


# ─── 메인 호출 ────────────────────────────────────────────────────────────────

def generate_drafts(
    *,
    resident: Resident,
    programs: Sequence[Program],
    status: StructuredStatus,
    memo: str,
    tone: str,
    memo_lang: str | None = None,
) -> tuple[list[DraftOut], int, str]:
    """
    Gemini Structured Output 호출 → 3개 초안 + softenedCount + detectedLang.

    2차: memo_lang 이 주어지면 그 언어로 간주, None 이면 자동 감지.
    출력 알림장은 항상 한국어. LLM 호출은 1차와 동일하게 1회 유지.

    Raises:
        GeminiServiceError: 호출 실패 또는 응답 파싱 실패.
    """
    system_prompt = _build_system_prompt(resident, memo_lang)
    user_prompt   = _build_user_prompt(status, memo, programs, tone)

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = call_with_retry(
            lambda model: client.models.generate_content(
                model=model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=_LLMResult,
                    temperature=0.8,
                ),
            )
        )
    except _RetryError as e:
        raise GeminiServiceError(str(e)) from e
    except Exception as e:
        logger.exception("Gemini API call failed")
        raise GeminiServiceError(f"AI 호출 실패: {e}") from e

    # ── 응답 파싱 ──────────────────────────────────────────────────────────────
    parsed: _LLMResult | None = response.parsed
    if parsed is None:
        # parsed가 비면 text에서 JSON 직접 파싱 시도
        try:
            parsed = _LLMResult.model_validate_json(response.text or "")
        except Exception as e:
            logger.error("Gemini response parse failed. text=%r", response.text)
            raise GeminiServiceError("AI 응답 파싱 실패") from e

    if len(parsed.drafts) != 3:
        raise GeminiServiceError(
            f"AI가 3개가 아닌 {len(parsed.drafts)}개의 초안을 반환했습니다"
        )

    # ── 라벨/인덱스 강제 보정 (LLM이 잘못 채워도 서버에서 정렬) ──────────────
    label_map = {0: "A", 1: "B", 2: "C"}
    sorted_drafts = sorted(parsed.drafts, key=lambda d: d.index)[:3]
    drafts = [
        DraftOut(index=i, label=label_map[i], text=d.text.strip())
        for i, d in enumerate(sorted_drafts)
    ]

    # 2차: detectedLang 정규화 — 비어있으면 명시값 또는 기본 ko
    detected = (parsed.detectedLang or memo_lang or "ko").strip().lower()

    return drafts, max(0, parsed.softenedCount), detected


# =============================================================================
# 다듬기 (refine) — 맞춤법·표현 순화만, 내용 추가/삭제/재구성 금지
# =============================================================================

def _build_refine_system_prompt(tone: str) -> str:
    return f"""당신은 한국어 교정 전문가입니다.
입력된 알림장 본문에 대해 오직 아래 작업만 수행하세요.

[전체 어조 — 순화 시 유지]
{_TONE[tone]}

[허용 작업 — 이것만 하세요]
1. 맞춤법, 띄어쓰기, 문장부호 오류 교정
2. 자극적·딱딱한 표현을 부드러운 표현으로 순화
   - "거부"     → "잘 드시지 못하셨습니다"
   - "불안"     → "다소 차분하지 못한 모습이셨습니다"
   - "관찰필요" → "조금 더 세심히 살펴드리고 있습니다"

[★ 절대 금지 작업]
1. 새로운 내용/문장/단어를 추가하지 마세요. (어르신 활동·대화·감정 창작 금지)
2. 기존 내용/문장을 삭제하지 마세요.
3. 문장 구조나 문단 순서를 재구성하지 마세요.
4. 의미를 바꾸지 마세요.
5. 입력에 없던 사실을 만들어내지 마세요.

원본의 의미·길이·문장 수를 최대한 보존하면서, 자연스럽고 따뜻한 한국어로만 다듬어 주세요.
"""


def refine_text(*, text: str, tone: str) -> str:
    """
    Gemini Structured Output 으로 맞춤법·표현만 다듬은 본문을 반환.

    Raises:
        GeminiServiceError: 호출 실패 또는 응답 파싱 실패.
    """
    if not text.strip():
        raise GeminiServiceError("빈 본문은 다듬을 수 없습니다")

    system_prompt = _build_refine_system_prompt(tone)
    user_prompt   = f"[다듬을 본문]\n{text}"

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = call_with_retry(
            lambda model: client.models.generate_content(
                model=model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=_RefineResult,
                    temperature=0.3,
                ),
            )
        )
    except _RetryError as e:
        raise GeminiServiceError(str(e)) from e
    except Exception as e:
        logger.exception("Gemini refine call failed")
        raise GeminiServiceError(f"AI 호출 실패: {e}") from e

    parsed: _RefineResult | None = response.parsed
    if parsed is None:
        try:
            parsed = _RefineResult.model_validate_json(response.text or "")
        except Exception as e:
            logger.error("Gemini refine parse failed. text=%r", response.text)
            raise GeminiServiceError("AI 응답 파싱 실패") from e

    return parsed.refinedText.strip()
