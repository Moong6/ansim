@echo off
REM ===========================================================
REM 케어알림장 - 초기 환경 세팅 (Windows)
REM 사용: scripts\setup.bat
REM
REM 동작:
REM   1. Docker로 PostgreSQL 컨테이너 시작
REM   2. DB 준비 대기 (헬스 체크)
REM   3. 백엔드 의존성 설치 (uv 우선, 실패 시 pip)
REM   4. Alembic 마이그레이션 적용 (2~8차 + 패치)
REM   5. 프론트 의존성 설치
REM
REM 이 스크립트는 첫 환경 세팅이나 환경 재설정 시 1회만 실행.
REM 매일 작업 시작 시에는 start-all.bat 사용.
REM ===========================================================

setlocal EnableDelayedExpansion

REM 프로젝트 루트로 이동 (이 스크립트는 scripts/ 폴더 안)
cd /d "%~dp0\.."

echo.
echo ===========================================================
echo  케어알림장 초기 환경 세팅
echo ===========================================================
echo.

REM ----- 0. 사전 점검 -----
echo [0/5] 사전 도구 점검...
where docker >nul 2>&1
if errorlevel 1 (
  echo [에러] Docker가 설치되어 있지 않습니다. Docker Desktop 설치 필요.
  exit /b 1
)
where python >nul 2>&1
if errorlevel 1 (
  echo [에러] Python이 설치되어 있지 않습니다.
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo [에러] Node.js가 설치되어 있지 않습니다.
  exit /b 1
)
echo   - Docker, Python, Node OK
echo.

REM ----- 1. DB 컨테이너 시작 -----
echo [1/5] PostgreSQL 컨테이너 시작...
docker compose up -d db
if errorlevel 1 (
  echo [에러] docker compose 실패. docker-compose.yml 위치 확인.
  exit /b 1
)
echo.

REM ----- 2. DB 준비 대기 -----
echo [2/5] DB 헬스 체크 대기 (최대 30초)...
set /a wait_count=0
:wait_db
docker exec carealimjang-db pg_isready -U carealimjang -d carealimjang >nul 2>&1
if errorlevel 1 (
  set /a wait_count+=1
  if !wait_count! gtr 30 (
    echo [에러] DB가 30초 안에 준비되지 않았습니다. docker logs carealimjang-db 로 확인.
    exit /b 1
  )
  timeout /t 1 /nobreak >nul
  goto wait_db
)
echo   - DB 준비 완료
echo.

REM ----- 3. 백엔드 의존성 설치 -----
echo [3/5] 백엔드 의존성 설치...
cd backend
where uv >nul 2>&1
if errorlevel 1 (
  echo   - uv 미설치, pip 사용
  if not exist ".venv\" (
    python -m venv .venv
  )
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt
  if errorlevel 1 (
    echo [에러] pip install 실패
    exit /b 1
  )
) else (
  echo   - uv 사용
  uv sync
  if errorlevel 1 (
    echo [에러] uv sync 실패
    exit /b 1
  )
)
echo.

REM ----- 4. Alembic 마이그레이션 -----
echo [4/5] DB 마이그레이션 적용 (2~8차 + 패치)...
echo   * 1차 시드(init_db.sql)는 컨테이너 첫 실행 시 자동 적용됨
where uv >nul 2>&1
if errorlevel 1 (
  alembic upgrade head
) else (
  uv run alembic upgrade head
)
if errorlevel 1 (
  echo [경고] Alembic 마이그레이션 실패. 이미 적용됐거나 환경 확인 필요.
  echo        (init_db.sql만 적용된 상태로 진행 가능 — 신규 기능 일부 동작 X)
)
echo.

REM ----- 5. 프론트 의존성 설치 -----
echo [5/5] 프론트 의존성 설치...
cd ..\frontend
call npm install
if errorlevel 1 (
  echo [에러] npm install 실패
  exit /b 1
)
echo.

cd ..

REM ----- 마무리 안내 -----
echo ===========================================================
echo  세팅 완료
echo ===========================================================
echo.
echo 다음 단계:
echo   - 매번 실행:   scripts\start-all.bat
echo   - 발표 모드:   scripts\start-all.bat --ngrok
echo.
echo 테스트 계정:
echo   직원   minji@happy.kr / test1234
echo   보호자 boram@family.kr / test1234
echo.

endlocal
