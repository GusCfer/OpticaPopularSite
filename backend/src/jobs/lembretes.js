'use strict'

const cron = require('node-cron')
const env = require('../config/env')
const consultas = require('../services/consultas.service')
const { enviarEmail } = require('../lib/email')
const { hojeLocal, somarDias, porExtenso, dataBR, horaBR } = require('../lib/datas')

/* ====================================================================
   Lembrete de consulta — sai um dia antes.

   Um cron diário (LEMBRETES_CRON, padrão 08:00 no fuso da óptica) varre
   as consultas AGENDADAS do dia seguinte que ainda estão com
   lembrete_enviado_em NULL e manda o e-mail para cada paciente.

   Só marca como enviado quando o SMTP aceita a mensagem, então uma falha
   de rede não faz o paciente perder o aviso: a consulta continua na fila
   e pode ser reenviada pelo painel.
   ==================================================================== */

function escapar(texto) {
  return String(texto ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

function montarMensagem(consulta) {
  const { nome, telefone, endereco } = env.OTICA
  const dia = porExtenso(consulta.dataHora)
  const hora = horaBR(consulta.dataHora)
  const primeiroNome = consulta.pacienteNome.trim().split(/\s+/)[0]

  const assunto = `Lembrete: sua consulta é amanhã, ${dataBR(consulta.dataHora)} às ${hora}`

  const texto = [
    `Olá, ${primeiroNome}!`,
    '',
    `Passando para lembrar da sua consulta amanhã na ${nome}.`,
    '',
    `Médico(a): ${consulta.medicoNome}`,
    `Data: ${dia}`,
    `Horário: ${hora}`,
    consulta.observacoes ? `Observações: ${consulta.observacoes}` : null,
    endereco ? `Endereço: ${endereco}` : null,
    '',
    telefone
      ? `Se precisar remarcar ou cancelar, fale com a gente pelo telefone ${telefone}.`
      : 'Se precisar remarcar ou cancelar, é só responder este e-mail.',
    '',
    `Até amanhã!`,
    nome,
  ]
    .filter((l) => l !== null)
    .join('\n')

  const linha = (rotulo, valor) =>
    valor
      ? `<tr>
           <td style="padding:6px 0;color:#6b6259;font-size:14px;white-space:nowrap;">${escapar(rotulo)}</td>
           <td style="padding:6px 0 6px 16px;color:#1c1917;font-size:15px;font-weight:600;">${escapar(valor)}</td>
         </tr>`
      : ''

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f5f1ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">
    <tr>
      <td style="background:#1c1917;padding:20px 28px;color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.02em;">
        ${escapar(nome)}
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1c1917;">Sua consulta é amanhã</p>
        <p style="margin:0 0 22px;font-size:15px;color:#57534e;line-height:1.55;">
          Olá, ${escapar(primeiroNome)}! Este é o lembrete da consulta que você agendou com a gente.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#faf7f4;border:1px solid #ebe3da;border-radius:12px;padding:14px 18px;">
          ${linha('Médico(a)', consulta.medicoNome)}
          ${linha('Data', dia)}
          ${linha('Horário', hora)}
          ${linha('Paciente', consulta.pacienteNome)}
          ${linha('Observações', consulta.observacoes)}
        </table>

        ${endereco ? `<p style="margin:20px 0 0;font-size:14px;color:#57534e;line-height:1.55;"><strong style="color:#1c1917;">Endereço:</strong> ${escapar(endereco)}</p>` : ''}

        <p style="margin:20px 0 0;font-size:14px;color:#57534e;line-height:1.55;">
          ${
            telefone
              ? `Precisa remarcar ou cancelar? Fale com a gente pelo telefone <strong style="color:#1c1917;">${escapar(telefone)}</strong>.`
              : 'Precisa remarcar ou cancelar? É só responder este e-mail.'
          }
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#faf7f4;border-top:1px solid #ebe3da;color:#8a8078;font-size:12px;line-height:1.5;">
        Você recebeu este e-mail porque tem uma consulta agendada na ${escapar(nome)}.
      </td>
    </tr>
  </table>
</body></html>`

  return { assunto, texto, html }
}

/** Envia o lembrete de uma consulta específica. Usado pelo cron e pelo painel. */
async function enviarLembrete(consulta) {
  const { assunto, texto, html } = montarMensagem(consulta)
  try {
    await enviarEmail({ para: consulta.pacienteEmail, assunto, texto, html })
    await consultas.marcarLembreteEnviado(consulta.id)
    return { ok: true }
  } catch (err) {
    await consultas.marcarLembreteComErro(consulta.id, err.message)
    return { ok: false, erro: err.message }
  }
}

/**
 * Roda a varredura do dia. `dataAlvo` (AAAA-MM-DD) permite forçar outro dia
 * — o padrão é amanhã.
 */
async function processarLembretes(dataAlvo) {
  const dia = dataAlvo || somarDias(hojeLocal(), 1)

  if (!env.SMTP.configurado) {
    console.warn('[lembretes] SMTP não configurado — nada enviado. Preencha SMTP_USER e SMTP_PASS no backend/.env')
    return { dia, total: 0, enviados: 0, falhas: 0, semSmtp: true }
  }

  const pendentes = await consultas.pendentesDeLembrete(dia)
  if (pendentes.length === 0) {
    console.log(`[lembretes] nenhuma consulta em ${dia} aguardando lembrete`)
    return { dia, total: 0, enviados: 0, falhas: 0 }
  }

  let enviados = 0
  let falhas = 0
  const erros = []

  for (const consulta of pendentes) {
    const r = await enviarLembrete(consulta)
    if (r.ok) {
      enviados += 1
    } else {
      falhas += 1
      erros.push({ id: consulta.id, paciente: consulta.pacienteNome, erro: r.erro })
      console.error(`[lembretes] falha na consulta #${consulta.id} (${consulta.pacienteEmail}): ${r.erro}`)
    }
  }

  console.log(`[lembretes] ${dia}: ${enviados} enviado(s), ${falhas} falha(s) de ${pendentes.length}`)
  return { dia, total: pendentes.length, enviados, falhas, erros }
}

let tarefa = null

/** Liga o agendador. Chamado uma vez, na subida do servidor. */
function iniciarAgendador() {
  if (!env.LEMBRETES.ativo) {
    console.log('[lembretes] agendador desligado (LEMBRETES_ATIVO=false)')
    return null
  }
  if (!cron.validate(env.LEMBRETES.cron)) {
    console.error(`[lembretes] LEMBRETES_CRON inválido: "${env.LEMBRETES.cron}". Agendador não iniciado.`)
    return null
  }
  if (!env.SMTP.configurado) {
    console.warn(
      '[lembretes] SMTP_USER/SMTP_PASS vazios no .env — o agendador sobe, mas nenhum e-mail será enviado.'
    )
  }

  tarefa = cron.schedule(
    env.LEMBRETES.cron,
    () => {
      processarLembretes().catch((err) => console.error('[lembretes] erro na varredura:', err.message))
    },
    { timezone: env.TIMEZONE, name: 'lembretes-consultas', noOverlap: true }
  )

  console.log(`[lembretes] agendado: "${env.LEMBRETES.cron}" (${env.TIMEZONE})`)
  return tarefa
}

function pararAgendador() {
  if (tarefa) {
    tarefa.stop()
    tarefa = null
  }
}

module.exports = { iniciarAgendador, pararAgendador, processarLembretes, enviarLembrete, montarMensagem }
