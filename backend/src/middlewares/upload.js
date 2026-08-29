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
  // files: o painel manda a galeria inteira de uma vez. O tamanho por arquivo
  // continua valendo — o navegador já reduz a foto antes de enviar, então
  // 5 MB aqui é folga, não o caso normal.
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: env.MAX_IMAGENS_PRODUTO },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS[file.mimetype]) {
      return cb(requisicaoInvalida('Formato inválido. Envie JPG, PNG, WEBP ou AVIF.', 'FORMATO_INVALIDO'))
    }
    cb(null, true)
  },
})

/**
 * Aceita a galeria em um envio só. Dois nomes de campo pela compatibilidade:
 * "imagens" é o novo, "imagem" era o de antes, quando a foto era uma só.
 */
const uploadGaleria = upload.fields([
  { name: 'imagens', maxCount: env.MAX_IMAGENS_PRODUTO },
  { name: 'imagem', maxCount: env.MAX_IMAGENS_PRODUTO },
])

/** Junta os dois campos numa lista só, na ordem em que chegaram. */
function arquivosEnviados(req) {
  const campos = req.files || {}
  return [...(campos.imagens || []), ...(campos.imagem || [])]
}

module.exports = { upload, uploadGaleria, arquivosEnviados }
