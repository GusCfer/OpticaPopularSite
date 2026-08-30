# Subir o site no servidor — passo a passo

Servidor **Ubuntu Server com CasaOS**, código enviado pelo **gerenciador de arquivos do
CasaOS**, domínio publicado por **Cloudflare Tunnel**.

Como fica no final:

```
Internet → Cloudflare → cloudflared → Nginx :8080 ─┬→ site compilado (/var/www/otica)
                                                   └→ /api e /uploads → API :3333 (systemd)
                                                                              ↓
                                                                PostgreSQL :5432 (Docker)
```

Só o `cloudflared` conversa com a internet. Nginx, API e banco ficam presos no
`localhost` — **nenhuma porta é aberta no roteador nem no firewall**.

> **Por que 8080 e não 80?** O CasaOS já escuta na porta 80. Como quem fala com o Nginx
> é só o `cloudflared`, no próprio servidor, a porta é indiferente — e assim o CasaOS
> continua funcionando sem você mexer nele.

Legenda dos comandos: tudo que começa com `sudo` roda no terminal do servidor (SSH ou
o terminal do próprio CasaOS). Troque `oticapopular.com.br` pelo seu domínio de verdade
em todos os lugares.

---

## Etapa 0 — Antes de começar

Tenha em mãos:

- Acesso SSH ao servidor (ou o app **Terminal** dentro do CasaOS).
- O domínio e o login do **registrador** onde ele foi comprado (Registro.br, GoDaddy,
  Hostinger…) — você vai precisar trocar os nameservers lá.
- Uma conta gratuita na Cloudflare.
- A **senha de app do Gmail** (16 letras) que já usa em desenvolvimento, se quiser os
  lembretes de consulta funcionando desde o começo.

Confira o que já existe no servidor:

```bash
lsb_release -a                                  # versão do Ubuntu
docker --version                                # o CasaOS já instala o Docker
node -v 2>/dev/null || echo "Node não instalado"
sudo ss -lntp | grep -E ':(80|8080|3333|5432|5050)\b'
```

A última linha mostra quais dessas portas já estão ocupadas. A **80** provavelmente vai
aparecer com o CasaOS — é o esperado. Se a **8080** também estiver em uso, escolha outra
livre (8081, 8090…) e use a mesma em todos os pontos deste guia.

---

## Etapa 1 — Instalar o que falta no Ubuntu

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl rsync unzip
```

### Node.js 22 LTS

O Vite 8 (que compila o site) exige Node 20.19+ ou 22.12+. O Node que vem no `apt` do
Ubuntu é velho demais, então instale pelo repositório da NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v        # tem que mostrar v22.x
npm -v
```

### Docker

O CasaOS já instala o Docker. Se o `docker --version` da etapa 0 falhou:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

### O Nginx não vai subir ainda

Ao instalar, o Nginx tenta ocupar a porta 80 — que é do CasaOS — e falha. É normal.
Remova o site padrão agora; na etapa 6 ele sobe na 8080 sem conflito:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

### Firewall

Feche tudo menos o SSH e a porta do CasaOS. O site inteiro entra pelo tunnel, que não
precisa de porta aberta:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp        # painel do CasaOS na sua rede local
sudo ufw enable
sudo ufw status
```

> Se você acessa o servidor **só** pela rede local, pode pular o `ufw` — mas então
> confira que o roteador não está com redirecionamento de portas para ele.

---

## Etapa 2 — Criar o usuário da aplicação

A API não roda como root. Um usuário de sistema, dono da pasta do projeto:

```bash
sudo useradd --system --shell /bin/bash --home-dir /opt/otica otica
sudo mkdir -p /opt/otica
sudo chown otica:otica /opt/otica
sudo usermod -aG docker otica          # para ele conseguir subir o banco
```

> Não use `--create-home` aqui. Ele copia os arquivos do `/etc/skel` para dentro de
> `/opt/otica` e atrapalha na hora de colocar o código lá.

---

## Etapa 3 — Mandar o código pelo CasaOS

Gere o pacote na sua máquina, na raiz do projeto:

```powershell
python gerar-zip.py
```

Ele escreve `_entrega\otica-servidor.zip` — uns 350 KB, só o código, sem `node_modules`,
sem `dist`, sem `.git` e **sem os arquivos `.env`** (as senhas de produção você cria direto
no servidor, na etapa 5). O script também força as permissões dos arquivos dentro do zip;
o porquê está na caixa no fim desta etapa.

1. Abra o CasaOS no navegador e entre no app **Files**.
2. Entre em `/DATA` e envie o `otica-servidor.zip`.

Agora, no terminal do servidor:

```bash
ls /DATA/otica-servidor.zip                   # confirme que chegou
unzip -q /DATA/otica-servidor.zip -d /tmp/otica-upload
ls /tmp/otica-upload/OticaPopularSap          # tem que listar backend, frontend, deploy…

