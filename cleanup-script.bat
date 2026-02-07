@echo off
REM Health Care Surgical Mart - Cleanup Script
REM This script helps maintain a clean project by removing temporary files

echo ========================================
echo Health Care Surgical Mart - Cleanup
echo ========================================
echo.

echo Cleaning log files...
if exist "logs\*" del /Q "logs\*"
if exist "server\logs\*" del /Q "server\logs\*"
echo ✓ Log files cleaned

echo.
echo Cleaning test files from root...
if exist "test-*.js" del /Q "test-*.js"
if exist "test-*.html" del /Q "test-*.html"
if exist "test-*.json" del /Q "test-*.json"
echo ✓ Test files cleaned

echo.
echo Cleaning build artifacts...
if exist "client\dist" rmdir /S /Q "client\dist"
if exist "server\dist" rmdir /S /Q "server\dist"
echo ✓ Build artifacts cleaned

echo.
echo Cleaning node_modules cache...
if exist "node_modules\.cache" rmdir /S /Q "node_modules\.cache"
if exist "client\node_modules\.cache" rmdir /S /Q "client\node_modules\.cache"
if exist "server\node_modules\.cache" rmdir /S /Q "server\node_modules\.cache"
echo ✓ Cache cleaned

echo.
echo Cleaning temporary files...
if exist "*.tmp" del /Q "*.tmp"
if exist "*.temp" del /Q "*.temp"
if exist "*.log" del /Q "*.log"
echo ✓ Temporary files cleaned

echo.
echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo Your project is now clean and ready.
echo.
pause
