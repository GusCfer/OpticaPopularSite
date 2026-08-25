'use strict'

const nodemailer = require('nodemailer')
const env = require('../config/env')

let transportador = null

/**
 * Conexão SMTP reaproveitada entre os envios (pool).
 * Devolve null quando SMTP_USER/SMTP_PASS não estão preenchidos — assim a API
 * sobe normalmente mesmo sem e-mail configurado.
 */
function obterTransportador() {
  if (!env.SMTP.configurado) return null
  if (transportador) return transportador

  transportador = nodemailer.createTransport({
    host: env.SMTP.host,
    port: env.SMTP.port,
    secure: env.SMTP.secure,
    auth: { user: env.SMTP.user, pass: env.SMTP.pass },
    pool: true,
    maxConnections: 2,
    // o Gmail derruba quem manda rápido demais
    rateDelta: 1000,
    rateLimit: 3,
  })
  return transportador
}

/** Testa usuário/senha contra o servidor sem mandar mensagem nenhuma. */
async function verificarConexao() {
  const t = obterTransportador()
  if (!t) throw new Error('SMTP não configurado: preencha SMTP_USER e SMTP_PASS no backend/.env')
  try {
    await t.verify()
  } catch (err) {
    throw new Error(traduzirErroSmtp(err))
  }
  return true
}

/** Envia um e-mail. Lança erro com mensagem legível se o SMTP recusar. */
async function enviarEmail({ para, assunto, html, texto }) {
  const t = obterTransportador()
  if (!t) throw new Error('SMTP não configurado: preencha SMTP_USER e SMTP_PASS no backend/.env')

  try {
    const info = await t.sendMail({
      from: env.SMTP.remetente,
      to: para,
      subject: assunto,
      text: texto,
      html,
    })
    return info.messageId
  } catch (err) {
    throw new Error(traduzirErroSmtp(err))
  }
}

/** Erros de SMTP são crípticos; aqui viram algo acionável no painel. */
function traduzirErroSmtp(err) {
  const msg = err.message || 'falha desconhecida'

  if (err.code === 'EAUTH' || /535|invalid credentials|username and password/i.test(msg)) {
    return (
      'O Gmail recusou usuário/senha. Use uma SENHA DE APP (16 letras, gerada em ' +
      'myaccount.google.com/apppasswords com a verificação em duas etapas ligada) — ' +
      'a senha normal da conta não funciona no SMTP.'
    )
  }
  if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
    return `Não consegui falar com ${env.SMTP.host}:${env.SMTP.port}. Verifique a internet e se a porta não está bloqueada.`
  }
  if (err.responseCode === 550 || /recipient|mailbox unavailable/i.test(msg)) {
    return 'O servidor recusou o destinatário. Confira o e-mail do paciente.'
  }
  return `Falha no envio: ${msg}`
}

module.exports = { enviarEmail, verificarConexao, obterTransportador }
