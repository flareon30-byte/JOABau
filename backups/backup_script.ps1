$date = Get-Date -Format "yyyy_MM_dd"
$backupName = "JOA_BACKUP_$date"
$backupDir = Join-Path $pwd.Path $backupName

Write-Host "Creando directorio de backup: $backupName"
New-Item -ItemType Directory -Path $backupDir -Force

# Copiar archivos del root si existen
$rootFiles = @("package.json", "package-lock.json", ".gitignore", "README.md")
foreach ($file in $rootFiles) {
    if (Test-Path $file) { Copy-Item $file $backupDir }
}

# Copiar carpetas principales excluyendo node_modules
Write-Host "Copiando archivos de código (esto puede tardar...)"
Copy-Item -Path "client" -Destination (Join-Path $backupDir "client") -Recurse -Exclude "node_modules", ".git"
Copy-Item -Path "server" -Destination (Join-Path $backupDir "server") -Recurse -Exclude "node_modules", ".git"

Write-Host "Copia de archivos completada."

# Mover el dump de la DB dentro de la carpeta de backup
if (Test-Path "backups/db_backup_2026_04_21.sql") {
    Copy-Item "backups/db_backup_2026_04_21.sql" (Join-Path $backupDir "database_dump.sql")
}

Write-Host "Comprimiendo backup..."
Compress-Archive -Path $backupDir -DestinationPath "$backupDir.zip" -Force

Write-Host "Backup completado con éxito: $backupDir.zip"
Remove-Item -Path $backupDir -Recurse -Force
