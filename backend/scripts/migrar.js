#!/usr/bin/env node
'use strict'

/**
 * Aplica no banco JÁ EXISTENTE os arquivos SQL de migração de docker/initdb/.
 *   npm run migrar
 *
 * Num banco novo o Postgres já roda esses arquivos sozinho na primeira subida;
 * este script é para quem criou o banco antes da migração existir.
 * Todo SQL migrado é idempotente (IF NOT EXISTS), então rodar duas vezes não quebra.
 */

const fs = require('node:fs')
const path = require('node:path')
const { pool } = require('../src/lib/db')

// Só os arquivos a partir do 03: 01 e 02 são a base, já aplicada.
const MIGRACOES = ['03-consultas.sql']

const DIR = path.resolve(__dirname, '..', '..', 'docker', 'initdb')

async function main() {
  for (const arquivo of MIGRACOES) {
    const caminho = path.join(DIR, arquivo)
    if (!fs.existsSync(caminho)) {
      console.warn(`  ! ${arquivo} não encontrado em ${DIR} — pulando`)
      continue
    }
    process.stdout.write(`  → ${arquivo} ... `)
    await pool.query(fs.readFileSync(caminho, 'utf8'))
    console.log('ok')
  }
  console.log('\n✓ Banco atualizado.\n')
}

main()
  .catch((err) => {
    console.error('\n✗ Falhou:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
