#!/usr/bin/env bash
# =====================================================================
# Publica uma versão nova no servidor.
#
#   cd /opt/otica && sudo -u otica ./deploy/atualizar.sh
#
# Faz, nesta ordem: baixa o código, instala dependências, aplica as
# migrações do banco, compila o site e reinicia a API.
# =====================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# pasta que o Nginx serve (o "root" do deploy/nginx-otica.conf)
WEBROOT="${WEBROOT:-/var/www/otica}"
cd "$RAIZ"

echo "==> Código novo"
if [ -d .git ]; then
  git pull --ff-only
else
  echo "    (sem git aqui — assumindo que os arquivos já foram enviados)"
fi

echo "==> Dependências da API"
cd "$RAIZ/backend"
npm ci --omit=dev

echo "==> Migrações do banco"
npm run migrar

echo "==> Compilando o site"
cd "$RAIZ/frontend"
npm ci
npm run build

echo "==> Publicando os arquivos do site"
# --delete limpa os assets antigos, que têm hash no nome
sudo rsync -a --delete "$RAIZ/frontend/dist/" "$WEBROOT/"
sudo chown -R www-data:www-data "$WEBROOT"

echo "==> Reiniciando a API"
sudo systemctl restart otica-api
sleep 3

echo "==> Conferindo"
if curl -fsS --max-time 5 http://127.0.0.1:3333/api/health > /dev/null; then
  echo
  echo "✓ No ar. Logs:  journalctl -u otica-api -f"
else
  echo
  echo "✗ A API não respondeu. Veja o que houve:"
  echo "    journalctl -u otica-api -n 50 --no-pager"
  exit 1
fi
