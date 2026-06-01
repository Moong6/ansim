#!/bin/bash
# ===========================================================
# 케어알림장 - 초기 환경 세팅 (macOS/Linux)
# 사용: ./scripts/setup.sh
#
# 동작:
#   1. Docker로 PostgreSQL 컨테이너 시작
#   2. DB 준비 대기 (헬스 체크)
#   3. 백엔드 의존성 설치 (uv 우선, 실패 시 pip)
#   4. Alembic 마이그레이션 적용 (2~8차 + 패치)
#   5. 프론트 의존성 설치
#
# 이 스크립트는 첫 환경 세팅이나 환경 재설정 시 1회만 실행.
# 매일 작업 시작 시에는 start-all.sh 사용.
# ===========================================================

set -e

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

echo ""
echo "==========================================================="
echo " 케어알림장 초기 환경 세팅"
echo "==========================================================="
echo ""

# ----- 0. 사전 점검 -----
echo "[0/5] 사전 도구 점검..."
command -v docker >/dev/null 2>&1 || { echo "[에러] Docker 미설치"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "[에러] Python3 미설치"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[에러] Node.js 미설치"; exit 1; }
echo "  - Docker, Python, Node OK"
echo ""

# ----- 1. DB 컨테이너 시작 -----
echo "[1/5] PostgreSQL 컨테이너 시작..."
docker compose up -d db
echo ""

# ----- 2. DB 준비 대기 -----
echo "[2/5] DB 헬스 체크 대기 (최대 30초)..."
wait_count=0
until docker exec carealimjang-db pg_isready -U carealimjang -d carealimjang >/dev/null 2>&1; do
  wait_count=$((wait_count + 1))
  if [ $wait_count -gt 30 ]; then
    echo "[에러] DB가 30초 안에 준비되지 않았습니다. docker logs carealimjang-db 로 확인."
    exit 1
  fi
  sleep 1
done
echo "  - DB 준비 완료"
echo ""

# ----- 3. 백엔드 의존성 설치 -----
echo "[3/5] 백엔드 의존성 설치..."
cd backend
if command -v uv >/dev/null 2>&1; then
  echo "  - uv 사용"
  uv sync
else
  echo "  - uv 미설치, pip 사용"
  if [ ! -d ".venv" ]; then
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  pip install -r requirements.txt
fi
echo ""

# ----- 4. Alembic 마이그레이션 -----
echo "[4/5] DB 마이그레이션 적용 (2~8차 + 패치)..."
echo "  * 1차 시드(init_db.sql)는 컨테이너 첫 실행 시 자동 적용됨"
if command -v uv >/dev/null 2>&1; then
  uv run alembic upgrade head || echo "[경고] Alembic 마이그레이션 실패. 환경 확인 필요."
else
  alembic upgrade head || echo "[경고] Alembic 마이그레이션 실패. 환경 확인 필요."
fi
echo ""

# ----- 5. 프론트 의존성 설치 -----
echo "[5/5] 프론트 의존성 설치..."
cd ../frontend
npm install
echo ""

cd ..

# ----- 마무리 안내 -----
echo "==========================================================="
echo " 세팅 완료"
echo "==========================================================="
echo ""
echo "다음 단계:"
echo "  - 매번 실행:   ./scripts/start-all.sh"
echo "  - 발표 모드:   ./scripts/start-all.sh --ngrok"
echo ""
echo "테스트 계정:"
echo "  직원   minji@happy.kr / test1234"
echo "  보호자 boram@family.kr / test1234"
echo ""
