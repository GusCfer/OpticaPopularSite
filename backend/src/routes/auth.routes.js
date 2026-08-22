'use strict'

const { Router } = require('express')
const rateLimit = require('express-rate-limit')

const usuarios = require('../services/usuarios.service')
const { exigirAutenticacao, exigirPapel } = require('../middlewares/auth')

const router = Router()

// Freio contra força bruta no login (além do bloqueio por usuário no banco).
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.', codigo: 'RATE_LIMIT' },
})

router.post('/login', limiteLogin, async (req, res, next) => {
  try {
    res.json(await usuarios.autenticar(req.body))
  } catch (err) {
    next(err)
  }
})

router.get('/eu', exigirAutenticacao, async (req, res, next) => {
  try {
    res.json(await usuarios.buscarPorId(req.usuario.id))
  } catch (err) {
    next(err)
  }
})

router.post('/senha', exigirAutenticacao, async (req, res, next) => {
  try {
    res.json(await usuarios.alterarSenha(req.usuario.id, req.body.senhaAtual, req.body.senhaNova))
  } catch (err) {
    next(err)
  }
})

// Só ADMIN cria e lista usuários — não existe cadastro aberto ao público.
router.get('/usuarios', exigirAutenticacao, exigirPapel('ADMIN'), async (_req, res, next) => {
  try {
    res.json(await usuarios.listar())
  } catch (err) {
    next(err)
  }
})

router.post('/usuarios', exigirAutenticacao, exigirPapel('ADMIN'), async (req, res, next) => {
  try {
    res.status(201).json(await usuarios.criarUsuario(req.body))
  } catch (err) {
    next(err)
  }
})

module.exports = router
