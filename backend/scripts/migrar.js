#!/usr/bin/env node
'use strict'

/**
 * Aplica no banco JÁ EXISTENTE os arquivos SQL de docker/initdb/ que ainda
 * não rodaram.
 *   npm run migrar
 *
 * Como ele decide o que rodar: olha os arquivos "NN-nome.sql" dentro de
 * docker/initdb/, pega os de número 03 em diante (01 e 02 são a base, que o
 * Postgres já aplica sozinho na primeira subida do container) e roda TODOS
 * eles, em ordem — sempre, mesmo os que já rodaram antes.
 *
 * Isso só é seguro porque cada arquivo de migração é escrito para ser
 * IDEMPOTENTE (IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS...).
 * Rodar de novo uma tabela que já existe não dá erro, só não faz nada.
 *
 * Ou seja: para adicionar uma tabela nova no futuro, basta criar
 * docker/initdb/04-o-que-for.sql (seguindo esse mesmo estilo idempotente) e
 * rodar "npm run migrar" — não precisa editar este script.
 */

const fs = require('node:fs')
const path = require('node:path')
const { pool } = require('../src/lib/db')

const DIR = path.resolve(__dirname, '..', '..', 'docker', 'initdb')

// só os arquivos "NN-algo.sql" com NN >= 3 — 01 e 02 são a base do projeto
function listarMigracoes() {
  return fs
    .readdirSync(DIR)
    .map((nome) => {
      const m = nome.match(/^(\d+)-.+\.sql$/)
      return m ? { nome, numero: Number(m[1]) } : null
    })
    .filter((m) => m && m.numero >= 3)
    .sort((a, b) => a.numero - b.numero)
    .map((m) => m.nome)
}

async function main() {
  const migracoes = listarMigracoes()

  if (migracoes.length === 0) {
    console.log(`  (nenhum arquivo de migração encontrado em ${DIR})`)
    return
  }

  for (const arquivo of migracoes) {
    process.stdout.write(`  → ${arquivo} ... `)
    await pool.query(fs.readFileSync(path.join(DIR, arquivo), 'utf8'))
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
