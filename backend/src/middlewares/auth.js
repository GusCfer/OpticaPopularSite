'use strict'

const jwt = require('jsonwebtoken')
const env = require('../config/env')
const { naoAutorizado, proibido } = require('../lib/erros')

/** Exige um Bearer token válido. Popula req.usuario. */
function exigirAutenticacao(req, _res, next) {
  const header = req.headers.authorization || ''
  const [tipo, token] = header.split(' ')

  if (tipo !== 'Bearer' || !token) {
    return next(naoAutorizado('Token de acesso ausente'))
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'otica-popular',
    })
    req.usuario = { id: Number(payload.sub), papel: payload.papel, nome: payload.nome }
    return next()
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Sessão expirada. Faça login novamente.' : 'Token inválido'
    return next(naoAutorizado(msg))
  }
}

/** Restringe a rota a determinados papéis. Use depois de exigirAutenticacao. */
function exigirPapel(...papeis) {
  return (req, _res, next) => {
    if (!req.usuario) return next(naoAutorizado())
    if (!papeis.includes(req.usuario.papel)) {
      return next(proibido('Seu usuário não tem permissão para esta ação'))
    }
    return next()
  }
}

module.exports = { exigirAutenticacao, exigirPapel }
