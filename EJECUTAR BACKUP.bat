@echo off
title Sincronizador de Backup JOA
echo Iniciando sincronizacion de seguridad...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0backups\sync_nas_backup.ps1"
echo.
echo Proceso terminado. Presiona cualquier tecla para cerrar.
pause > nul
