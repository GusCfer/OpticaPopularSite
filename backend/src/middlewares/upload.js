'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const multer = require('multer')
const env = require('../config/env')
const { requisicaoInvalida } = require('../lib/erros')

const DESTINO = path.join(env.UPLOAD_DIR, 'produtos')
fs.mkdirSync(DESTINO, { recursive: true })

const TIPOS_PERMITIDOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DESTINO),
  // Nome aleatório: o nome enviado pelo usuário nunca toca o disco (evita path traversal).
  filename: (_req, file, cb) => {
    const ext = TIPOS_PERMITIDOS[file.mimetype] || '.bin'
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS[file.mimetype]) {
      return cb(requisicaoInvalida('Formato inválido. Envie JPG, PNG, WEBP ou AVIF.', 'FORMATO_INVALIDO'))
    }
    cb(null, true)
  },
})

/** Remove do disco a imagem de um produto apagado/substituído. */
function apagarImagem(caminhoRelativo) {
  if (!caminhoRelativo || !caminhoRelativo.startsWith('/uploads/')) return
  const alvo = path.join(env.UPLOAD_DIR, caminhoRelativo.replace('/uploads/', ''))
  const dentroDaPasta = path.resolve(alvo).startsWith(path.resolve(env.UPLOAD_DIR))
  if (!dentroDaPasta) return
  fs.promises.unlink(alvo).catch(() => {})
}

module.exports = { upload, apagarImagem }
