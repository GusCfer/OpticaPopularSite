'use strict'

const { Router } = require('express')
const consultas = require('../services/consultas.service')
const { enviarLembrete, processarLembretes } = require('../jobs/lembretes')
const { verificarConexao } = require('../lib/email')
const { exigirAutenticacao } = require('../middlewares/auth')
const env = require('../config/env')

const router = Router()

// Agenda é dado de paciente: nada aqui é público.
router.use(exigirAutenticacao)

router.get('/consultas', async (req, res, next) => {
  try {
    res.json(
      await consultas.listar({
        status: req.query.status,
        busca: req.query.busca,
        de: req.query.de,
        ate: req.query.ate,
        limite: req.query.limite,
      })
    )
  } catch (err) {
    next(err)
  }
})

router.get('/consultas/resumo', async (_req, res, next) => {
  try {
    res.json(await consultas.resumo())
  } catch (err) {
    next(err)
  }
})

router.get('/consultas/medicos', async (_req, res, next) => {
  try {
    res.json(await consultas.listarMedicos())
  } catch (err) {
    next(err)
  }
})

// Como está o envio de e-mail — o painel mostra um aviso quando falta configurar.
router.get('/consultas/email/status', (_req, res) => {
  res.json({
    configurado: env.SMTP.configurado,
    remetente: env.SMTP.configurado ? env.SMTP.user : null,
    servidor: `${env.SMTP.host}:${env.SMTP.port}`,
    agendador: env.LEMBRETES.ativo ? env.LEMBRETES.cron : null,
    fuso: env.TIMEZONE,
  })
})

// Testa usuário/senha do Gmail sem mandar mensagem nenhuma.
router.post('/consultas/email/testar', async (_req, res, next) => {
  try {
    await verificarConexao()
    res.json({ ok: true, mensagem: `Conexão com ${env.SMTP.host} funcionando como ${env.SMTP.user}.` })
  } catch (err) {
    res.status(400).json({ erro: err.message, codigo: 'SMTP_FALHOU' })
  }
})

router.get('/consultas/:id', async (req, res, next) => {
  try {
    res.json(await consultas.buscarPorId(Number(req.params.id)))
  } catch (err) {
    next(err)
  }
})

router.post('/consultas', async (req, res, next) => {
  try {
    res.status(201).json(await consultas.criar(req.body, req.usuario?.id ?? null))
  } catch (err) {
    next(err)
  }
})

router.put('/consultas/:id', async (req, res, next) => {
  try {
    res.json(await consultas.atualizar(Number(req.params.id), req.body))
  } catch (err) {
    next(err)
  }
})

router.patch('/consultas/:id/status', async (req, res, next) => {
  try {
    res.json(await consultas.definirStatus(Number(req.params.id), req.body.status))
  } catch (err) {
    next(err)
  }
})

router.delete('/consultas/:id', async (req, res, next) => {
  try {
    await consultas.remover(Number(req.params.id))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// Envia (ou reenvia) o lembrete de uma consulta na hora.
router.post('/consultas/:id/lembrete', async (req, res, next) => {
  try {
    const consulta = await consultas.buscarPorId(Number(req.params.id))
    if (consulta.status === 'CANCELADA') {
      return res.status(400).json({ erro: 'Consulta cancelada — não faz sentido avisar o paciente.', codigo: 'CANCELADA' })
    }
    const r = await enviarLembrete(consulta)
    if (!r.ok) return res.status(400).json({ erro: r.erro, codigo: 'ENVIO_FALHOU' })
    res.json(await consultas.buscarPorId(consulta.id))
  } catch (err) {
    next(err)
  }
})

// Roda a varredura do dia na mão (o cron faz isso sozinho às 08:00).
router.post('/consultas/lembretes/rodar', async (req, res, next) => {
  try {
    res.json(await processarLembretes(req.body?.dia))
  } catch (err) {
    next(err)
  }
})

module.exports = router
