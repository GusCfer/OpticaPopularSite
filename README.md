# Óptica Popular — site + painel administrativo

Site institucional em React/Vite, API em Node/Express e PostgreSQL rodando no Docker.
Produtos são cadastrados pelo painel em `/admin`, com upload de imagem, e os marcados
como **destaque** (no máximo 5) aparecem na home. O painel também tem a aba
**Consultas**, onde a atendente agenda os atendimentos — e o sistema manda sozinho
um lembrete por e-mail para o paciente na véspera.

```
OticaPopularSap/
├── docker-compose.yml       PostgreSQL 16 + pgAdmin 4
├── docker/initdb/           SQL que cria as tabelas na primeira subida
├── backend/                 API Express + PostgreSQL (node-postgres)
├── frontend/                Site React/Vite + painel /admin
└── start.bat                Sobe tudo de uma vez (Windows)
```

---

## 1. Primeira vez (passo a passo)

Precisa ter **Docker Desktop** e **Node.js 18+** instalados.

### 1.1 Subir o banco

```bash
docker compose up -d
```

Isso cria dois containers e **já cria as tabelas e as 4 categorias** automaticamente
(o Postgres executa tudo que está em `docker/initdb/` na primeira subida):

| Serviço  | Endereço                | Acesso                                        |
| -------- | ----------------------- | --------------------------------------------- |
| Postgres | `localhost:5432`        | usuário `otica` / senha `otica_dev_pwd`       |
| pgAdmin  | http://localhost:5050   | `admin@oticapopular.com.br` / `admin123`      |

O pgAdmin já abre com a conexão "Otica Popular" configurada — só pede a senha do banco.

### 1.2 Subir a API

```bash
cd backend
copy .env.example .env      # no Linux/Mac: cp .env.example .env
npm install
```

