'use strict'

const { z } = require('zod')
const db = require('../lib/db')
const { naoEncontrado, requisicaoInvalida } = require('../lib/erros')
const { hojeLocal, somarDias } = require('../lib/datas')

const STATUS = ['AGENDADA', 'REALIZADA', 'CANCELADA']

// "2026-08-26T14:30" ou "2026-08-26T14:30:00" (o que o input datetime-local manda)
const dataHoraLocal = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Informe data e horário válidos')
  .transform((v) => v.slice(0, 16))
  .refine((v) => !Number.isNaN(Date.parse(`${v}:00`)), 'Data ou horário inexistente')

const consultaSchema = z.object({
  pacienteNome: z.string().trim().min(3, 'Nome do paciente muito curto').max(120),
  pacienteEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail do paciente inválido')
    .max(160),
  pacienteTelefone: z.string().trim().max(30).optional().or(z.literal('')),
  medicoNome: z.string().trim().min(3, 'Nome do médico muito curto').max(120),
  dataHora: dataHoraLocal,
  observacoes: z.string().trim().max(2000).optional().or(z.literal('')),
  status: z.enum(STATUS).default('AGENDADA'),
})

// data_hora vira texto aqui: assim nem o driver nem o fuso do servidor
// conseguem deslocar o horário que a atendente digitou.
const SELECT_CONSULTA = `
  SELECT c.id,
         c.paciente_nome      AS "pacienteNome",
         c.paciente_email     AS "pacienteEmail",
         c.paciente_telefone  AS "pacienteTelefone",
         c.medico_nome        AS "medicoNome",
         to_char(c.data_hora, 'YYYY-MM-DD"T"HH24:MI') AS "dataHora",
         c.observacoes,
         c.status,
         c.lembrete_enviado_em AS "lembreteEnviadoEm",
         c.lembrete_erro       AS "lembreteErro",
         c.criado_em           AS "criadoEm",
         c.atualizado_em       AS "atualizadoEm"
    FROM consultas c
`

async function listar({ status, busca, de, ate, limite = 200 } = {}) {
  const where = []
  const params = []

  if (status) {
    params.push(status)
    where.push(`c.status = $${params.length}`)
  }
  if (busca) {
    params.push(`%${busca}%`)
    where.push(
      `(c.paciente_nome ILIKE $${params.length} OR c.medico_nome ILIKE $${params.length} OR c.paciente_email ILIKE $${params.length})`
    )
  }
  if (de) {
    params.push(de)
    where.push(`c.data_hora >= $${params.length}::date`)
  }
  if (ate) {
    params.push(ate)
    where.push(`c.data_hora < ($${params.length}::date + INTERVAL '1 day')`)
  }

  params.push(Math.min(Number(limite) || 200, 500))

  const { rows } = await db.query(
    `${SELECT_CONSULTA}
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY c.data_hora DESC
     LIMIT $${params.length}`,
    params
  )
  return rows
}

async function buscarPorId(id) {
  const { rows } = await db.query(`${SELECT_CONSULTA} WHERE c.id = $1`, [id])
  if (!rows[0]) throw naoEncontrado('Consulta não encontrada')
  return rows[0]
}

/** As consultas de amanhã que ainda não receberam lembrete. */
async function pendentesDeLembrete(dataAlvo) {
  const dia = dataAlvo || somarDias(hojeLocal(), 1)
  const { rows } = await db.query(
    `${SELECT_CONSULTA}
      WHERE c.status = 'AGENDADA'
        AND c.lembrete_enviado_em IS NULL
        AND c.data_hora >= $1::date
        AND c.data_hora <  ($1::date + INTERVAL '1 day')
      ORDER BY c.data_hora`,
    [dia]
  )
  return rows
}

async function criar(dados, usuarioId = null) {
  const d = consultaSchema.parse(dados)
  recusarPassado(d.dataHora, dados.id)

  const { rows } = await db.query(
    `INSERT INTO consultas
       (paciente_nome, paciente_email, paciente_telefone, medico_nome,
        data_hora, observacoes, status, criado_por)
     VALUES ($1,$2,$3,$4,$5::timestamp,$6,$7,$8)
     RETURNING id`,
    [
      d.pacienteNome,
      d.pacienteEmail,
      vazioParaNull(d.pacienteTelefone),
      d.medicoNome,
      d.dataHora,
      vazioParaNull(d.observacoes),
      d.status,
      usuarioId,
    ]
  )
  return buscarPorId(rows[0].id)
}

