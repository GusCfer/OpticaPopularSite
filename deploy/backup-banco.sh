#!/usr/bin/env bash
# =====================================================================
# Backup do PostgreSQL (que roda no container otica-postgres).
#
# Rode na mão:      ./deploy/backup-banco.sh
# Ou todo dia às 2h, no crontab do root:
#   0 2 * * * /opt/otica/deploy/backup-banco.sh >> /var/log/otica-backup.log 2>&1
#
# Guarda os últimos 14 dias em /var/backups/otica.
# =====================================================================
set -euo pipefail

DESTINO="${BACKUP_DIR:-/var/backups/otica}"
CONTAINER="${DB_CONTAINER:-otica-postgres}"
BANCO="${POSTGRES_DB:-otica_popular}"
USUARIO="${POSTGRES_USER:-otica}"
DIAS="${RETENCAO_DIAS:-14}"

mkdir -p "$DESTINO"
ARQUIVO="$DESTINO/otica-$(date +%Y%m%d-%H%M%S).sql.gz"

echo "[backup] gerando $ARQUIVO"
docker exec "$CONTAINER" pg_dump -U "$USUARIO" -d "$BANCO" | gzip > "$ARQUIVO"

# um dump vazio quase sempre quer dizer que o pg_dump falhou no meio
if [ ! -s "$ARQUIVO" ]; then
  echo "[backup] ERRO: o arquivo saiu vazio" >&2
  rm -f "$ARQUIVO"
  exit 1
fi

echo "[backup] ok — $(du -h "$ARQUIVO" | cut -f1)"

echo "[backup] apagando backups com mais de $DIAS dias"
find "$DESTINO" -name 'otica-*.sql.gz' -mtime "+$DIAS" -delete

# As fotos dos produtos não estão no banco: guarde-as também.
if [ -d /opt/otica/backend/uploads ]; then
  tar -czf "$DESTINO/uploads-$(date +%Y%m%d).tar.gz" -C /opt/otica/backend uploads
  find "$DESTINO" -name 'uploads-*.tar.gz' -mtime "+$DIAS" -delete
fi
