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

  // ---- Agenda de consultas e lembrete por e-mail ----------------------
  // Fuso da óptica. As consultas são gravadas em horário local (TIMESTAMP
  // sem timezone), então tudo que envolve "que dia é hoje" é resolvido aqui.
  TIMEZONE: process.env.TIMEZONE || 'America/Sao_Paulo',

  SMTP: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    // porta 465 = SSL direto; 587 = STARTTLS
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : Number(process.env.SMTP_PORT || 465) === 465,
    user: (process.env.SMTP_USER || '').trim(),
    // Senha de app do Gmail (16 letras). O Google costuma mostrar com espaços.
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
    remetente: (process.env.SMTP_FROM || '').trim(),
  },

  LEMBRETES: {
    // false desliga o agendador sem precisar mexer no código
    ativo: (process.env.LEMBRETES_ATIVO || 'true') === 'true',
    // padrão: todo dia às 08:00, avisando quem tem consulta amanhã
    cron: process.env.LEMBRETES_CRON || '0 8 * * *',
  },

  OTICA: {
    nome: process.env.OTICA_NOME || 'Óptica Popular',
    telefone: process.env.OTICA_TELEFONE || '',
    endereco: process.env.OTICA_ENDERECO || '',
  },
}

// O e-mail só sai se usuário e senha estiverem preenchidos. Sem isso a API
// sobe do mesmo jeito — só o lembrete fica desligado, com aviso no console.
env.SMTP.configurado = Boolean(env.SMTP.user && env.SMTP.pass)
env.SMTP.remetente = env.SMTP.remetente || (env.SMTP.user ? `"${env.OTICA.nome}" <${env.SMTP.user}>` : '')

module.exports = env
