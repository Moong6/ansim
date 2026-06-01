#!/bin/bash
# ===========================================================
# 케어알림장 - 매번 실행 (macOS/Linux)
# 사용:
#   ./scripts/start-all.sh            로컬 개발 모드
#   ./scripts/start-all.sh --ngrok    발표용 ngrok 모드
#
# 동작:
#   1. DB 컨테이너 동작 확인 (없으면 시작)
#   2. 백엔드를 백그라운드 또는 새 터미널에서 시작
#   3. 프론트를 백그라운드 또는 새 터미널에서 시작
#   4. --ngrok 옵션이면 ngrok 멀티 터널 + URL 출력
#
# 백엔드·프론트는 tmux 세션으로 관리하면 깔끔하지만,
# 단순화를 위해 백그라운드 프로세스 + 로그 파일 방식 사용.
# ===========================================================

set -e

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# ngrok 옵션
NGROK_MODE=0
if [ "$1" = "--ngrok" ]; then
  NGROK_MODE=1
fi

echo ""
echo "==========================================================="
if [ $NGROK_MODE -eq 1 ]; then
  echo " 케어알림장 일괄 실행 [발표 모드 - ngrok]"
else
  echo " 케어알림장 일괄 실행 [로컬 개발 모드]"
fi
echo "==========================================================="
echo ""

# 로그 폴더
mkdir -p logs

# ----- 1. DB 컨테이너 확인 -----
echo "[1/4] DB 컨테이너 동작 확인..."
if docker ps --filter "name=carealimjang-db" --filter "status=running" | grep -q carealimjang-db; then
  echo "  - DB 이미 실행 중"
else
  echo "  - DB 컨테이너 시작 중..."
  docker compose up -d db
  wait_count=0
  until docker exec carealimjang-db pg_isready -U carealimjang -d carealimjang >/dev/null 2>&1; do
    wait_count=$((wait_count + 1))
    if [ $wait_count -gt 30 ]; then
      echo "[에러] DB 시작 실패"
      exit 1
    fi
    sleep 1
  done
fi
echo ""

# ----- 2. 백엔드 시작 (백그라운드) -----
echo "[2/4] 백엔드 시작 (백그라운드, logs/backend.log)..."
cd backend
if command -v uv >/dev/null 2>&1; then
  nohup uv run uvicorn app.main:app --reload --port 8000 > ../logs/backend.log 2>&1 &
else
  nohup .venv/bin/python -m uvicorn app.main:app --reload --port 8000 > ../logs/backend.log 2>&1 &
fi
BACKEND_PID=$!
echo "  - PID: $BACKEND_PID  http://localhost:8000"
cd ..
echo ""

# ----- 3. 프론트 시작 (백그라운드) -----
echo "[3/4] 프론트 시작 (백그라운드, logs/frontend.log)..."
cd frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  - PID: $FRONTEND_PID  http://localhost:5173"
cd ..
echo ""

# PID 저장 (종료 시 사용)
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid

# ----- 4. ngrok 모드 -----
if [ $NGROK_MODE -eq 1 ]; then
  echo "[4/4] ngrok 멀티 터널 시작..."

  if ! command -v ngrok >/dev/null 2>&1; then
    echo "[에러] ngrok 미설치. https://ngrok.com/download"
    exit 1
  fi

  # 백엔드/프론트 준비 대기
  echo "  - 백엔드/프론트 준비 대기 (8초)..."
  sleep 8

  # ngrok 백그라운드 시작
  nohup ngrok start --all > logs/ngrok.log 2>&1 &
  NGROK_PID=$!
  echo "$NGROK_PID" > logs/ngrok.pid
  echo "  - ngrok PID: $NGROK_PID"

  # ngrok API 준비 대기
  echo "  - ngrok 터널 활성화 대기 (5초)..."
  sleep 5

  # ngrok API 에서 URL 조회
  echo ""
  echo "==========================================================="
  echo " ngrok 활성 URL"
  echo "==========================================================="
  if command -v jq >/dev/null 2>&1; then
    # jq 가 있으면 깔끔하게
    TUNNELS=$(curl -s http://localhost:4040/api/tunnels)
    FRONTEND_URL=$(echo "$TUNNELS" | jq -r '.tunnels[] | select(.name | contains("frontend")) | .public_url' | head -1)
    BACKEND_URL=$(echo "$TUNNELS" | jq -r '.tunnels[] | select(.name | contains("backend")) | .public_url' | head -1)
    echo ""
    echo "  [프론트 - 평가자에게 공유]"
    echo "    $FRONTEND_URL"
    echo ""
    echo "  [백엔드 - API 내부용]"
    echo "    $BACKEND_URL"
    echo ""
  else
    # jq 없으면 raw 출력
    echo ""
    echo "  jq 미설치. 아래 raw 응답에서 public_url 확인:"
    curl -s http://localhost:4040/api/tunnels
    echo ""
  fi

  echo "==========================================================="
  echo " 주의 사항"
  echo "==========================================================="
  echo ""
  echo "  1. 평가자에게 [프론트 URL] 만 공유하세요."
  echo "  2. 백엔드 ngrok URL 을 사용하려면:"
  echo "     - frontend/.env 의 VITE_API_BASE_URL 갱신"
  echo "     - 프론트 재시작 (Vite 는 env 자동 리로드 안 함)"
  echo "  3. CORS 설정에 ngrok 도메인 허용 확인"
  echo "     (backend/app/main.py 의 allow_origin_regex)"
  echo "  4. Vite allowedHosts 에 .ngrok-free.app 포함 확인"
  echo "  5. 발표 끝나면 ./scripts/stop-all.sh 또는 kill 사용"
  echo ""
else
  echo "[4/4] ngrok 모드 아님 (로컬만)"
  echo ""
  echo "==========================================================="
  echo " 로컬 접속 주소"
  echo "==========================================================="
  echo ""
  echo "  백엔드: http://localhost:8000"
  echo "  프론트: http://localhost:5173"
  echo ""
fi

echo ""
echo "==========================================================="
echo " 종료 방법"
echo "==========================================================="
echo ""
echo "  프로세스 종료:"
echo "    kill \$(cat logs/backend.pid)"
echo "    kill \$(cat logs/frontend.pid)"
if [ $NGROK_MODE -eq 1 ]; then
  echo "    kill \$(cat logs/ngrok.pid)"
fi
echo ""
echo "  DB 도 끄려면:"
echo "    docker compose down"
echo ""
echo "  로그 확인:"
echo "    tail -f logs/backend.log"
echo "    tail -f logs/frontend.log"
echo ""
