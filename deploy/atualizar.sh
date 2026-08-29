#!/usr/bin/env bash
# =====================================================================
# Publica uma versão nova no servidor.
#
#   sudo -u otica -H /opt/otica/deploy/atualizar.sh
#
# O -H é obrigatório: sem ele o HOME continua sendo o de quem chamou o sudo,
# o usuário otica não consegue escrever o cache do npm e o "npm ci" falha.
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
# --delete limpa os assets antigos, que têm hash no nome.
# Sem sudo: /var/www/otica pertence ao usuário otica (o Nginx só precisa ler).
rsync -a --delete "$RAIZ/frontend/dist/" "$WEBROOT/"

# O Nginx roda como www-data. Os arquivos que o Vite GERA nascem 0644, mas os de
# public/ são COPIADOS preservando o modo — se vierem 0700, o Nginx responde 403
# neles (favicon, manifest) e serve o resto normalmente.
chmod -R a+rX "$WEBROOT"

echo "==> Reiniciando a API"
# único comando que precisa de root — liberado sem senha em
# /etc/sudoers.d/otica-api (veja deploy/otica-sudoers)
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