sudo rsync -a /tmp/otica-upload/OticaPopularSap/ /opt/otica/
sudo chown -R otica:otica /opt/otica

# os containers rodam com outro uid e precisam LER estes arquivos
sudo chmod -R a+rX /opt/otica/docker
sudo chmod +x /opt/otica/deploy/*.sh

# os .env, ao contrário, ficam só para o dono
sudo chmod 600 /opt/otica/.env /opt/otica/backend/.env /opt/otica/frontend/.env 2>/dev/null

rm -rf /tmp/otica-upload
```

> **Por que o `chmod -R a+rX` em `docker/`.** O Postgres roda dentro do container como uid
> **999**, não como `otica`. Se os `.sql` de `docker/initdb/` ficarem sem permissão de
> leitura para "outros" (é o que acontece quando o zip carrega modo `0700` da pasta do
> Windows), o entrypoint enxerga `/docker-entrypoint-initdb.d/` **vazio**: ele cria um banco
> em branco e **não reclama de nada**. O erro só aparece muito depois, como
> `relation "usuarios" does not exist` no `npm run migrar`. O `gerar-zip.py` já grava `0644`,
> mas o `chmod` custa nada e cobre pacotes feitos de outro jeito.

> O CasaOS pode mostrar a pasta de upload com outro nome. Se `/DATA` não existir, procure
> com `sudo find / -name 'otica-servidor.zip' -not -path '*/proc/*' 2>/dev/null`.

---

## Etapa 4 — Subir o banco de dados

```bash
cd /opt/otica
sudo -u otica cp .env.example .env
sudo -u otica nano .env
```

Troque as duas senhas por valores fortes (guarde a do Postgres, você vai colar na etapa 5):

```ini
POSTGRES_USER=otica
POSTGRES_PASSWORD=COLOQUE_UMA_SENHA_FORTE_AQUI
POSTGRES_DB=otica_popular
POSTGRES_PORT=5432

PGADMIN_EMAIL=seuemail@gmail.com
PGADMIN_PASSWORD=OUTRA_SENHA_FORTE
PGADMIN_PORT=5050
```

Suba os containers **com o arquivo de produção junto** — é ele que prende o Postgres e o
pgAdmin no `127.0.0.1`:

```bash
sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
sudo -u otica docker compose ps
```

Na primeira subida o Postgres roda sozinho tudo que está em `docker/initdb/` — cria as
tabelas e as 4 categorias. Confira nos logs:

```bash
docker logs otica-postgres --tail 20        # procure "database system is ready"
```

Os dois containers vão aparecer no painel do CasaOS. **Não os gerencie por lá** — pare e
suba sempre pelo `docker compose`, senão o CasaOS perde as opções do arquivo de produção.

### Se der "address already in use" na 5432

```
failed to bind host port 127.0.0.1:5432/tcp: address already in use
```

Antes de caçar culpado no servidor, confira se não é o **próprio container brigando com
ele mesmo**. Ao juntar dois arquivos com `-f`, o Compose **não substitui** a lista `ports`:
ele **concatena**, e a chave de unicidade de cada publicação é `{ip, target, published,
protocol}`. Um `"5432:5432"` no arquivo base (que vira `0.0.0.0`) e um
`"127.0.0.1:5432:5432"` no arquivo de produção contam como **duas** publicações: o
container abre a primeira em `0.0.0.0:5432` e a segunda falha contra ela.

O sintoma é característico: `ss` e `lsof` vazios, `docker ps -a` sem nenhum outro container
na porta, e o erro se repete mesmo depois de `systemctl restart docker`.

Confira o que o Compose realmente montou:

```bash
cd /opt/otica
sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml config | grep -A6 'ports:'
```

Se aparecer mais de uma publicação para o mesmo serviço, é isso. Neste projeto o
`docker-compose.prod.yml` **não declara `ports`** justamente por causa disso — quem decide
o bind é o `docker-compose.yml`, pela variável `POSTGRES_BIND_IP` (padrão `127.0.0.1`).

### Se for outra coisa mesmo

```bash
sudo ss -antp | grep 5432        # sem o -l de propósito, veja o porquê abaixo
sudo lsof -nP -i :5432
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'   # o -a mostra os parados
systemctl list-units --all | grep -i postgres
```

> **Por que sem o `-l`.** Nas versões recentes do Docker quem abre o socket é o próprio
> daemon (é o que significa o `-use-listen-fd` no `docker-proxy`), e ele reserva a porta já
> na criação do container, antes de qualquer `listen()`. Um socket *bound* mas não
> *listening* não aparece nem no `ss -lntp` nem no `lsof -sTCP:LISTEN` — os dois filtram por
> listening.

Sobra de tentativa anterior (containers em **Created** no `docker ps -a`):

```bash
cd /opt/otica
sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans
docker rm -f otica-postgres otica-pgadmin 2>/dev/null
sudo systemctl restart docker
sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Se for outro serviço que você quer manter** (um Postgres de outro app do CasaOS, ou um
instalado pelo `apt`), não brigue pela porta — mude a nossa:

```bash
sudo -u otica nano /opt/otica/.env
#   POSTGRES_PORT=5433

sudo -u otica nano /opt/otica/backend/.env
#   DATABASE_URL=postgresql://otica:SUA_SENHA@localhost:5433/otica_popular

cd /opt/otica
sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Só o lado do **host** muda: dentro do container o Postgres continua na 5432, e o pgAdmin
fala com ele pela rede do Docker, sem passar por essa porta. Se a API já estiver rodando,
`sudo systemctl restart otica-api` depois.

---

## Etapa 5 — Configurar a API

```bash
cd /opt/otica/backend
sudo -u otica cp .env.example .env

# gere o segredo do JWT e copie a saída
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

sudo -u otica nano .env
```

O que precisa mudar em relação ao desenvolvimento:

```ini
NODE_ENV=production
PORT=3333

# a senha aqui é a mesma POSTGRES_PASSWORD da etapa 4
DATABASE_URL=postgresql://otica:A_SENHA_DA_ETAPA_4@localhost:5432/otica_popular

# o domínio público — é o que monta o link das fotos dos produtos
API_PUBLIC_URL=https://oticapopular.com.br
CORS_ORIGINS=https://oticapopular.com.br,https://www.oticapopular.com.br

JWT_SECRET=cole_aqui_os_96_caracteres_que_o_comando_acima_gerou

# lembretes de consulta (opcional — sem isso a API sobe igual, só não manda e-mail)
SMTP_USER=seuemail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
OTICA_TELEFONE=(43) 99633-5759
OTICA_ENDERECO=R. Mal. Deodoro da Fonseca, 922 - Santo Antônio da Platina, PR
```

> A API **se recusa a subir** em produção com o `JWT_SECRET` de exemplo. É proposital — e é a
> rede de segurança que pega um `.env` recopiado do exemplo por engano.

Antes de instalar qualquer coisa, **teste a conexão** com a mesma URL e o mesmo driver que
a API usa. Isso separa "a senha está errada" de "o código tem bug":

```bash
sudo -u otica -H node -e "require('dotenv').config();const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query('select current_user,current_database()')).then(r=>{console.log('CONECTOU:',r.rows[0]);process.exit(0)}).catch(e=>{console.error('FALHOU:',e.message);process.exit(1)})"
```

Deu `password authentication failed for user "otica"`? Veja o quadro abaixo antes de seguir.

Com o `CONECTOU:` na tela, instale as dependências, aplique as migrações e crie o seu login
do painel.

> O `-H` do `sudo` não é enfeite: sem ele o `HOME` continua sendo o do **seu** usuário, o
> `otica` não consegue escrever o cache do npm e o `npm ci` morre com `EACCES`.

### Se der "password authentication failed for user otica"

O `POSTGRES_PASSWORD` só vale na **primeira** subida, quando o volume ainda está vazio.
Depois disso ele é ignorado: a senha que manda é a que ficou gravada dentro do banco. Se
você subiu os containers antes de editar o `.env` — ou mudou a senha depois — o volume
continua com a antiga.

O sinal está no log: `Skipping initialization` quer dizer que o volume é velho e a senha do
`.env` não foi aplicada.

```bash
docker logs otica-postgres 2>&1 | grep -iE 'initdb|skipping|ready to accept'
grep POSTGRES_PASSWORD /opt/otica/.env
grep DATABASE_URL /opt/otica/backend/.env
```

**Recopiou o `.env.example` por cima do `.env`?** Isso volta *tudo* aos valores de exemplo,
inclusive `DATABASE_URL` com a senha `otica_dev_pwd`, `NODE_ENV=development`,
`API_PUBLIC_URL=http://localhost:3333` e o `JWT_SECRET` de brinquedo. O dotenv avisa quantas
variáveis carregou — no `backend/.env.example` são **20**; se o seu arquivo de produção tinha
menos linhas e de repente aparece `injected env (20)`, foi isso que aconteceu. Refaça as seis
linhas de produção antes de seguir.

**Sem dados ainda** — recria o banco com a senha certa:

```bash
cd /opt/otica
sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

> O `-v` apaga o volume. Agora é inofensivo; **depois que a loja estiver no ar, esse comando
> destrói o catálogo e a agenda**. Só use com backup na mão.

**Com dados que você quer manter** — troca a senha dentro do banco:

```bash
docker exec -it otica-postgres psql -U otica -d otica_popular \
  -c "ALTER USER otica WITH PASSWORD 'A_SENHA_DO_ENV';"
```

**Cuidado com caracteres especiais na senha.** Dois lugares diferentes tropeçam:

| Caractere | Onde quebra | O que fazer |
| --------- | ----------- | ----------- |
| `@` `:` `/` `?` `#` `[` `]` `%` | Na `DATABASE_URL` — o parser corta a URL no lugar errado | Codifique (`@` → `%40`, `#` → `%23`, `/` → `%2F`) ou evite |
| `$` | No `.env` do Compose — vira substituição de variável | Escreva `$$` ou evite |

O caminho mais curto é usar senha só com letras, números e `-` `_` `.` — nenhum dos dois
tropeça nesses.

```bash
sudo -u otica -H npm ci --omit=dev
sudo -u otica -H npm run migrar
sudo -u otica -H npm run criar-admin
```

Teste o e-mail antes de confiar nele (opcional):

```bash
sudo -u otica -H npm run testar-email -- seuemail@gmail.com
```

---

## Etapa 6 — Ligar a API como serviço

```bash
sudo cp /opt/otica/deploy/otica-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now otica-api

systemctl status otica-api
curl http://127.0.0.1:3333/api/health          # {"ok":true,...}
```

Se der erro, os logs contam o motivo:

```bash
journalctl -u otica-api -n 50 --no-pager
```

O serviço volta sozinho se cair e sobe junto com o servidor. Os lembretes de consulta
rodam dentro dele — confirme na primeira linha do log:

```
[lembretes] agendado: "0 8 * * *" (America/Sao_Paulo)
```

Libere o único comando de root que a atualização precisa:

```bash
sudo cp /opt/otica/deploy/otica-sudoers /etc/sudoers.d/otica-api
sudo chmod 0440 /etc/sudoers.d/otica-api
sudo visudo -c                # tem que dizer "parsed OK"
```

> Confira o `visudo -c` **antes de fechar o SSH**. Um arquivo com erro de sintaxe em
> `/etc/sudoers.d/` quebra o `sudo` do servidor inteiro.

---

## Etapa 7 — Compilar o site e configurar o Nginx

```bash
cd /opt/otica/frontend
sudo -u otica cp .env.example .env
sudo -u otica nano .env
```

Deixe a variável **vazia** — site e API ficam no mesmo domínio, então as chamadas viram
`/api/...` na própria origem:

```ini
VITE_API_URL=
```

Compile:

```bash
sudo -u otica -H npm ci
sudo -u otica -H npm run build
```

Publique só a pasta compilada. O dono é o `otica` para que o script de atualização não
precise de root:

```bash
sudo mkdir -p /var/www/otica
sudo chown otica:otica /var/www/otica
sudo chmod 755 /var/www/otica
sudo -u otica rsync -a --delete /opt/otica/frontend/dist/ /var/www/otica/
```

> Nunca aponte o Nginx para `/opt/otica/frontend`: aquela pasta tem o código-fonte, o
> `node_modules` e o `.env` do build — tudo ficaria acessível pela web.

Agora o Nginx:

> **Ao atualizar o site depois:** o `otica-publicar` NÃO mexe no Nginx. Sempre que o
> `deploy/nginx-otica.conf` mudar (foi o caso do link compartilhável do produto), rode
> estes mesmos três comandos de novo, terminando com `sudo systemctl reload nginx`.

```bash
sudo cp /opt/otica/deploy/nginx-otica.conf /etc/nginx/sites-available/otica
sudo ln -sf /etc/nginx/sites-available/otica /etc/nginx/sites-enabled/otica
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t                        # "syntax is ok" / "test is successful"
sudo systemctl enable --now nginx
sudo systemctl restart nginx
```

Teste local — as duas linhas têm que responder:

```bash
curl -I http://127.0.0.1:8080/                 # HTTP/1.1 200 OK
curl http://127.0.0.1:8080/api/health          # {"ok":true,...}

# link compartilhável: tem que vir o nome do produto no <title>, não "Óptica Popular"
curl -s http://127.0.0.1:8080/produto/SLUG-DE-UM-PRODUTO | grep -E '<title>|og:image'
```

Se o `nginx -t` reclamar de porta, volte na etapa 0 e escolha uma porta livre: troque
o `listen 127.0.0.1:8080;` em `/etc/nginx/sites-available/otica` e lembre de usar a
mesma na etapa 9.

---

## Etapa 8 — Colocar o domínio na Cloudflare

Seu domínio ainda está fora da Cloudflare, então esta etapa vem antes do tunnel. Tudo
pelo navegador:

1. Entre em <https://dash.cloudflare.com> e clique em **Add a site**.
2. Digite o domínio (sem `www`, sem `https://`) e escolha o plano **Free**.
3. A Cloudflare varre os registros DNS atuais e mostra uma lista. Confira se o que já
   existe está lá — **e-mail principalmente** (registros MX, SPF, DKIM). Se o domínio
   tem e-mail funcionando hoje, esses registros precisam sobreviver à migração.
4. A Cloudflare mostra **dois nameservers**, algo como
   `alice.ns.cloudflare.com` e `bob.ns.cloudflare.com`. Anote os dois.
5. Entre no site do **registrador** onde comprou o domínio e substitua os nameservers
   atuais por esses dois. Onde fica:
   - **Registro.br** → Painel → o domínio → **Alterar servidores DNS**
   - **GoDaddy** → Meus produtos → DNS → **Nameservers** → Alterar
   - **Hostinger** → Domínios → **DNS/Nameservers** → Alterar
6. Volte na Cloudflare e clique em **Check nameservers**.

A propagação costuma levar de alguns minutos a algumas horas (o limite é 24h). Quando o
domínio aparecer como **Active** no painel, siga. Para conferir pelo terminal:

```bash
dig NS oticapopular.com.br +short          # tem que devolver os nameservers da Cloudflare
```

Em **SSL/TLS → Overview**, deixe o modo em **Full**. Em **Flexible** o site entra em
loop de redirecionamento.

---

## Etapa 9 — Cloudflare Tunnel

### Instalar

Pelo repositório oficial da Cloudflare, para receber as atualizações pelo `apt`:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update && sudo apt install -y cloudflared
cloudflared --version
```

### Autenticar e criar o tunnel

Rode **sem `sudo`**, com o seu usuário normal:

```bash
cloudflared tunnel login
```

Ele imprime uma URL. Abra no navegador da sua máquina, faça login na Cloudflare e
escolha o domínio. O `cert.pem` fica em `~/.cloudflared/`.

```bash
cloudflared tunnel create otica
```

Anote o **ID do tunnel** que ele imprime (um UUID, tipo
`6ff42ae2-765d-4adf-8112-31c55c1551ef`). O arquivo de credenciais vai para
`~/.cloudflared/<ID>.json`.

Aponte o domínio para o tunnel — os dois, com e sem `www`:

```bash
cloudflared tunnel route dns otica oticapopular.com.br
cloudflared tunnel route dns otica www.oticapopular.com.br
```

Isso cria sozinho os registros CNAME na Cloudflare, já com a nuvem laranja ligada.

### Configurar

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/*.json /etc/cloudflared/
sudo cp ~/.cloudflared/cert.pem /etc/cloudflared/
sudo cp /opt/otica/deploy/cloudflared-config.example.yml /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml
```

Troque o ID e os hostnames. Deve ficar assim:

```yaml
tunnel: 6ff42ae2-765d-4adf-8112-31c55c1551ef
credentials-file: /etc/cloudflared/6ff42ae2-765d-4adf-8112-31c55c1551ef.json

ingress:
  - hostname: oticapopular.com.br
    service: http://localhost:8080
  - hostname: www.oticapopular.com.br
    service: http://localhost:8080
  - service: http_status:404
```

### Ligar como serviço

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
cloudflared tunnel info otica            # tem que mostrar 1 conexão ativa
```

---

## Etapa 10 — Conferir

Do servidor:

```bash
systemctl status otica-api cloudflared nginx --no-pager
curl -I http://127.0.0.1:8080/
curl http://127.0.0.1:8080/api/health
```

Do navegador, na sua máquina:

| Endereço                                        | Esperado                          |
| ----------------------------------------------- | --------------------------------- |
| `https://oticapopular.com.br`                   | Home, com cadeado de HTTPS        |
| `https://oticapopular.com.br/produtos`          | Catálogo                          |
| `https://oticapopular.com.br/api/health`        | `{"ok":true,...}`                 |
| `https://oticapopular.com.br/admin`             | Login do painel                   |

No painel, cadastre um produto **com foto** e marque como destaque. Se a imagem aparecer
na home, o `API_PUBLIC_URL` está certo. Se aparecer quebrada, é ele que está errado —
corrija no `backend/.env` e rode `sudo systemctl restart otica-api`.

---

## Etapa 11 — Publicar uma versão nova depois

Só na primeira vez, instale o comando de publicação:

```bash
sudo cp /opt/otica/deploy/otica-publicar /usr/local/bin/otica-publicar
sudo chmod +x /usr/local/bin/otica-publicar
```

Daí em diante, cada atualização são três passos:

1. Na sua máquina, na raiz do projeto: `python gerar-zip.py`
2. Envie `_entrega\otica-servidor.zip` pelo app **Files** do CasaOS, para `/DATA`
3. No servidor:

```bash
sudo otica-publicar
```

Ele faz backup do banco, descompacta, copia para `/opt/otica`, arruma as permissões e
chama o `atualizar.sh` — que instala dependências, **aplica as migrações**, compila o site,
publica os arquivos, reinicia a API e confere o `/api/health` no fim.

> O `otica-publicar` mora em `/usr/local/bin` de propósito. Dentro de `/opt/otica` ele seria
> sobrescrito pelo `rsync` durante a própria execução — o bash lê o script em pedaços, e
> trocá-lo no meio quebra a execução de formas difíceis de diagnosticar.

### O que ele NÃO faz

| Situação | O que você precisa fazer na mão |
| -------- | ------------------------------- |
| A versão nova precisa de uma variável nova no `.env` | Adicionar no `.env` do servidor — ele não está no zip e por isso nunca é sobrescrito |
| Você apagou um arquivo do projeto | O `rsync` roda sem `--delete`, então o arquivo continua lá. Apague à mão se for um `.sql` de `docker/initdb/`, que seria reaplicado |
| A migração nova não é idempotente | O `migrar` roda **todos** os `NN-*.sql` de `03` em diante, sempre. Escreva com `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS` |
| Mudou o `docker-compose.yml` | `cd /opt/otica && sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |

A API fica fora do ar por poucos segundos no restart. Para uma loja desse porte não
compensa complicar com deploy sem downtime.

---

## Etapa 12 — Backup

O banco vive num volume do Docker e as fotos dos produtos em
`/opt/otica/backend/uploads` — **as duas coisas precisam de backup**.

Primeiro rode uma vez na mão, para ver que funciona:

```bash
sudo /opt/otica/deploy/backup-banco.sh
ls -lh /var/backups/otica/
```

Depois agende para todo dia às 2h. A linha do cron **não é um comando de terminal** — ela
mora dentro do crontab. Este comando a insere sem abrir editor nenhum:

```bash
( sudo crontab -l 2>/dev/null; \
  echo '0 2 * * * /opt/otica/deploy/backup-banco.sh >> /var/log/otica-backup.log 2>&1' \
) | sudo crontab -

sudo crontab -l          # confira que a linha está lá
```

Guarda os últimos 14 dias em `/var/backups/otica`.

### Restaurar

Só em emergência. Veja os arquivos que existem e use o nome **real** — `AAAAMMDD-HHMMSS`
abaixo é só o formato, não um nome de arquivo:

```bash
ls -1 /var/backups/otica/

# troque pelo nome que apareceu acima
gunzip -c /var/backups/otica/otica-20260828-020000.sql.gz \
  | docker exec -i otica-postgres psql -U otica -d otica_popular
```

Leve uma cópia para fora do servidor de vez em quando — backup que só existe na mesma
máquina não é backup. Como o CasaOS já enxerga o disco, dá para mandar a pasta
`/var/backups/otica` para um HD externo ou para a nuvem por lá.

---

## Etapa 13 — Administrar o banco pelo pgAdmin

O pgAdmin fica preso em `127.0.0.1:5050`, então não abre pela rede. Você chega nele por um
túnel SSH — que roda **na sua máquina**, não no servidor.

Descubra o endereço do servidor (uma vez):

```bash
# NO SERVIDOR
tailscale ip -4
```

E abra o túnel no **PowerShell do Windows**, trocando pelo IP que apareceu:

```powershell
ssh -L 5050:localhost:5050 admincarvalho@100.x.y.z
```

Com essa janela aberta, acesse `http://localhost:5050` no navegador do PC. Fechando a
janela, o acesso morre junto.

> Não publique o pgAdmin nem o Postgres pelo Cloudflare Tunnel sem proteger com o
> Cloudflare Access. O túnel SSH acima já resolve o uso do dia a dia.

### Acessar sem túnel, pela tailnet

Se você usa Tailscale e prefere não abrir um túnel toda vez, faça o pgAdmin escutar
**direto no IP da tailnet**:

```bash
TSIP=$(tailscale ip -4); echo "$TSIP"

grep -q '^PGADMIN_BIND_IP=' /opt/otica/.env \
  && sudo -u otica sed -i "s|^PGADMIN_BIND_IP=.*|PGADMIN_BIND_IP=$TSIP|" /opt/otica/.env \
  || echo "PGADMIN_BIND_IP=$TSIP" | sudo -u otica tee -a /opt/otica/.env

cd /opt/otica
sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker port otica-pgadmin        # tem que mostrar 100.x.y.z:5050
```

E acesse `http://100.x.y.z:5050`. O pgAdmin em produção continua pedindo login.

> **Por que o IP e não `0.0.0.0` + regra de firewall.** O ufw **não bloqueia portas
> publicadas pelo Docker**: o Docker insere as próprias regras de iptables na cadeia
> `FORWARD`, e o tráfego para um container é roteado, não passa pela `INPUT` onde o ufw
> age. Um `ufw allow in on tailscale0 to any port 5050` seria puramente decorativo. Com o
> bind no IP da tailnet, o container simplesmente não escuta em mais lugar nenhum — não
> depende de firewall. Para o Nginx, que é processo do host e não container, as regras do
> ufw valem normalmente.

> Efeito colateral: se o `tailscale0` ainda não estiver de pé quando o Docker subir o
> container, o bind falha. O `restart: unless-stopped` tenta de novo até dar certo — mas
> depois de um reboot vale conferir com `docker ps` e `docker port otica-pgadmin`.

---

## Quando algo não sobe

| Sintoma                                   | Onde olhar                                                        |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `nginx -t` diz "address already in use"   | Outra coisa está na 8080: `sudo ss -lntp \| grep :8080` — troque a porta |
| Site abre, painel dá "Failed to fetch"    | `systemctl status otica-api` e `journalctl -u otica-api -n 50`     |
| `address already in use` na 5432          | Veja "Se der address already in use na 5432", na etapa 4           |
| `password authentication failed`          | Veja "Se der password authentication failed", na etapa 5           |
| `relation "usuarios" does not exist`      | O initdb não leu `docker/initdb/`: `sudo chmod -R a+rX /opt/otica/docker` e recrie o volume |
| Favicon (ou outro arquivo de `public/`) dá 403 | Arquivo copiado com modo `0700`: `sudo chmod -R a+rX /var/www/otica /opt/otica/frontend/public` |
| Porta de container aberta apesar do `ufw` | O ufw não vale para porta publicada pelo Docker. Restrinja pelo bind (`*_BIND_IP` no `.env`), não por regra de firewall |
| API não sobe                              | O banco está de pé? `docker ps` e `docker logs otica-postgres`     |
| API sobe e cai em loop                    | `journalctl -u otica-api -n 50` — quase sempre `DATABASE_URL` ou `JWT_SECRET` |
| `/admin` dá 404 ao recarregar             | Faltou o `try_files` do Nginx — confira o `sites-enabled/otica`    |
| Foto do produto some                      | `API_PUBLIC_URL` diferente do domínio real no `backend/.env`       |
| Link do produto abre o site, mas não o produto | Faltou o `location /produto/` no Nginx: recopie o `nginx-otica.conf` e `sudo systemctl reload nginx` |
| Prévia do WhatsApp vem sem foto ou genérica | `curl -s https://SEU-DOMINIO/produto/SLUG \| grep og:` — se vier vazio é o Nginx; se vier com `localhost` é o `API_PUBLIC_URL`. O WhatsApp guarda a prévia por horas: teste com um link novo |
| Lembrete não chega                        | `journalctl -u otica-api -n 100` e `npm run testar-email`          |
| Domínio dá erro 1033 da Cloudflare        | O tunnel caiu: `systemctl status cloudflared` e `cloudflared tunnel info otica` |
| Domínio dá erro 502                       | O tunnel está de pé mas o Nginx não: `systemctl status nginx`      |
| Domínio não resolve                       | Nameservers ainda propagando: `dig NS oticapopular.com.br +short`  |
| CasaOS parou de abrir                     | Algo tomou a porta 80: `sudo ss -lntp \| grep :80`                 |

---

## Ainda sem o domínio ativo? Dá para testar antes

Enquanto os nameservers propagam, você pode ver o site no ar com uma URL temporária:

```bash
cloudflared tunnel --url http://localhost:8080
```

Ele imprime um endereço `*.trycloudflare.com` que funciona na hora. Morre quando você
fecha o comando. Enquanto durar o teste, coloque essa URL em `API_PUBLIC_URL` e
`CORS_ORIGINS` no `backend/.env` e reinicie a API — senão as fotos dos produtos não
carregam.
