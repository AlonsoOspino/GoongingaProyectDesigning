@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem One-click Goonginga production deploy.
rem Run from Explorer or: deploy-goonginga.bat "Your commit message"

cd /d "%~dp0"
set "DEPLOY_BRANCH=main"
set "VPS_PROJECT=/opt/goonginga/migration-uidesign"
set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

rem The production server address is not committed. Put it in deploy.local.bat
rem (git-ignored) next to this file; copy deploy.local.bat.example to start.
if exist "%~dp0deploy.local.bat" call "%~dp0deploy.local.bat"

echo.
echo ============================================================
echo   GOONGINGA - COMMIT, PUSH AND VPS DEPLOY
echo ============================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto not_a_repo

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if not "%CURRENT_BRANCH%"=="%DEPLOY_BRANCH%" goto wrong_branch

if not defined VPS_HOST goto missing_host

if not exist "%SSH_KEY%" goto missing_key

if /i "%~1"=="--check" goto check_only

if "%~1"=="" goto ask_message
set "COMMIT_MESSAGE=%*"
goto message_ready

:ask_message
set /p "COMMIT_MESSAGE=Commit message: "

:message_ready
if not defined COMMIT_MESSAGE goto missing_message

echo [1/7] Compiling the Java backend...
pushd "backend-springboot"
call mvnw.cmd -B -DskipTests package
if errorlevel 1 goto test_failed_from_backend
popd

echo.
echo [2/7] Building both frontends locally...
pushd "migration-uidesign\frontend"
call npm run build
if errorlevel 1 goto build_failed_from_frontend
popd
pushd "migration-uidesign\minigames-frontend"
call npm run build
if errorlevel 1 goto build_failed_from_minigames
popd

echo.
echo [3/7] Reviewing explicitly staged changes...
rem Stage the intended files with git add before running this script.
rem Unrelated edits and deletions are not included automatically.
git diff --cached --stat

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
echo [6/7] Pulling and deploying backend + frontends on the VPS...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=yes "%VPS_HOST%" "set -e; cd '%VPS_PROJECT%'; bash scripts/update-vps-checkout.sh '%DEPLOY_BRANCH%'; bash scripts/deploy-vps.sh"
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
echo ERROR: Java compilation failed. Nothing was committed or deployed. Use JDK 21.
goto failed

:build_failed_from_frontend
popd
echo.
echo ERROR: Frontend build failed. Nothing was committed or deployed.
goto failed

:build_failed_from_minigames
popd
echo.
echo ERROR: Minigames frontend build failed. Nothing was committed or deployed.
goto failed

:not_a_repo
echo ERROR: This BAT must stay in the root of the Goonginga repository.
goto failed

:wrong_branch
echo ERROR: Production deploys must run from %DEPLOY_BRANCH%. Current branch: %CURRENT_BRANCH%
goto failed

:missing_host
echo ERROR: VPS_HOST is not set.
echo Copy deploy.local.bat.example to deploy.local.bat and put your server
echo address in it. That file is git-ignored so the address stays off GitHub.
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
where java >nul 2>&1
if errorlevel 1 goto missing_tool
echo BAT preflight passed. Use JDK 21 through JAVA_HOME.
exit /b 0

:missing_tool
echo ERROR: Git, npm, Java 21 and OpenSSH must be available.
goto failed

:failed
echo.
pause
exit /b 1