Gere um segredo forte para o JWT e cole no `.env` em `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Crie o seu usuário de administrador:

```bash
npm run criar-admin
```

(ou direto: `npm run criar-admin -- "Gustavo" gustavo@email.com MinhaSenha123`)

Opcional — popular o catálogo com 8 produtos de exemplo:

```bash
npm run seed
```

Suba a API:

```bash
npm run dev          # http://localhost:3333
```

### 1.3 Subir o site

```bash
cd frontend
copy .env.example .env
npm install
npm run dev          # http://localhost:5173
```

Painel: **http://localhost:5173/admin**

> Depois da primeira vez, é só rodar `start.bat` que ele sobe os três de uma vez.

---

## 2. Banco de dados

### Tabelas

**`categorias`** — as 4 categorias fixas, já criadas pelo seed:

| slug      | nome           |
| --------- | -------------- |
| `oculos`  | Óculos de Grau |
| `solar`   | Óculos de Sol  |
| `relogio` | Relógios       |
| `joia`    | Joias          |

**`produtos`** — `categoria_id` é **FOREIGN KEY** para `categorias(id)`, com
`ON DELETE RESTRICT` (não dá para apagar uma categoria que tem produto) e
`ON UPDATE CASCADE`.

**`usuarios`** — acesso ao painel. Guarda só o **hash bcrypt** da senha, nunca o texto.

**`consultas`** — agendamentos. `data_hora` é `TIMESTAMP` **sem fuso**: é sempre o
horário local da óptica (o fuso fica em `TIMEZONE`, no `backend/.env`), então nada é
deslocado por causa do fuso do container. `lembrete_enviado_em` guarda quando o aviso
saiu — enquanto for `NULL`, a consulta continua na fila do lembrete.

Um índice único (`uq_consultas_medico_horario`) impede marcar dois pacientes com o
**mesmo médico no mesmo horário**. Consulta cancelada libera o horário de novo.

### Regra dos 5 destaques

O limite é garantido em **dois lugares**:

1. Na API, com uma mensagem amigável antes de tentar gravar.
2. No **próprio banco**, por uma trigger (`trg_limite_produtos_destaque`). Mesmo que
   alguém rode um `UPDATE` na mão pelo pgAdmin, o Postgres recusa:

```
ERROR: LIMITE_DESTAQUES: já existem 5 produtos em destaque (máximo 5).
```

No painel, quando chega em 5/5 as estrelas vazias ficam desabilitadas e o checkbox
"Destaque na home" trava sozinho.

### Recomeçar do zero

```bash
docker compose down -v      # -v apaga o volume, ou seja, apaga os dados
docker compose up -d        # recria as tabelas e as categorias
```

---

## 3. Consultas e lembretes por e-mail

Na aba **Consultas** do painel a atendente cadastra o agendamento: nome do paciente,
e-mail, telefone (opcional), nome do médico, data, horário e observações. O e-mail é
obrigatório — é para onde o lembrete vai.

### Como o lembrete funciona

Todo dia, no horário de `LEMBRETES_CRON` (padrão **08:00**), a API varre as consultas
do **dia seguinte** que ainda não receberam aviso e manda um e-mail para cada paciente.

- Só marca como enviado quando o servidor de e-mail aceita a mensagem. Se a internet
  cair, a consulta continua na fila e o aviso sai na próxima varredura.
- Consulta **cancelada** não recebe lembrete.
- Mudou a data ou o e-mail do paciente? O lembrete volta para a fila sozinho, para o
  paciente não ser avisado do horário antigo.
- A coluna **Lembrete** na tabela mostra `Na fila`, `Enviado` (com a data no tooltip)
  ou `Falhou` (com o motivo no tooltip).
- O botão **Enviar lembrete** manda na hora, sem esperar a véspera.

### Configurar o Gmail

O Gmail **não aceita a senha normal da conta** no SMTP. É preciso uma *senha de app*:

1. Ative a verificação em duas etapas em <https://myaccount.google.com/security>
2. Gere a senha em <https://myaccount.google.com/apppasswords>
3. Cole as 16 letras no `backend/.env` (pode colar com os espaços):

```ini
SMTP_USER=seuemail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
OTICA_NOME=Óptica Popular
OTICA_TELEFONE=(00) 0000-0000
OTICA_ENDERECO=Rua Exemplo, 100 - Centro
```

Teste antes de confiar:

```bash
cd backend
npm run testar-email                      # só confere usuário e senha
npm run testar-email -- voce@gmail.com    # manda um lembrete de exemplo
```

No painel também tem o link **Testar conexão**, ao lado do aviso de configuração.

> Enquanto `SMTP_USER`/`SMTP_PASS` estiverem vazios a API sobe normal e as consultas
> podem ser cadastradas — só o e-mail não sai, e o painel mostra um aviso amarelo.

Variáveis relacionadas, todas em `backend/.env`:

| Variável           | Padrão               | Para que serve                                    |
| ------------------ | -------------------- | ------------------------------------------------- |
| `SMTP_HOST/PORT`   | `smtp.gmail.com:465` | Servidor de saída. 465 = SSL, 587 = STARTTLS      |
| `SMTP_FROM`        | vazio                | Remetente. Vazio vira `"Óptica Popular" <SMTP_USER>` |
| `TIMEZONE`         | `America/Sao_Paulo`  | Fuso do agendador e das datas das consultas       |
| `LEMBRETES_ATIVO`  | `true`               | `false` desliga o disparo automático              |
| `LEMBRETES_CRON`   | `0 8 * * *`          | Quando varrer a agenda (minuto hora dia mês semana) |
| `OTICA_*`          | vazio                | Nome, telefone e endereço que aparecem no e-mail  |

### Banco já criado antes dessa funcionalidade (ou de uma futura)

O Postgres só roda `docker/initdb/` na primeira subida do container. Para aplicar uma
tabela nova num banco que já existe (produção, por exemplo):

```bash
cd backend
npm run migrar
```

**Como ele decide o que rodar:** não olha o banco — olha a pasta. Pega todo arquivo
`docker/initdb/NN-nome.sql` com `NN` a partir de `03` (o `01` e o `02` são a base, que o
Postgres já aplica sozinho) e roda **todos, em ordem**, sempre, mesmo os que já rodaram
antes. Isso só é seguro porque cada um é escrito para ser **idempotente**
(`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`…) — rodar de novo algo
que já existe não dá erro, só não faz nada.

Ou seja: **para adicionar uma tabela nova no futuro, não mexa no `migrar.js`.** Só crie
`docker/initdb/04-o-que-for.sql` seguindo esse mesmo estilo (sempre com `IF NOT EXISTS`
ou equivalente) e rode `npm run migrar` — ele encontra sozinho. O próximo depois desse é
`05-`, e assim por diante.

---

## 4. Segurança

O que já está implementado:

| Item                     | Como                                                            |
| ------------------------ | --------------------------------------------------------------- |
| Senhas                   | bcrypt com custo 12 — o texto puro nunca é gravado nem devolvido |
| Sessão                   | JWT HS256, 8h de validade, segredo no `.env`                     |
| Força bruta              | Rate limit de 10 tentativas/15min por IP **+** bloqueio de 15min na conta após 5 erros |
| Enumeração de e-mail     | Login sempre responde "E-mail ou senha inválidos", com tempo de resposta constante |
| SQL injection            | 100% queries parametrizadas (`$1`, `$2`), zero concatenação      |
| Validação de entrada     | Zod em toda rota que escreve                                     |
| Cabeçalhos               | Helmet                                                           |
| CORS                     | Lista fechada de origens (`CORS_ORIGINS` no `.env`)              |
| Upload                   | Só JPG/PNG/WEBP/AVIF, máx. 5 MB, nome do arquivo gerado aleatoriamente (o nome enviado nunca toca o disco) |
| Papéis                   | `ADMIN` cria usuários; `EDITOR` só mexe em produtos              |
| Cadastro aberto          | Não existe — usuário novo só por `npm run criar-admin` ou por um ADMIN logado |
| Agenda de consultas      | Nenhuma rota pública: e-mail e telefone de paciente só aparecem com token |
| Senha do e-mail          | Senha de app do Gmail, guardada só no `.env` (que está no `.gitignore`) |

**Antes de colocar no ar**, faça três coisas:

1. Troque `JWT_SECRET` por um valor aleatório de verdade (a API se recusa a subir em
   produção com o segredo de exemplo).
2. Troque `POSTGRES_PASSWORD` e a senha do pgAdmin no `.env` da raiz.
3. Não exponha a porta 5432 nem o pgAdmin na internet.

---

## 5. Imagens dos produtos

Hoje ficam em `backend/uploads/produtos/`, servidas pela própria API em
`/uploads/produtos/<arquivo>`. O banco guarda só o caminho relativo.

**Para migrar pra nuvem depois** (S3, Cloudinary, etc.), só dois arquivos mudam:

- `backend/src/middlewares/upload.js` — troca o `multer.diskStorage` pelo storage do provedor.
- `backend/src/app.js` — remove o `express.static('/uploads')`.

Como o banco guarda o caminho e a URL absoluta é montada na resposta
(`API_PUBLIC_URL + caminho`), os produtos já cadastrados continuam funcionando.

---

## 6. Rotas da API

### Públicas

| Método | Rota                       | O que faz                                    |
| ------ | -------------------------- | -------------------------------------------- |
| GET    | `/api/health`              | Ping                                          |
| GET    | `/api/categorias`          | Categorias + quantos produtos cada uma tem    |
| GET    | `/api/produtos/destaques`  | Os até 5 destaques ativos (usado na home)     |
| GET    | `/api/produtos`            | Catálogo. Filtros: `?categoria=solar&busca=aviador` |
| GET    | `/api/produtos/:id`        | Um produto                                    |

Sem token, `/api/produtos` devolve **só produtos ativos**.

### Autenticação

| Método | Rota                    | O que faz                            |
| ------ | ----------------------- | ------------------------------------ |
| POST   | `/api/auth/login`       | `{ email, senha }` → `{ token, usuario }` |
| GET    | `/api/auth/eu`          | Dados do usuário logado              |
| POST   | `/api/auth/senha`       | `{ senhaAtual, senhaNova }`          |
| GET    | `/api/auth/usuarios`    | Lista usuários (só ADMIN)            |
| POST   | `/api/auth/usuarios`    | Cria usuário (só ADMIN)              |

### Painel (exigem `Authorization: Bearer <token>`)

| Método | Rota                            | O que faz                          |
| ------ | ------------------------------- | ---------------------------------- |
| POST   | `/api/upload`                   | Envia a imagem → `{ caminho, url }` |
| POST   | `/api/produtos`                 | Cadastra                            |
| PUT    | `/api/produtos/:id`             | Atualiza                            |
| PATCH  | `/api/produtos/:id/destaque`    | `{ destaque: true/false }`          |
| DELETE | `/api/produtos/:id`             | Exclui (e apaga a imagem do disco)  |

### Consultas (todas exigem token — agenda é dado de paciente)

| Método | Rota                                | O que faz                                  |
| ------ | ----------------------------------- | ------------------------------------------ |
| GET    | `/api/consultas`                    | Lista. Filtros: `?status=&busca=&de=&ate=` |
| GET    | `/api/consultas/resumo`             | Contadores de hoje, amanhã e falhas        |
| GET    | `/api/consultas/medicos`            | Médicos já usados (autocomplete do form)   |
| GET    | `/api/consultas/:id`                | Uma consulta                                |
| POST   | `/api/consultas`                    | Agenda                                      |
| PUT    | `/api/consultas/:id`                | Atualiza (remarcar recoloca o lembrete na fila) |
| PATCH  | `/api/consultas/:id/status`         | `{ status: AGENDADA/REALIZADA/CANCELADA }` |
| DELETE | `/api/consultas/:id`                | Exclui                                      |
| POST   | `/api/consultas/:id/lembrete`       | Manda o lembrete agora                      |
| POST   | `/api/consultas/lembretes/rodar`    | Roda a varredura do dia na mão              |
| GET    | `/api/consultas/email/status`       | Se o SMTP está configurado                  |
| POST   | `/api/consultas/email/testar`       | Testa usuário/senha sem enviar nada         |

Erros vêm sempre como `{ erro, codigo, detalhes? }`.

---

## 7. Publicar no servidor (Ubuntu Server)

Como fica lá dentro:

```
Internet → Cloudflare → cloudflared (tunnel) → Nginx :80 ─┬→ site compilado (arquivos)
                                                          └→ /api e /uploads → API :3333 (systemd)
                                                                                    ↓
                                                                      PostgreSQL :5432 (Docker)
