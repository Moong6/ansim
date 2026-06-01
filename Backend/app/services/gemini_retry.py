"""
Gemini API 호출 공통 재시도 유틸리티

에러 유형별 전략:
  ┌──────────────────────────────────────────────────────────────┐
  │ 404 NOT_FOUND   │ 모델 자체가 없음 → 재시도 없이 즉시 다음 모델│
  │ 503 UNAVAILABLE │ 일시 과부하 → 지수 백오프 재시도 → 다음 모델 │
  │ 429 RATE_LIMIT  │ 쿼터 초과   → 지수 백오프 재시도 → 다음 모델 │
  │ 기타            │ 설정 오류 등 → 즉시 GeminiServiceError raise  │
  └──────────────────────────────────────────────────────────────┘

모델 체인:  settings.GEMINI_MODEL (primary) → settings.GEMINI_FALLBACK_MODEL (sub)
각 모델마다 최대 RETRY_COUNT 회 지수 백오프 재시도.
모든 모델 소진 시 GeminiServiceError raise.

사용법:
    result = call_with_retry(
        lambda model: client.models.generate_content(model=model, ...),
    )
"""

from __future__ import annotations

import logging
import time
from typing import Callable, TypeVar

from google.genai import errors as genai_errors

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

# 재시도 설정
_RETRY_COUNT   = 3        # 모델당 최대 재시도 횟수
_INITIAL_DELAY = 2.0      # 첫 재시도 대기(초)
_BACKOFF       = 2.0      # 지수 백오프 배수

_RETRYABLE_CODES  = {503, 429}   # 같은 모델 재시도
_MODEL_DEAD_CODES = {404}        # 모델 자체 미지원 → 즉시 다음 모델


class GeminiServiceError(Exception):
    """Gemini 호출/파싱 실패 통합 예외 (라우터에서 502로 변환)."""


# ── 에러 분류 ─────────────────────────────────────────────────────────────────

def _get_status_code(exc: Exception) -> int | None:
    """예외에서 HTTP 상태 코드 추출."""
    if isinstance(exc, (genai_errors.ServerError, genai_errors.ClientError)):
        return getattr(exc, "status_code", None)
    msg = str(exc)
    for code in (404, 429, 503):
        if str(code) in msg:
            return code
    return None


def _is_model_dead(exc: Exception) -> bool:
    """
    404 NOT_FOUND → 모델 자체가 없거나 더 이상 지원되지 않음.
    재시도 없이 즉시 다음 모델로 전환해야 함.
    """
    code = _get_status_code(exc)
    if code == 404:
        return True
    msg = str(exc).upper()
    return "NOT_FOUND" in msg or "NO_LONGER_AVAILABLE" in msg


def _is_retryable(exc: Exception) -> bool:
    """503 UNAVAILABLE / 429 RATE_LIMIT → 같은 모델 재시도 가능."""
    code = _get_status_code(exc)
    if code in _RETRYABLE_CODES:
        return True
    msg = str(exc).upper()
    return "UNAVAILABLE" in msg or "RATE" in msg or "QUOTA" in msg


# ── 핵심 함수 ─────────────────────────────────────────────────────────────────

def call_with_retry(
    fn: Callable[[str], T],
    primary_model: str | None = None,
    fallback_model: str | None = None,
) -> T:
    """
    fn(model_name) → T 를 모델 체인 + 재시도로 실행.

    Parameters
    ----------
    fn             : 모델명을 인자로 받아 Gemini API를 호출하는 함수
    primary_model  : 기본 모델 (None → settings.GEMINI_MODEL)
    fallback_model : 폴백 모델 (None → settings.GEMINI_FALLBACK_MODEL)

    Flow
    ----
    primary 모델:
      - 404 NOT_FOUND  → 재시도 없이 즉시 fallback 모델로 전환
      - 503/429        → 지수 백오프 재시도 (최대 RETRY_COUNT) → fallback 모델로 전환
      - 기타 에러      → 즉시 GeminiServiceError raise
    fallback 모델:
      - 404 NOT_FOUND  → GeminiServiceError raise (더 이상 시도할 모델 없음)
      - 503/429        → 지수 백오프 재시도 (최대 RETRY_COUNT) → GeminiServiceError raise
      - 기타 에러      → 즉시 GeminiServiceError raise
    """
    primary  = primary_model  or settings.GEMINI_MODEL
    fallback = fallback_model or settings.GEMINI_FALLBACK_MODEL

    # 중복 제거한 모델 체인
    model_chain: list[str] = [primary]
    if fallback and fallback != primary:
        model_chain.append(fallback)

    last_exc: Exception | None = None

    for model_idx, model in enumerate(model_chain):
        is_last_model = (model_idx == len(model_chain) - 1)
        delay = _INITIAL_DELAY
        move_to_next = False   # 이 모델을 포기하고 다음으로 넘어갈 플래그

        for attempt in range(1, _RETRY_COUNT + 1):
            try:
                return fn(model)

            except Exception as exc:
                last_exc = exc

                # ── 404: 모델 자체가 없음 ───────────────────────────────────
                if _is_model_dead(exc):
                    logger.warning(
                        "모델 사용 불가 [404] (model=%s) → %s: %s",
                        model,
                        "다음 모델로 전환" if not is_last_model else "더 이상 시도할 모델 없음",
                        exc,
                    )
                    move_to_next = True
                    break   # 이 모델 재시도 없이 즉시 포기

                # ── 503/429: 일시 과부하 ────────────────────────────────────
                if _is_retryable(exc):
                    logger.warning(
                        "Gemini 호출 실패 (model=%s, attempt=%d/%d, delay=%.1fs): %s",
                        model, attempt, _RETRY_COUNT, delay, exc,
                    )
                    if attempt < _RETRY_COUNT:
                        time.sleep(delay)
                        delay *= _BACKOFF
                    else:
                        # 재시도 횟수 소진 → 다음 모델로
                        logger.warning(
                            "모델 %s 재시도 소진 → %s",
                            model,
                            f"다음 모델 {model_chain[model_idx + 1]} 시도" if not is_last_model
                            else "모든 모델 소진",
                        )
                        move_to_next = True

                # ── 기타: 재시도 의미 없는 에러 ─────────────────────────────
                else:
                    raise GeminiServiceError(f"AI 호출 실패: {exc}") from exc

        if move_to_next and not is_last_model:
            continue   # 다음 모델로

    raise GeminiServiceError(
        f"AI 호출 실패 (모든 모델 소진): {last_exc}"
    ) from last_exc
