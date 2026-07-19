@echo off
title Tailscale Controller Autostart Installer (No Logon)
color 0a

:: Check for administrative rights
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :elevated
) else (
    goto :elevate
)

:elevate
echo Requesting administrator privileges...
powershell -Command "Start-Process -FilePath '%0' -Verb RunAs"
exit /b

:elevated
echo =============================================================
echo      Registering System Boot Task (Tailscale Controller)
echo =============================================================
echo.

:: Delete the non-elevated startup shortcut if it exists
set "SHORTCUT_PATH=%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\TailscaleRemoteController.lnk"
if exist "%SHORTCUT_PATH%" (
    echo Removing old non-elevated shortcut...
    del "%SHORTCUT_PATH%"
)

:: Register the scheduled task to run at system startup under SYSTEM account (no logon or password required)
powershell -Command "Stop-ScheduledTask -TaskName 'TailscaleRemoteController' -ErrorAction SilentlyContinue; $Action = New-ScheduledTaskAction -Execute 'C:\Program Files\nodejs\node.exe' -Argument 'C:\Tools\remote-ts\server.js'; $Trigger = New-ScheduledTaskTrigger -AtStartup; $Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount; Register-ScheduledTask -TaskName 'TailscaleRemoteController' -Action $Action -Trigger $Trigger -Principal $Principal -Force; Start-ScheduledTask -TaskName 'TailscaleRemoteController'"

echo.
echo =============================================================
echo SUCCESS!
echo The Tailscale Remote Controller is now registered to start
echo automatically on SYSTEM BOOT (before logging on).
echo =============================================================
echo.
pause
