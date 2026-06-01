@echo off
REM ===========================================================
REM 케어알림장 - 매번 실행 (Windows)
REM 사용:
REM   scripts\start-all.bat            로컬 개발 모드
REM   scripts\start-all.bat --ngrok    발표용 ngrok 모드
REM
REM 동작:
REM   1. DB 컨테이너 동작 확인 (없으면 시작)
REM   2. 백엔드를 새 창에서 시작
REM   3. 프론트를 새 창에서 시작
REM   4. --ngrok 옵션이면 ngrok 멀티 터널 시작 + URL 출력
REM ===========================================================

setlocal EnableDelayedExpansion

REM 프로젝트 루트로 이동
cd /d "%~dp0\.."

REM ngrok 옵션 파싱
set NGROK_MODE=0
if /i "%~1"=="--ngrok" set NGROK_MODE=1

echo.
echo ===========================================================
if !NGROK_MODE!==1 (
  echo  케어알림장 일괄 실행 [발표 모드 - ngrok]
) else (
  echo  케어알림장 일괄 실행 [로컬 개발 모드]
)
echo ===========================================================
echo.

REM ----- 1. DB 컨테이너 확인 -----
echo [1/4] DB 컨테이너 동작 확인...
docker ps --filter "name=carealimjang-db" --filter "status=running" | findstr carealimjang-db >nul
if errorlevel 1 (
  echo   - DB 컨테이너가 꺼져 있음. 시작 중...
  docker compose up -d db
  REM 헬스 체크 대기
  set /a wait_count=0
:wait_db
  docker exec carealimjang-db pg_isready -U carealimjang -d carealimjang >nul 2>&1
  if errorlevel 1 (
    set /a wait_count+=1
    if !wait_count! gtr 30 (
      echo [에러] DB 시작 실패
      exit /b 1
    )
    timeout /t 1 /nobreak >nul
    goto wait_db
  )
) else (
  echo   - DB 이미 실행 중
)
echo.

REM ----- 2. 백엔드 시작 (새 창) -----
echo [2/4] 백엔드 시작 (새 터미널 창)...
where uv >nul 2>&1
if errorlevel 1 (
  start "케어알림장 백엔드" cmd /k "cd backend && .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
) else (
  start "케어알림장 백엔드" cmd /k "cd backend && uv run uvicorn app.main:app --reload --port 8000"
)
echo   - http://localhost:8000 (Swagger: /docs)
echo.

REM ----- 3. 프론트 시작 (새 창) -----
echo [3/4] 프론트 시작 (새 터미널 창)...
start "케어알림장 프론트" cmd /k "cd frontend && npm run dev"
echo   - http://localhost:5173
echo.

REM ----- 4. ngrok 모드 -----
if !NGROK_MODE!==1 (
  echo [4/4] ngrok 멀티 터널 시작...
  where ngrok >nul 2>&1
  if errorlevel 1 (
    echo [에러] ngrok이 설치되어 있지 않습니다.
    echo        https://ngrok.com/download 에서 설치 후 다시 시도.
    exit /b 1
  )

  REM 백엔드·프론트가 준비될 때까지 잠시 대기
  echo   - 백엔드/프론트 준비 대기 (8초)...
  timeout /t 8 /nobreak >nul

  REM ngrok 멀티 터널 시작 (별도 창)
  start "ngrok" cmd /k "ngrok start --all"

  REM ngrok API 준비 대기
  echo   - ngrok 터널 활성화 대기 (5초)...
  timeout /t 5 /nobreak >nul

  REM ngrok 로컬 API 에서 현재 활성 URL 조회
  REM (PowerShell 통해 JSON 파싱)
  echo.
  echo ===========================================================
  echo  ngrok 활성 URL
  echo ===========================================================
  powershell -NoProfile -Command ^
    "try { $r = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels' -ErrorAction Stop; " ^
    "  foreach ($t in $r.tunnels) {" ^
    "    $name = $t.name; $url = $t.public_url;" ^
    "    if ($name -like '*frontend*') { Write-Host ''; Write-Host '[프론트 - 평가자에게 공유]' -ForegroundColor Green; Write-Host \"  $url\" -ForegroundColor Cyan }" ^
    "    elseif ($name -like '*backend*') { Write-Host ''; Write-Host '[백엔드 - API 내부용]' -ForegroundColor Yellow; Write-Host \"  $url\" -ForegroundColor Cyan }" ^
    "  } " ^
    "} catch { Write-Host '[에러] ngrok API 응답 없음. ngrok 창 확인.' -ForegroundColor Red }"

  echo.
  echo ===========================================================
  echo  주의 사항
  echo ===========================================================
  echo.
  echo   1. 평가자에게 [프론트 URL] 만 공유하세요.
  echo   2. 백엔드 ngrok URL 을 사용하려면:
  echo      - frontend\.env 의 VITE_API_BASE_URL 을 백엔드 URL 로 갱신
  echo      - 프론트 터미널에서 Ctrl+C 후 npm run dev 재시작
  echo      (Vite 는 env 변경 시 자동 리로드 안 함)
  echo   3. CORS 설정에 ngrok 도메인이 허용되어 있는지 확인
  echo      (backend/app/main.py 의 allow_origin_regex)
  echo   4. Vite allowedHosts 에 .ngrok-free.app 포함되어 있는지 확인
  echo   5. 발표 끝나면 ngrok 창에서 Ctrl+C 로 즉시 종료
  echo.
) else (
  echo [4/4] ngrok 모드 아님 (로컬만)
  echo.
  echo ===========================================================
  echo  로컬 접속 주소
  echo ===========================================================
  echo.
  echo   백엔드: http://localhost:8000
  echo   프론트: http://localhost:5173
  echo.
)

echo.
echo 종료: 각 새 터미널 창에서 Ctrl+C
echo DB도 끄려면: docker compose down
echo.

endlocal
