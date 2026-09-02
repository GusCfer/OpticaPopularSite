# Documentação técnica — Óptica Popular

Manual de instalação, referência do banco, das rotas da API e das funcionalidades.
Para a apresentação do projeto, veja o [README](README.md); para publicar no servidor,
o [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

**Em produção:** <https://opticapopularsap.com.br>

---

1. [Primeira vez (passo a passo)](#1-primeira-vez-passo-a-passo)
2. [Banco de dados](#2-banco-de-dados)
3. [Consultas e lembretes por e-mail](#3-consultas-e-lembretes-por-e-mail)
4. [Segurança](#4-segurança)
5. [Imagens dos produtos](#5-imagens-dos-produtos)
6. [Rotas da API](#6-rotas-da-api)
7. [Publicar no servidor](#7-publicar-no-servidor)
8. [A seção "Visite a loja"](#8-a-seção-visite-a-loja)
9. [Páginas do site](#9-páginas-do-site)
10. [A vitrine da home](#10-a-vitrine-da-home)
11. [Links compartilháveis de produto](#11-links-compartilháveis-de-produto)

---

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

**`produto_imagens`** — a galeria: até **8 fotos por produto**, com `ordem` definindo a
sequência do carrossel. O limite não depende do código: `UNIQUE (produto_id, ordem)` mais
`CHECK (ordem >= 0 AND ordem < 8)` já tornam a nona linha impossível.

`produtos.imagem_url` continua existindo e virou a **capa** — a foto de menor ordem, mantida
em dia pela trigger `trg_sync_capa_produto`. Por isso a home, o catálogo e os destaques não
precisaram de nenhuma mudança de SQL, e mexer na galeria pelo pgAdmin também acerta a capa.
Apagar o produto leva as imagens junto (`ON DELETE CASCADE`), e o backend apaga os arquivos
do disco.

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

Cada produto aceita **até 8 fotos**. No painel elas são escolhidas pelo arquivo ou tiradas
na hora pela câmera do celular (`<input capture>`, que abre o app de câmera do aparelho), e
o próprio navegador reduz cada uma para 1600px em WebP **antes** de enviar: uma foto de 5 MB
vira uns 200 KB. Isso poupa o 4G da loja, o disco do servidor e o tempo de quem abre o site —
e, de quebra, o recorte no canvas descarta o EXIF, então a localização GPS da foto não vai
parar num arquivo público.

No site, clicar em qualquer produto abre o carrossel: arrasta para trocar de foto, mostra
"Foto 2 de 8", tem miniaturas e zoom por toque (ou clique, no desktop). O carrossel é CSS
puro — `scroll-snap` —, sem biblioteca: a funcionalidade inteira custou cerca de 2 KB gzip.

Os arquivos ficam em `backend/uploads/produtos/`, servidos pela própria API em
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
| GET    | `/api/produtos`            | Catálogo **paginado**: `?categoria=solar&busca=aviador&pagina=2&porPagina=12` |
| GET    | `/api/produtos/vitrine`    | Produtos sorteados p/ a esteira da home: `?limite=14` (teto 24) |
| GET    | `/api/produtos/slug/:slug` | Um produto pelo slug — é o que o link compartilhável usa |
| GET    | `/api/produtos/:id`        | Um produto                                    |

Sem token, `/api/produtos` devolve **só produtos ativos**. A vitrine devolve apenas peças
ativas **e com foto** — a esteira é uma fileira de imagens, e um "sem foto" no meio abriria
um buraco nela.

Fora do prefixo `/api` existe ainda **`GET /produto/:slug`**, que não é JSON: devolve o
`index.html` compilado com as meta tags Open Graph daquele produto injetadas no `<head>`.
É o que faz o WhatsApp montar a prévia com foto, nome e preço quando alguém cola o link
numa conversa — o robô dele não executa JavaScript, então preencher as tags depois que o
React sobe não adiantaria. No navegador o resultado é idêntico ao site normal.

`/api/produtos` responde `{ itens, total, pagina, porPagina, paginas }` — um objeto, não um
array, porque a navegação de páginas precisa saber quantos existem no total. Página fora do
intervalo devolve a última em vez de uma tela vazia, e `porPagina` é limitado a 60. Com token,
vem também `destaquesUsados`, contado no catálogo inteiro e não só na página aberta.

Todo produto vem com `imagens: []` — a galeria em ordem, já com URL absoluta — e
`imagemUrl`, que é a primeira delas. Para gravar, mande `imagens` no POST/PUT do produto; um
request antigo que mande só `imagemUrl` continua funcionando e vira uma galeria de uma foto.

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
| POST   | `/api/upload`                   | Envia até 8 imagens → `{ imagens: [{ caminho, url }] }` |
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

## 7. Publicar no servidor

O passo a passo completo está em **[`deploy/DEPLOY.md`](deploy/DEPLOY.md)** — desde
instalar o Node até configurar o Cloudflare Tunnel, para um Ubuntu Server com CasaOS.

Como fica lá dentro:

```
Internet → Cloudflare → cloudflared → Nginx :8080 ─┬→ site compilado (/var/www/otica)
                                                   └→ /api e /uploads → API :3333 (systemd)
                                                                              ↓
                                                                PostgreSQL :5432 (Docker)
```

Só o `cloudflared` fala com a internet. Nginx, API e banco ficam todos no `localhost` —
**nenhuma porta precisa ser aberta no firewall**. Site e painel ficam na mesma origem do
`/api`, então não existe CORS entre eles e o domínio não fica gravado dentro do
JavaScript compilado.

O Nginx escuta na **8080** porque a 80 é do painel do CasaOS. Como quem fala com ele é
só o `cloudflared`, no próprio servidor, a porta escolhida é indiferente.

Os arquivos usados no deploy ficam em `deploy/`:

| Arquivo                          | O que é                                              |
| -------------------------------- | ---------------------------------------------------- |
| `DEPLOY.md`                      | O passo a passo                                       |
| `otica-api.service`              | Serviço do systemd que roda a API                     |
| `otica-sudoers`                  | Deixa o usuário `otica` reiniciar só a própria API     |
| `nginx-otica.conf`               | Site do Nginx (porta 8080)                            |
| `cloudflared-config.example.yml` | Modelo do `/etc/cloudflared/config.yml`               |
| `otica-publicar`                 | Deploy em um comando (backup, descompacta, build, reinicia) |
| `atualizar.sh`                   | Publica uma versão nova                               |
| `backup-banco.sh`                | Dump do Postgres + tar das fotos, com retenção de 14 dias |

---

## 8. A seção "Visite a loja"

Substituiu os depoimentos (texto genérico que não dizia nada sobre a loja) e absorveu a
seção de contato, que tinha um formulário sem destino nenhum. Mantém a âncora `#contato`.

Mostra se a loja está **aberta agora**, calculado no navegador e recalculado a cada minuto,
mais a semana inteira com o dia de hoje destacado, uma miniatura do mapa, o endereço,
WhatsApp e telefone clicável.

O mapa é o embed público do Google (`output=embed`), sem chave de API nem cartão cadastrado,
e com `loading="lazy"` — ele sozinho passa de 400 KB, então só é baixado quando a pessoa rola
até lá. O endereço vem da mesma constante que o texto logo abaixo, para a miniatura nunca
apontar para um lugar diferente do que está escrito.

A regra que justifica o cálculo está em `frontend/src/lib/horarios.js`: **o 1º e o 2º sábado
do mês abrem 9h às 17h, os demais 8h às 12h**. Escrita numa linha corrida, ninguém decifra;
o site passa a responder por quem perguntaria no WhatsApp. Se esse horário mudar, é só esse
arquivo que se mexe — as constantes ficam no topo dele.

---

## 9. Páginas do site

| Rota                        | O que é                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `/`                         | Home — hero, destaques (até 5), **vitrine em esteira**, **Visite a loja** |
| `/produtos`                 | Catálogo paginado, com filtro por categoria e busca          |
| `/produtos?categoria=solar` | Catálogo já filtrado (o link é compartilhável)               |
| `/produto/:slug`            | O catálogo com a peça já aberta — é o link que se manda no WhatsApp |
| `/admin/login`              | Login do painel                                              |
| `/admin`                    | Painel: abas **Produtos** e **Consultas** (exige login)      |

Clicar na foto de qualquer produto — na home, na vitrine ou no catálogo — abre a imagem
ampliada e registra a rota `/produto/<slug>`, que é o link copiável. Fecha no `Esc`, no `×`
ou clicando fora, e o botão voltar do navegador também fecha, em vez de tirar a pessoa do
site. Quem entrou por um link recebido cai direto na peça, e fechar leva ao catálogo.

Há três caminhos até o catálogo: o botão **Ver produtos** no hero, o link **Produtos** no
menu e o botão **Ver todos os produtos** no fim da seção de destaques.

---

## 10. A vitrine da home

Uma fileira de produtos que desliza sem parar, no lugar da antiga seção de diferenciais.
O sorteio é do servidor (`ORDER BY random()`), então cada visita vê uma seleção diferente
sem baixar o catálogo inteiro para embaralhar no navegador.

O movimento é uma animação CSS de `transform`, não JavaScript mexendo na posição quadro a
quadro: o navegador roda isso na GPU, sem passar pela thread principal. O loop infinito sai
de renderizar a lista **duas vezes** e mover o trilho exatamente `-50%` — quando a primeira
cópia termina de sair, a segunda está no lugar idêntico onde a primeira começou. Por isso o
espaçamento é `margin-right` em cada cartão e **não `gap`**: com `gap` o trilho mediria 2N
cartões + (2N−1) espaços, metade disso não seria uma cópia exata, e a esteira daria um
pulinho a cada volta.

Ela para em três situações: mouse em cima, dedo encostado (senão o cartão foge do toque) e
quando a seção sai da tela — animação rodando fora da vista é bateria indo embora sem
ninguém ver nada. Com `prefers-reduced-motion: reduce` ela vira uma fileira parada que se
arrasta com o dedo.

---

## 11. Links compartilháveis de produto

Cada peça tem o endereço `opticapopularsap.com.br/produto/<slug>`. Na foto ampliada há um
botão **Copiar link** e o **Tenho interesse**, que abre o WhatsApp com a mensagem já
contendo o endereço — em linha própria, que é a condição para o WhatsApp transformá-lo em
prévia em vez de texto cru.

No servidor, o Nginx precisa de um `location /produto/` repassando para a API (já está no
`deploy/nginx-otica.conf`). Sem ele o link abre o site, mas cai no catálogo em vez da peça.

A variável `SPA_INDEX` (`backend/.env`) aponta para o `index.html` compilado que a rota lê;
o padrão é `/var/www/otica/index.html`. Em desenvolvimento, sem build no disco, a rota
devolve uma página mínima que redireciona para o catálogo — a prévia continua funcionando.
