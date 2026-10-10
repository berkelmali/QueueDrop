@echo off
setlocal
cd /d "%~dp0"

echo.
echo   QueueDrop - yerel sunucu
echo   Adres:  http://127.0.0.1:5500/
echo   Durdurmak icin Ctrl+C
echo.
echo   NOT: Spotify Dashboard'daki Redirect URI de tam olarak
echo        http://127.0.0.1:5500/  olmali. "localhost" kabul edilmiyor.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 5500 --bind 127.0.0.1
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 5500 --bind 127.0.0.1
  goto :end
)

where npx >nul 2>nul
if %errorlevel%==0 (
  npx --yes http-server . -a 127.0.0.1 -p 5500 -c-1
  goto :end
)

echo   Python veya Node bulunamadi.
echo   VS Code Live Server kullanin, ya da Python kurun:
echo   https://www.python.org/downloads/
echo.
pause

:end
endlocal
