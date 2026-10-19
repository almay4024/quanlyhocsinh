@echo off
chcp 65001 >nul
echo ========================================================
echo   TU DONG PUSH GITHUB VA DEPLOY FIREBASE (LOP HOC VUI v2.9)
echo ========================================================
cd /d "%~dp0"
echo.
echo [1/2] Dang cap nhat code len GitHub...
git add -A
git commit -m "Release Lop Hoc Vui v2.9"
git push
echo.
echo [2/2] Dang deploy len Firebase Hosting...
call firebase deploy --only hosting || call npx firebase-tools deploy --only hosting
echo.
echo ========================================================
echo   HOAN TAT CAP NHAT LEN GITHUB VA FIREBASE!
echo ========================================================
pause
