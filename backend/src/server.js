'use strict'

const app = require('./app')
const env = require('./config/env')
const { pool } = require('./lib/db')
const { iniciarAgendador, pararAgendador } = require('./jobs/lembretes')

async function iniciar() {
  try {
    await pool.query('SELECT 1')
    console.log('[db] conectado ao PostgreSQL')
  } catch (err) {
    console.error('\n[db] não consegui conectar ao PostgreSQL.')
    console.error('     Suba o banco com:  docker compose up -d')
    console.error('     Detalhe:', err.message, '\n')
    process.exit(1)
  }

  const servidor = app.listen(env.PORT, () => {
    console.log(`[api] rodando em http://localhost:${env.PORT} (${env.NODE_ENV})`)
  })

  // Cron dos lembretes de consulta (um dia antes, 08:00 por padrão)
  iniciarAgendador()

  const encerrar = (sinal) => {
    console.log(`\n[api] ${sinal} recebido, encerrando...`)
    pararAgendador()
    servidor.close(() => pool.end().then(() => process.exit(0)))
  }
  process.on('SIGINT', () => encerrar('SIGINT'))
  process.on('SIGTERM', () => encerrar('SIGTERM'))
}

iniciar()
