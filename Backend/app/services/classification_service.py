"""
5차 스프린트: 보호자 문의 AI 자동 분류 서비스

분류 카테고리: HEALTH / ADMIN_AFFAIRS / VISIT / MEAL / OTHER
임계치: CLASSIFICATION_THRESHOLD (.env, 기본 0.6)
- 4개 정답 카테고리 중 최고 ≥ 임계치 → 해당 카테고리, SUCCESS
- 모두 < 임계치 → OTHER, THRESHOLD_FALLBACK
- LLM 실패 → OTHER, confidence=None, scores={}, LLM_ERROR_FALLBACK (502 안 던짐)
"""

from __future__ import annotations

import logging
from typing import NamedTuple

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import settings
from app.models.inquiry import ClassificationStatus, InquiryCategory
from app.services.gemini_retry import call_with_retry

logger = logging.getLogger(__name__)

ANSWER_CATEGORIES = [
    InquiryCategory.HEALTH,
    InquiryCategory.ADMIN_AFFAIRS,
    InquiryCategory.VISIT,
    InquiryCategory.MEAL,
]


class _ScoresResult(BaseModel):
    HEALTH:         float = Field(ge=0.0, le=1.0)
    ADMIN_AFFAIRS:  float = Field(ge=0.0, le=1.0)
    VISIT:          float = Field(ge=0.0, le=1.0)
    MEAL:           float = Field(ge=0.0, le=1.0)
    OTHER:          float = Field(ge=0.0, le=1.0)


class ClassificationResult(NamedTuple):
    category:               InquiryCategory
    confidence:             float | None
    scores:                 dict
    classification_status:  ClassificationStatus


def classify_inquiry(content: str) -> ClassificationResult:
    """
    문의 본문을 5개 카테고리로 분류한다.
    LLM 실패 시 예외를 던지지 않고 LLM_ERROR_FALLBACK 반환.
    """
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        prompt = (
            "당신은 요양원 보호자 문의를 분류하는 전문가입니다.\n"
            "다음 보호자 문의를 5개 카테고리로 분류하세요.\n\n"
            "카테고리:\n"
            "- HEALTH: 어르신 건강, 증상, 의료, 투약 관련\n"
            "- ADMIN_AFFAIRS: 행정, 비용, 계약, 서류, 기관 운영 관련\n"
            "- VISIT: 면회, 외출, 방문 일정 관련\n"
            "- MEAL: 식사, 식단, 영양 관련\n"
            "- OTHER: 위 4가지에 해당하지 않는 기타\n\n"
            "각 카테고리의 신뢰도를 0~1 사이로 산출하세요. 합계는 1.0이어야 합니다.\n\n"
            f"문의 내용:\n{content}"
        )

        response = call_with_retry(
            lambda model: client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_ScoresResult,
                    temperature=0.1,
                ),
            )
        )

        scores_obj: _ScoresResult = response.parsed
        scores = {
            "HEALTH":        round(scores_obj.HEALTH, 4),
            "ADMIN_AFFAIRS": round(scores_obj.ADMIN_AFFAIRS, 4),
            "VISIT":         round(scores_obj.VISIT, 4),
            "MEAL":          round(scores_obj.MEAL, 4),
            "OTHER":         round(scores_obj.OTHER, 4),
        }

        # 임계치 판정 (OTHER는 정답 카테고리 제외)
        threshold = settings.CLASSIFICATION_THRESHOLD
        best_category = None
        best_score = 0.0
        for cat in ANSWER_CATEGORIES:
            cat_score = scores.get(cat.value, 0.0)
            if cat_score > best_score:
                best_score = cat_score
                best_category = cat

        if best_category and best_score >= threshold:
            return ClassificationResult(
                category=best_category,
                confidence=best_score,
                scores=scores,
                classification_status=ClassificationStatus.SUCCESS,
            )
        else:
            return ClassificationResult(
                category=InquiryCategory.OTHER,
                confidence=best_score if best_score > 0 else scores.get("OTHER", 0.0),
                scores=scores,
                classification_status=ClassificationStatus.THRESHOLD_FALLBACK,
            )

    except Exception as exc:
        logger.warning("문의 분류 LLM 실패 (fallback to OTHER): %s", exc)
        return ClassificationResult(
            category=InquiryCategory.OTHER,
            confidence=None,
            scores={},
            classification_status=ClassificationStatus.LLM_ERROR_FALLBACK,
        )
