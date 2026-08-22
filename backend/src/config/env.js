'use strict'

const path = require('node:path')
require('dotenv').config()

function obrigatorio(chave) {
  const valor = process.env[chave]
  if (!valor || !valor.trim()) {
    throw new Error(
      `Variável de ambiente ${chave} não definida. Copie backend/.env.example para backend/.env e preencha.`
    )
  }
  return valor.trim()
}

const NODE_ENV = process.env.NODE_ENV || 'development'
const producao = NODE_ENV === 'production'

const JWT_SECRET = obrigatorio('JWT_SECRET')

// Em produção não deixamos subir com o segredo de exemplo ou fraco demais.
if (producao) {
  if (JWT_SECRET.length < 48 || JWT_SECRET.includes('troque-este-segredo')) {
    throw new Error(
      'JWT_SECRET fraco ou padrão. Gere um novo: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    )
  }
}

const env = {
  NODE_ENV,
  producao,
  PORT: Number(process.env.PORT || 3333),
  DATABASE_URL: obrigatorio('DATABASE_URL'),
  API_PUBLIC_URL: (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3333}`).replace(/\/$/, ''),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  UPLOAD_DIR: path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads'),
  UPLOAD_MAX_BYTES: Number(process.env.UPLOAD_MAX_MB || 5) * 1024 * 1024,
  MAX_DESTAQUES: 5,
}

module.exports = env
