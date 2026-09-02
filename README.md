<h1 align="center">Óptica Popular</h1>

<p align="center">
  Site institucional e sistema de gestão para uma óptica e joalheria de bairro,
  em Santo Antônio da Platina&nbsp;— PR.
</p>

<p align="center">
  <a href="https://opticapopularsap.com.br"><strong>opticapopularsap.com.br&nbsp;→</strong></a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-0b7285?style=flat-square" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-6741d9?style=flat-square" />
  <img alt="Node" src="https://img.shields.io/badge/Node-Express%204-2b8a3e?style=flat-square" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-1864ab?style=flat-square" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-0c8599?style=flat-square" />
</p>

---

## O que é

A Óptica Popular vendia por WhatsApp e por vitrine física. Não havia catálogo online, o
horário de sábado mudava conforme a semana do mês (e ninguém acertava), e os agendamentos
de exame de vista viviam numa agenda de papel — com o esquecimento do paciente saindo caro
para a loja.

Este projeto é a resposta a esses três problemas: um site público com o catálogo sempre
atualizado, um painel administrativo que a atendente usa do próprio celular, e um agendador
que dispara os lembretes por e-mail sozinho.

Está **no ar e em uso pela loja**, num servidor Ubuntu caseiro exposto por Cloudflare
Tunnel — sem nenhuma porta aberta no roteador.

<!--
  Capturas de tela: coloque as imagens em docs/img/ e descomente.

  | Home | Catálogo | Painel |
  | :--: | :------: | :----: |
  | <img src="docs/img/home.png" width="260"> | <img src="docs/img/catalogo.png" width="260"> | <img src="docs/img/painel.png" width="260"> |
-->

## O que ele faz

**Para quem visita**

- Catálogo paginado com busca e filtro por categoria, tudo refletido na URL — o link de uma
  busca é compartilhável e o botão voltar do navegador funciona de verdade.
- Cada peça tem **link próprio** (`/produto/aviator-classic`). Colado no WhatsApp, ele vira
  uma prévia com foto, nome e preço; aberto, cai direto na peça em vez do catálogo.
- Galeria de até 8 fotos por produto, com carrossel, zoom por toque e indicador "Foto 2 de 8".
- Uma vitrine em esteira contínua na home, sorteada a cada visita.
- A seção **Visite a loja** responde "está aberto agora?" em tempo real, com a semana
  inteira, o mapa e o WhatsApp a um toque.

**Para quem administra**

- Painel em `/admin`, responsivo de verdade — as fotos dos produtos são tiradas pela câmera
  do celular ali mesmo.
- Cadastro de produtos com até 8 imagens, destaques (limitados a 5), ativação e busca.
- Agenda de consultas com médico, paciente e horário, protegida contra choque de horários.
- **Lembrete automático por e-mail** na véspera de cada consulta, com fila que se recupera
  sozinha se a internet cair.

## Decisões que valem comentar

Algumas escolhas do projeto que foram além do "funciona":

**As regras de negócio moram no banco, não só no código.** O limite de 8 fotos por produto
não é um `if`: é `UNIQUE (produto_id, ordem)` somado a `CHECK (ordem < 8)` — a nona linha é
impossível de existir. O teto de 5 destaques é uma trigger que recusa até um `UPDATE` feito
à mão pelo pgAdmin. E a capa do produto é mantida em dia por outra trigger, o que permitiu
adicionar a galeria inteira sem mudar uma linha do SQL da home.

**A imagem é otimizada antes de sair do celular.** O navegador redimensiona cada foto para
1600px em WebP no `canvas` antes do upload: uma foto de 5 MB vira ~200 KB. Poupa o 4G da
loja, o disco do servidor e o tempo de quem abre o site — e, de quebra, o reencode descarta
o EXIF, então a localização GPS da foto nunca vai parar num arquivo público.

