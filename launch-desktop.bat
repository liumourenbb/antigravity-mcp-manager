@echo off
title Antigravity MCP Manager
cd /d "%~dp0"

if exist "%~dp0dist\windows11\windows11.exe" (
  start "" "%~dp0dist\windows11\windows11.exe"
) else if exist "%~dp0windows11.exe" (
  start "" "%~dp0windows11.exe"
) else if exist "%~dp0dist\Antigravity-MCP-Manager\Antigravity-MCP-Manager.exe" (
  start "" "%~dp0dist\Antigravity-MCP-Manager\Antigravity-MCP-Manager.exe"
) else if exist "%~dp0node_modules\electron\dist\electron.exe" (
  start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
) else (
  start "" "%~dp0node_modules\.bin\electron.cmd" "%~dp0"
)
