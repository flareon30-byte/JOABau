#!/bin/bash

# Configuration
BACKUP_DIR="/root/backups_auto"
DATE=$(date +%Y%m%d_%H%M)
DB_CONTAINER="app-postgres-1"
DB_NAME="fiberoptics"
DB_USER="admin"
UPLOADS_SOURCE="/root/app/server/uploads"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Log start
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated backup..." >> $BACKUP_DIR/backup.log

# 1. DB Backup
docker exec $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# 2. Uploads Backup
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz -C $(dirname $UPLOADS_SOURCE) $(basename $UPLOADS_SOURCE)

# 3. Cleanup (Keep only last 4 backups - approx 1 month)
ls -tp $BACKUP_DIR/db_backup_*.sql | grep -v '/$' | tail -n +5 | xargs -r rm
ls -tp $BACKUP_DIR/uploads_backup_*.tar.gz | grep -v '/$' | tail -n +5 | xargs -r rm

# Log end
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully. Files: db_backup_$DATE.sql, uploads_backup_$DATE.tar.gz" >> $BACKUP_DIR/backup.log