```

Só o `cloudflared` fala com a internet. O Nginx, a API e o banco ficam todos no
`localhost` — **nenhuma porta precisa ser aberta no firewall**, nem a 80.

Site e painel ficam na **mesma origem** do `/api`, então não existe CORS entre eles e o
domínio não fica gravado dentro do JavaScript compilado.

### 7.1 Preparar o servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl rsync

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Docker (só para o banco e o pgAdmin)
curl -fsSL https://get.docker.com | sudo sh
```

Um usuário sem privilégios para rodar a aplicação:

```bash
sudo useradd --system --create-home --home-dir /opt/otica --shell /bin/bash otica
sudo usermod -aG docker otica
```

Firewall fechado, menos o SSH — o resto entra pelo tunnel:

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

### 7.2 Colocar o código no servidor

```bash
sudo -u otica git clone <url-do-repositorio> /opt/otica
# sem git? mande com scp da sua máquina:
#   scp -r OticaPopularSap usuario@servidor:/tmp/otica
#   sudo rsync -a /tmp/otica/ /opt/otica/ && sudo chown -R otica:otica /opt/otica
```

### 7.3 Subir o banco

```bash
cd /opt/otica
cp .env.example .env
nano .env        # troque POSTGRES_PASSWORD e PGADMIN_PASSWORD por senhas fortes

sudo -u otica docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

O `docker-compose.prod.yml` prende o Postgres e o pgAdmin em `127.0.0.1`: eles somem da
internet mesmo que o firewall falhe. Para abrir o pgAdmin, faça um túnel SSH da sua
máquina e acesse `http://localhost:5050`:

