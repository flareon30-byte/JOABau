# Configuración del servidor
$Server = "joatechnologien.de"
$RemotePath = "/root/backups_auto/"

# RUTA DEL NAS (Configurada a tu carpeta local que sincroniza con el NAS)
$NASPath = "C:\COPIAS Joa" 

Write-Host "----------------------------------------------------"
Write-Host "  Sincronizador de Backup JOA -> NAS Ugreen" -ForegroundColor Cyan
Write-Host "----------------------------------------------------"

# Verificar si la ruta del NAS está accesible
if (-not (Test-Path $NASPath)) {
    Write-Host "[ERROR] No se puede acceder a la ruta del NAS: $NASPath" -ForegroundColor Red
    Write-Host "Asegúrate de que el NAS esté encendido y la unidad conectada."
    Pause
    exit
}

Write-Host "[1/2] Conectando con el servidor $Server..." -ForegroundColor Yellow
# Descargar solo los archivos que no tengamos (o todos los de la carpeta auto)
# scp copiará los archivos del servidor a la carpeta del NAS
scp "root@$Server`:$RemotePath/*" "$NASPath"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[2/2] ¡Éxito! Los archivos se han copiado al NAS." -ForegroundColor Green
} else {
    Write-Host "[ERROR] Hubo un problema al descargar los archivos." -ForegroundColor Red
}

Write-Host "----------------------------------------------------"
Write-Host "Proceso finalizado."
# Pause # Quita el comentario si quieres que la ventana no se cierre sola al probarlo manualmente
