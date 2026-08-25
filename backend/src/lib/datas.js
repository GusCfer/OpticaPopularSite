'use strict'

const env = require('../config/env')

/**
 * As consultas ficam no banco como TIMESTAMP sem fuso: é sempre o horário
 * local da óptica. Para não depender do fuso do container do Postgres nem do
 * servidor, tudo aqui trafega como texto "AAAA-MM-DDTHH:MM".
 */

/** Data de hoje (AAAA-MM-DD) no fuso configurado em TIMEZONE. */
function hojeLocal() {
  // en-CA formata como 2026-08-25, que é exatamente o formato ISO de data
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: env.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Soma dias a uma data AAAA-MM-DD sem esbarrar em fuso (usa UTC puro). */
function somarDias(dataISO, dias) {
  const [a, m, d] = dataISO.split('-').map(Number)
  const base = new Date(Date.UTC(a, m - 1, d))
  base.setUTCDate(base.getUTCDate() + dias)
  return base.toISOString().slice(0, 10)
}

/** "2026-08-26T14:30" -> "quarta-feira, 26 de agosto de 2026" */
function porExtenso(dataHora) {
  const [a, m, d] = dataHora.slice(0, 10).split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d, 12))
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(data)
}

/** "2026-08-26T14:30" -> "26/08/2026" */
function dataBR(dataHora) {
  const [a, m, d] = dataHora.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** "2026-08-26T14:30" -> "14:30" */
function horaBR(dataHora) {
  return dataHora.slice(11, 16)
}

module.exports = { hojeLocal, somarDias, porExtenso, dataBR, horaBR }
