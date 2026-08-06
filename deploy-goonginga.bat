@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem One-click Goonginga production deploy.
rem Run from Explorer or: deploy-goonginga.bat "Your commit message"

cd /d "%~dp0"
set "DEPLOY_BRANCH=main"
set "VPS_HOST=ubuntu@51.79.86.24"
set "VPS_PROJECT=/opt/goonginga/migration-uidesign"
set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

echo.
echo ============================================================
echo   GOONGINGA - COMMIT, PUSH AND VPS DEPLOY
echo ============================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto not_a_repo

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if not "%CURRENT_BRANCH%"=="%DEPLOY_BRANCH%" goto wrong_branch

if not exist "%SSH_KEY%" goto missing_key

if /i "%~1"=="--check" goto check_only

if "%~1"=="" goto ask_message
set "COMMIT_MESSAGE=%*"
goto message_ready

:ask_message
set /p "COMMIT_MESSAGE=Commit message: "

:message_ready
if not defined COMMIT_MESSAGE goto missing_message

echo [1/7] Running backend tests...
pushd "migration-uidesign\backend"
call npm test
if errorlevel 1 goto test_failed_from_backend
popd

echo.
echo [2/7] Building frontend locally...
pushd "migration-uidesign\frontend"
call npm run build
if errorlevel 1 goto build_failed_from_frontend
popd

echo.
echo [3/7] Staging project changes...
git add -A
rem This generated compiler cache is tracked historically, but should not be
rem included in routine deploy commits.
git reset -- "migration-uidesign/frontend/tsconfig.tsbuildinfo" >nul 2>&1

git diff --cached --quiet
if errorlevel 1 goto commit_changes
echo No staged source changes. Deploying the current main branch.
goto push_branch

:commit_changes
echo [4/7] Creating commit...
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto commit_failed

:push_branch
echo.
echo [5/7] Pushing origin/%DEPLOY_BRANCH%...
git push origin "%DEPLOY_BRANCH%"
if errorlevel 1 goto push_failed

echo.
echo [6/7] Pulling and deploying backend + frontend on the VPS...
rem Caddyfile and compose.yaml are intentionally NOT restored: the VPS keeps
rem its Adara/network configuration. The explicit clean paths below only
rem reconcile files from the older manual Finals deployment on the first run.
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=accept-new "%VPS_HOST%" "cd '%VPS_PROJECT%' && git restore --source=HEAD --worktree -- backend frontend && git clean -fd -- backend/prisma/migrations/20260805000000_add_finals_presentation_time backend/prisma/migrations/20260805010000_add_finals_presentation_version backend/tests/finalsPresentation.test.js frontend/src/app/finals frontend/src/components/finals && git pull --ff-only origin '%DEPLOY_BRANCH%' && bash scripts/deploy-vps.sh"
if errorlevel 1 goto deploy_failed

echo.
echo [7/7] Deployment complete.
echo Production: https://goongingaleague.duckdns.org
echo Finals:     https://goongingaleague.duckdns.org/finals
echo.
pause
exit /b 0

:test_failed_from_backend
popd
echo.
echo ERROR: Backend tests failed. Nothing was committed or deployed.
goto failed

:build_failed_from_frontend
popd
echo.
echo ERROR: Frontend build failed. Nothing was committed or deployed.
goto failed

:not_a_repo
echo ERROR: This BAT must stay in the root of the Goonginga repository.
goto failed

:wrong_branch
echo ERROR: Production deploys must run from %DEPLOY_BRANCH%. Current branch: %CURRENT_BRANCH%
goto failed

:missing_key
echo ERROR: SSH key not found: %SSH_KEY%
goto failed

:missing_message
echo ERROR: A commit message is required.
goto failed

:commit_failed
echo ERROR: Git could not create the commit.
goto failed

:push_failed
echo ERROR: GitHub push failed. The VPS was not changed.
goto failed

:deploy_failed
echo ERROR: VPS deployment failed. Review the output above.
goto failed

:check_only
where git >nul 2>&1
if errorlevel 1 goto missing_tool
where npm >nul 2>&1
if errorlevel 1 goto missing_tool
where ssh >nul 2>&1
if errorlevel 1 goto missing_tool
echo BAT preflight passed. Branch, Git, npm, SSH and the VPS key are available.
exit /b 0

:missing_tool
echo ERROR: Git, npm and OpenSSH must be available in PATH.
goto failed

:failed
echo.
pause
exit /b 1
