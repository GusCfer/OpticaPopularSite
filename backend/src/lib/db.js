'use strict'

const { Pool } = require('pg')
const env = require('../config/env')

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

pool.on('error', (err) => {
  console.error('[db] erro inesperado no pool de conexões:', err.message)
})

/** Executa uma query parametrizada. NUNCA concatene valor em SQL: use $1, $2... */
function query(texto, params) {
  return pool.query(texto, params)
}

/** Roda um bloco dentro de uma transação, com commit/rollback automático. */
async function transacao(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const resultado = await fn(client)
    await client.query('COMMIT')
    return resultado
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = { pool, query, transacao }