```bash
ssh -L 5050:localhost:5050 usuario@servidor
```

### 7.4 Configurar a API

```bash
cd /opt/otica/backend
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # gere o segredo
nano .env
```

O que muda em relação ao desenvolvimento:

```ini
NODE_ENV=production
DATABASE_URL=postgresql://otica:A_SENHA_QUE_VOCE_POS@localhost:5432/otica_popular

# domínio público — é o que monta o link das fotos dos produtos
API_PUBLIC_URL=https://oticapopular.com.br
CORS_ORIGINS=https://oticapopular.com.br,https://www.oticapopular.com.br

JWT_SECRET=<os 96 caracteres que o comando acima gerou>

SMTP_USER=seuemail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
OTICA_TELEFONE=(00) 0000-0000
OTICA_ENDERECO=Rua Exemplo, 100 - Centro
```

> A API **se recusa a subir** em produção com o `JWT_SECRET` de exemplo. É proposital.

> Errar o `CORS_ORIGINS` não derruba o painel: chamadas de **mesma origem** (site e API
> no mesmo domínio, que é o caso aqui) passam sempre. A lista só vale para quem chama a
> API de outro domínio. Se bloquear alguém, aparece no log: `[cors] origem bloqueada:`

Instale, migre e crie o seu usuário:

