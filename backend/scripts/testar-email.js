#!/usr/bin/env node
'use strict'

/**
 * Confere se o Gmail aceita o usuário/senha do .env e, se você passar um
 * endereço, manda um lembrete de exemplo pra lá.
 *
 *   npm run testar-email
 *   npm run testar-email -- seu@email.com
 */

const env = require('../src/config/env')
const { verificarConexao, enviarEmail } = require('../src/lib/email')
const { montarMensagem } = require('../src/jobs/lembretes')
const { hojeLocal, somarDias } = require('../src/lib/datas')
const { pool } = require('../src/lib/db')

async function main() {
  if (!env.SMTP.configurado) {
    throw new Error(
      'SMTP_USER e/ou SMTP_PASS estão vazios no backend/.env.\n' +
        '  SMTP_USER = seu endereço do Gmail\n' +
        '  SMTP_PASS = senha de app de 16 letras (myaccount.google.com/apppasswords)'
    )
  }

  console.log(`\n  Servidor: ${env.SMTP.host}:${env.SMTP.port} (secure=${env.SMTP.secure})`)
  console.log(`  Conta:    ${env.SMTP.user}`)
  process.stdout.write('\n  Testando login ... ')
  await verificarConexao()
  console.log('ok')

  const destino = process.argv[2]
  if (!destino) {
    console.log('\n✓ Login aceito. Para receber um lembrete de exemplo:')
    console.log('    npm run testar-email -- seu@email.com\n')
    return
  }

  const amanha = somarDias(hojeLocal(), 1)
  const { assunto, texto, html } = montarMensagem({
    id: 0,
    pacienteNome: 'Paciente de Teste',
    pacienteEmail: destino,
    medicoNome: 'Dra. Exemplo',
    dataHora: `${amanha}T14:30`,
    observacoes: 'E-mail de teste — nenhuma consulta real foi agendada.',
  })

  process.stdout.write(`  Enviando para ${destino} ... `)
  await enviarEmail({ para: destino, assunto, texto, html })
  console.log('ok')
  console.log('\n✓ Enviado. Confira a caixa de entrada (e o spam, no primeiro envio).\n')
}

main()
  .catch((err) => {
    console.error('\n✗ Não deu certo:\n  ' + err.message + '\n')
    process.exitCode = 1
  })
  .finally(() => pool.end())
