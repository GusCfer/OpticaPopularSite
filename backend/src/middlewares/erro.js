'use strict'

const { ZodError } = require('zod')
const multer = require('multer')
const { ErroApp } = require('../lib/erros')
const env = require('../config/env')

function naoEncontrado(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` })
}

// eslint-disable-next-line no-unused-vars
function tratadorDeErros(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: 'Dados inválidos',
      codigo: 'VALIDACAO',
      detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    })
  }

  if (err instanceof ErroApp) {
    return res.status(err.status).json({ erro: err.message, codigo: err.codigo })
  }

  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Imagem muito grande (máximo ${Math.round(env.UPLOAD_MAX_BYTES / 1024 / 1024)} MB)`
        : 'Falha no upload da imagem'
    return res.status(400).json({ erro: msg, codigo: err.code })
  }

  // Violação de trigger/constraint do Postgres
  if (err.code === '23514' && /LIMITE_DESTAQUES/.test(err.message || '')) {
    return res.status(409).json({
      erro: `Limite de ${env.MAX_DESTAQUES} produtos em destaque atingido. Desmarque um antes de marcar outro.`,
      codigo: 'LIMITE_DESTAQUES',
    })
  }
  if (err.code === '23505') {
    return res.status(409).json({ erro: 'Já existe um registro com esses dados', codigo: 'DUPLICADO' })
  }
  if (err.code === '23503') {
    return res.status(409).json({ erro: 'Registro em uso por outro cadastro', codigo: 'FK_EM_USO' })
  }

  console.error('[erro]', err)
  return res.status(500).json({
    erro: 'Erro interno no servidor',
    ...(env.producao ? {} : { detalhe: err.message }),
  })
}

module.exports = { naoEncontrado, tratadorDeErros }
