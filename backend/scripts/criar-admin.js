#!/usr/bin/env node
'use strict'

/**
 * Cria o primeiro usuário do painel.
 *   npm run criar-admin -- "Gustavo" gustavo@email.com MinhaSenha123
 * Sem argumentos, ele pergunta no terminal.
 */

const readline = require('node:readline/promises')
const { stdin, stdout } = require('node:process')

const usuarios = require('../src/services/usuarios.service')
const { pool } = require('../src/lib/db')

async function main() {
  let [nome, email, senha] = process.argv.slice(2)

  if (!nome || !email || !senha) {
    const rl = readline.createInterface({ input: stdin, output: stdout })
    nome = nome || (await rl.question('Nome: '))
    email = email || (await rl.question('E-mail: '))
    senha = senha || (await rl.question('Senha (mín. 8 caracteres, com letra e número): '))
    rl.close()
  }

  const usuario = await usuarios.criarUsuario({ nome, email, senha, papel: 'ADMIN' })
  console.log('\n✓ Administrador criado:')
  console.log(`  ${usuario.nome} <${usuario.email}> — papel ${usuario.papel}`)
  console.log('\n  Acesse o painel em http://localhost:5173/admin/login\n')
}

main()
  .catch((err) => {
    console.error('\n✗ Não deu certo:', err.message)
    if (err.issues) err.issues.forEach((i) => console.error(`  - ${i.path.join('.')}: ${i.message}`))
    process.exitCode = 1
  })
  .finally(() => pool.end())