async function atualizar(id, dados) {
  const atual = await buscarPorId(id)
  const d = consultaSchema.parse({
    pacienteNome: dados.pacienteNome ?? atual.pacienteNome,
    pacienteEmail: dados.pacienteEmail ?? atual.pacienteEmail,
    pacienteTelefone: dados.pacienteTelefone ?? atual.pacienteTelefone ?? '',
    medicoNome: dados.medicoNome ?? atual.medicoNome,
    dataHora: dados.dataHora ?? atual.dataHora,
    observacoes: dados.observacoes ?? atual.observacoes ?? '',
    status: dados.status ?? atual.status,
  })

  // Remarcou ou trocou o e-mail? O lembrete volta pra fila, senão o paciente
  // seria avisado do horário antigo — ou não seria avisado.
  const remarcou = d.dataHora !== atual.dataHora || d.pacienteEmail !== atual.pacienteEmail
  if (remarcou) recusarPassado(d.dataHora)

  await db.query(
    `UPDATE consultas SET
        paciente_nome = $1, paciente_email = $2, paciente_telefone = $3,
        medico_nome = $4, data_hora = $5::timestamp, observacoes = $6, status = $7
        ${remarcou ? ', lembrete_enviado_em = NULL, lembrete_erro = NULL' : ''}
      WHERE id = $8`,
    [
      d.pacienteNome,
      d.pacienteEmail,
      vazioParaNull(d.pacienteTelefone),
      d.medicoNome,
      d.dataHora,
      vazioParaNull(d.observacoes),
      d.status,
      id,
    ]
  )
  return buscarPorId(id)
}

async function definirStatus(id, status) {
  if (!STATUS.includes(status)) throw requisicaoInvalida('Status inválido', 'STATUS_INVALIDO')
  const { rowCount } = await db.query('UPDATE consultas SET status = $1 WHERE id = $2', [status, id])
  if (rowCount === 0) throw naoEncontrado('Consulta não encontrada')
  return buscarPorId(id)
}

async function remover(id) {
  const { rowCount } = await db.query('DELETE FROM consultas WHERE id = $1', [id])
  if (rowCount === 0) throw naoEncontrado('Consulta não encontrada')
}

async function marcarLembreteEnviado(id) {
  await db.query(
    'UPDATE consultas SET lembrete_enviado_em = NOW(), lembrete_erro = NULL WHERE id = $1',
    [id]
  )
}

async function marcarLembreteComErro(id, mensagem) {
  await db.query('UPDATE consultas SET lembrete_erro = $1 WHERE id = $2', [
    String(mensagem).slice(0, 500),
    id,
  ])
}

/** Nomes de médicos já usados — alimenta o autocomplete do formulário. */
async function listarMedicos() {
  const { rows } = await db.query(
    `SELECT medico_nome AS nome, COUNT(*)::int AS total
       FROM consultas
      GROUP BY medico_nome
      ORDER BY total DESC, medico_nome`
  )
  return rows
}

async function resumo() {
  const hoje = hojeLocal()
  const { rows } = await db.query(
    `SELECT
        COUNT(*) FILTER (WHERE status = 'AGENDADA' AND data_hora >= $1::date)                    ::int AS "proximas",
        COUNT(*) FILTER (WHERE status = 'AGENDADA' AND data_hora >= $1::date
                          AND data_hora < ($1::date + INTERVAL '1 day'))                          ::int AS "hoje",
        COUNT(*) FILTER (WHERE status = 'AGENDADA' AND data_hora >= ($1::date + INTERVAL '1 day')
                          AND data_hora < ($1::date + INTERVAL '2 day'))                          ::int AS "amanha",
        COUNT(*) FILTER (WHERE lembrete_erro IS NOT NULL)                                         ::int AS "comErro"
       FROM consultas`,
    [hoje]
  )
  return rows[0]
}

// ---------- auxiliares ----------
function vazioParaNull(v) {
  return v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim()
}

/** Agendar para ontem quase sempre é erro de digitação — e o lembrete nunca sairia. */
function recusarPassado(dataHora) {
  const hoje = hojeLocal()
  if (dataHora.slice(0, 10) < hoje) {
    throw requisicaoInvalida('A consulta não pode ser marcada para uma data que já passou', 'DATA_PASSADA')
  }
}

module.exports = {
  STATUS,
  listar,
  buscarPorId,
  criar,
  atualizar,
  definirStatus,
  remover,
  pendentesDeLembrete,
  marcarLembreteEnviado,
  marcarLembreteComErro,
  listarMedicos,
  resumo,
}
