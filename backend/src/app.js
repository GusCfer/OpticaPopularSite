'use strict'

const path = require('node:path')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const env = require('./config/env')
const authRoutes = require('./routes/auth.routes')
const produtosRoutes = require('./routes/produtos.routes')
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

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true) // curl, apps nativos, healthcheck
      if (env.CORS_ORIGINS.includes(origin)) return cb(null, true)
      return cb(new Error(`Origem não autorizada: ${origin}`))
    },
    credentials: true,
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

app.use(naoEncontrado)
app.use(tratadorDeErros)

module.exports = app
