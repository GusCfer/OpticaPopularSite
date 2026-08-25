'use strict'

const path = require('node:path')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const env = require('./config/env')
const authRoutes = require('./routes/auth.routes')
const produtosRoutes = require('./routes/produtos.routes')
const consultasRoutes = require('./routes/consultas.routes')
const { naoEncontrado, tratadorDeErros } = require('./middlewares/erro')

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)

// Cabeçalhos de segurança. crossOriginResourcePolicy liberado pra imagem
// carregar no front rodando em outra porta.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
)

// CORS. Em produção o site e a API ficam atrás do mesmo domínio (Nginx), então
// a maioria das chamadas é de MESMA ORIGEM — essas passam sempre, mesmo que
// CORS_ORIGINS esteja com o domínio errado. Sem isso, um .env desatualizado
// derruba o painel inteiro com um erro que não explica nada.
app.use(
  cors((req, cb) => {
    const origem = req.headers.origin

    // curl, apps nativos, healthcheck: sem Origin, não é uma chamada de navegador
    if (!origem) return cb(null, { origin: true, credentials: true })

    let mesmaOrigem = false
    try {
      mesmaOrigem = new URL(origem).host === req.headers.host
    } catch {
      mesmaOrigem = false
    }

    if (mesmaOrigem || env.CORS_ORIGINS.includes(origem)) {
      return cb(null, { origin: true, credentials: true })
    }

    // Não lançamos erro: isso viraria um 500 confuso. O navegador bloqueia
    // sozinho pela falta do cabeçalho, e aqui fica o registro do motivo.
    console.warn(`[cors] origem bloqueada: ${origem} — inclua em CORS_ORIGINS no .env`)
    return cb(null, { origin: false })
  })
)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
)

// Imagens dos produtos servidas do disco local.
// Trocar por S3/Cloudinary depois é só mexer aqui e no middleware de upload.
app.use(
  '/uploads',
  express.static(env.UPLOAD_DIR, {
    maxAge: '7d',
    index: false,
    dotfiles: 'ignore',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
)

app.get('/api/health', (_req, res) => res.json({ ok: true, ambiente: env.NODE_ENV }))

app.use('/api/auth', authRoutes)
app.use('/api', produtosRoutes)
app.use('/api', consultasRoutes)

app.use(naoEncontrado)
app.use(tratadorDeErros)

module.exports = app