```bash
npm ci --omit=dev
npm run migrar
npm run criar-admin
npm run testar-email -- voce@gmail.com    # confere o Gmail antes de confiar
```

### 7.5 Ligar a API como serviço

```bash
sudo cp /opt/otica/deploy/otica-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now otica-api

systemctl status otica-api
journalctl -u otica-api -f          # acompanhar os logs
curl http://127.0.0.1:3333/api/health
```

O serviço reinicia sozinho se cair e volta junto com o servidor. Se o banco ainda
estiver subindo, a API sai com erro e o systemd tenta de novo a cada 5 s.

Os lembretes de consulta rodam **dentro desse serviço** — não precisa de cron do
sistema. Confirme na primeira linha do log:

```
[lembretes] agendado: "0 8 * * *" (America/Sao_Paulo)
```

### 7.6 Compilar o site e configurar o Nginx

```bash
cd /opt/otica/frontend
cp .env.example .env
nano .env          # deixe VITE_API_URL= (vazio): site e API na mesma origem

npm ci
npm run build

sudo mkdir -p /var/www/otica
sudo rsync -a --delete dist/ /var/www/otica/
sudo chown -R www-data:www-data /var/www/otica
```

> O Nginx serve `/var/www/otica`, que tem **só o site compilado**. Não aponte o `root`
> para `/opt/otica/frontend`: aquela pasta guarda o código-fonte, o `node_modules` e o
> `.env` do build — tudo isso ficaria acessível pela web.

```bash
sudo cp /opt/otica/deploy/nginx-otica.conf /etc/nginx/sites-available/otica
sudo ln -s /etc/nginx/sites-available/otica /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

curl -I http://localhost/                 # 200
curl http://localhost/api/health          # {"ok":true,...}
```

### 7.7 Cloudflare Tunnel

Com o tunnel você não abre porta nenhuma, não precisa de IP fixo e o HTTPS vem pronto
da Cloudflare.

```bash
# instalar
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

# autenticar (abre um link para você aprovar no navegador)
cloudflared tunnel login

# criar o tunnel e apontar o domínio para ele
cloudflared tunnel create otica
cloudflared tunnel route dns otica oticapopular.com.br
cloudflared tunnel route dns otica www.oticapopular.com.br
```

