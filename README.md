# Óptica Popular — site + painel administrativo

Site institucional em React/Vite, API em Node/Express e PostgreSQL rodando no Docker.
Produtos são cadastrados pelo painel em `/admin`, com upload de imagem, e os marcados
como **destaque** (no máximo 5) aparecem na home.

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

## 3. Segurança

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

**Antes de colocar no ar**, faça três coisas:

1. Troque `JWT_SECRET` por um valor aleatório de verdade (a API se recusa a subir em
   produção com o segredo de exemplo).
2. Troque `POSTGRES_PASSWORD` e a senha do pgAdmin no `.env` da raiz.
3. Não exponha a porta 5432 nem o pgAdmin na internet.

---

## 4. Imagens dos produtos

Hoje ficam em `backend/uploads/produtos/`, servidas pela própria API em
`/uploads/produtos/<arquivo>`. O banco guarda só o caminho relativo.

**Para migrar pra nuvem depois** (S3, Cloudinary, etc.), só dois arquivos mudam:

- `backend/src/middlewares/upload.js` — troca o `multer.diskStorage` pelo storage do provedor.
- `backend/src/app.js` — remove o `express.static('/uploads')`.

Como o banco guarda o caminho e a URL absoluta é montada na resposta
(`API_PUBLIC_URL + caminho`), os produtos já cadastrados continuam funcionando.

---

## 5. Rotas da API

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

Erros vêm sempre como `{ erro, codigo, detalhes? }`.

---

## 6. Publicar em produção

O painel é uma SPA: o servidor precisa devolver o `index.html` para qualquer rota
(senão `/admin` dá 404 ao recarregar a página).

**Nginx:**

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**Vercel / Netlify:** ative o modo SPA / rewrite `/* → /index.html`.

No `frontend/.env` de produção, aponte `VITE_API_URL` para a URL pública da API, e no
`backend/.env` coloque o domínio do site em `CORS_ORIGINS` e `API_PUBLIC_URL`.

---

## 7. Páginas do site

| Rota                        | O que é                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `/`                         | Home — hero, destaques (até 5), diferenciais, depoimentos, contato |
| `/produtos`                 | Catálogo completo, com filtro por categoria e busca          |
| `/produtos?categoria=solar` | Catálogo já filtrado (o link é compartilhável)               |
| `/admin/login`              | Login do painel                                              |
| `/admin`                    | Painel de produtos (exige login)                             |

Clicar na foto de qualquer produto — na home ou no catálogo — abre a imagem ampliada.
Fecha no `Esc`, no `×` ou clicando fora.

Há três caminhos até o catálogo: o botão **Ver produtos** no hero, o link **Produtos** no
menu e o botão **Ver todos os produtos** no fim da seção de destaques.