**A prévia do WhatsApp exigiu sair do SPA.** O robô que gera a prévia do link não executa
JavaScript, então preencher as meta tags depois que o React sobe não adianta. A rota
`/produto/:slug` é servida pelo Express: ele lê o `index.html` compilado e injeta as tags
Open Graph daquela peça no `<head>`, mantendo tudo o mais idêntico.

**Carrosséis sem biblioteca.** O da galeria é `scroll-snap` puro — o arrasto, a inércia e a
parada no slide certo são do próprio sistema operacional, que faz isso melhor que qualquer
JS. O da vitrine é uma animação CSS de `transform`, que roda na GPU e não engasga quando a
pessoa rola a página. Os dois somados custam poucos KB.

**Infraestrutura sem porta aberta.** Só o `cloudflared` fala com a internet; Nginx, API e
banco vivem todos no `localhost`. Nada precisa ser liberado no roteador ou no firewall.

## Arquitetura

```
Internet → Cloudflare → cloudflared → Nginx :8080 ─┬→ site compilado (/var/www/otica)
                                                   ├→ /produto/  ─┐
                                                   └→ /api, /uploads ─→ API :3333 (systemd)
                                                                              ↓
                                                                PostgreSQL :5432 (Docker)
```

Site e painel ficam na mesma origem do `/api`: não existe CORS entre eles, e o domínio não
fica gravado dentro do JavaScript compilado.

## Stack

| Camada        | O que foi usado                                                          |
| ------------- | ------------------------------------------------------------------------ |
| Front-end     | React 19, Vite 8, React Router 7, CSS puro (sem framework de UI)          |
| Back-end      | Node.js, Express 4, node-postgres, Zod, JWT, bcrypt, Multer, Nodemailer, node-cron |
| Banco         | PostgreSQL 16 — constraints, triggers e índices carregando regra de negócio |
| Infra         | Docker Compose, Nginx, systemd, Cloudflare Tunnel, Ubuntu Server          |

Nenhuma biblioteca de componentes, de carrossel ou de máscara: o front é escrito à mão, e o
bundle final fica em torno de 90 KB gzip.

## Segurança

bcrypt com custo 12, JWT de 8h, rate limit por IP **e** bloqueio por conta, respostas de
login com tempo constante para não vazar quais e-mails existem, 100% de queries
parametrizadas, validação com Zod em toda rota que escreve, Helmet, CORS de lista fechada,
upload restrito por tipo e tamanho com nome de arquivo gerado no servidor, e nenhuma rota
pública que exponha dado de paciente. Não existe cadastro aberto.

A tabela completa está na [documentação técnica](DOCUMENTACAO.md#4-segurança).

## Rodando localmente

Precisa de Docker e Node 18+.

```bash
docker compose up -d                       # Postgres + pgAdmin, já com as tabelas

cd backend && cp .env.example .env
npm install && npm run criar-admin && npm run dev

cd ../frontend && cp .env.example .env
npm install && npm run dev                 # http://localhost:5173
```

O passo a passo detalhado, a referência do banco e todas as rotas da API estão em
**[DOCUMENTACAO.md](DOCUMENTACAO.md)**. Para publicar num servidor do zero — incluindo o
Cloudflare Tunnel — veja **[deploy/DEPLOY.md](deploy/DEPLOY.md)**.

## Estrutura

```
OticaPopularSap/
├── backend/            API Express + PostgreSQL
│   └── src/            rotas · services · middlewares · jobs (lembretes)
├── frontend/           Site React/Vite e painel /admin
│   └── src/            pages · components · admin · lib · services
├── docker/initdb/      SQL versionado: tabelas, triggers e migrações
├── deploy/             systemd, Nginx, Cloudflare, backup e publicação
└── DOCUMENTACAO.md     manual técnico completo
```

---

<p align="center">
  Desenvolvido por <strong>Gustavo Carvalho Fernandes</strong> ·
  <a href="https://opticapopularsap.com.br">ver o projeto no ar</a>
</p>