Copie a configuração de exemplo e troque o id e os hostnames:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp /opt/otica/deploy/cloudflared-config.example.yml /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml
```

```yaml
tunnel: <ID-DO-TUNEL>
credentials-file: /etc/cloudflared/<ID-DO-TUNEL>.json

ingress:
  - hostname: oticapopular.com.br
    service: http://localhost:80
  - hostname: www.oticapopular.com.br
    service: http://localhost:80
  - service: http_status:404
```

O `tunnel create` salva o `.json` em `~/.cloudflared/`. Mova para `/etc/cloudflared/` e
suba o serviço:

```bash
sudo cp ~/.cloudflared/<ID-DO-TUNEL>.json /etc/cloudflared/
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

Na Cloudflare, deixe o modo SSL/TLS em **Full** e o proxy (nuvem laranja) ligado.

**Ainda sem domínio?** Dá para testar antes de comprar:

```bash
cloudflared tunnel --url http://localhost:80
```

Ele imprime uma URL `*.trycloudflare.com` que funciona na hora. É temporária (morre
quando você fecha o comando) e serve só para conferir se está tudo de pé — coloque essa
URL em `API_PUBLIC_URL` e `CORS_ORIGINS` enquanto durar o teste.

> Não publique o pgAdmin nem o Postgres pelo tunnel sem proteger com o Cloudflare
> Access. Para administrar o banco, use o túnel SSH do passo 7.3.

### 7.8 Publicar uma versão nova

```bash
cd /opt/otica
sudo -u otica ./deploy/atualizar.sh
```

O script baixa o código, instala dependências, roda as migrações, compila o site,
publica os arquivos, reinicia a API e confere o `/api/health` no fim.

### 7.9 Backup

O banco vive num volume do Docker e as fotos dos produtos em
`/opt/otica/backend/uploads` — **as duas coisas precisam de backup**.

```bash
sudo /opt/otica/deploy/backup-banco.sh                    # na mão
sudo crontab -e
# 0 2 * * * /opt/otica/deploy/backup-banco.sh >> /var/log/otica-backup.log 2>&1
```

Guarda os últimos 14 dias em `/var/backups/otica`. Restaurar:

```bash
gunzip -c /var/backups/otica/otica-AAAAMMDD-HHMMSS.sql.gz | \
  docker exec -i otica-postgres psql -U otica -d otica_popular
```

Leve uma cópia para fora do servidor de vez em quando (`rsync`, R2, S3) — backup que só
existe na mesma máquina não é backup.

### 7.10 Quando algo não sobe

| Sintoma                              | Onde olhar                                              |
| ------------------------------------ | ------------------------------------------------------- |
| Site abre, painel dá "Failed to fetch" | `sudo systemctl status otica-api` e `journalctl -u otica-api -n 50` |
| API não sobe                          | O banco está de pé? `docker ps` e `docker logs otica-postgres` |
| `/admin` dá 404 ao recarregar         | Faltou o `try_files` do Nginx — confira o `sites-enabled` |
| Foto do produto some                  | `API_PUBLIC_URL` diferente do domínio real no `backend/.env` |
| Lembrete não chega                    | `journalctl -u otica-api -n 100` e `npm run testar-email` |
| Domínio não abre                      | `sudo systemctl status cloudflared` e `cloudflared tunnel info otica` |

---

## 8. Páginas do site

| Rota                        | O que é                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `/`                         | Home — hero, destaques (até 5), diferenciais, depoimentos, contato |
| `/produtos`                 | Catálogo completo, com filtro por categoria e busca          |
| `/produtos?categoria=solar` | Catálogo já filtrado (o link é compartilhável)               |
| `/admin/login`              | Login do painel                                              |
| `/admin`                    | Painel: abas **Produtos** e **Consultas** (exige login)      |

Clicar na foto de qualquer produto — na home ou no catálogo — abre a imagem ampliada.
Fecha no `Esc`, no `×` ou clicando fora.

Há três caminhos até o catálogo: o botão **Ver produtos** no hero, o link **Produtos** no
menu e o botão **Ver todos os produtos** no fim da seção de destaques.
