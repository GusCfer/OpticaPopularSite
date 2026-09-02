'use strict'

const jwt = require('jsonwebtoken')
const env = require('../config/env')
const { naoAutorizado, proibido } = require('../lib/erros')

/**
 * Lê e valida o Bearer token do cabeçalho.
 *
 * Devolve `{ usuario }` quando o token é legítimo, `{ erro }` quando veio um
 * token que não presta, e `{}` quando não veio nenhum. Quem chama decide o que
 * fazer com cada caso — é o que separa a rota que EXIGE login da que só se
 * comporta diferente quando há login.
 */
function lerToken(req) {
  const [tipo, token] = (req.headers.authorization || '').split(' ')
  if (tipo !== 'Bearer' || !token) return {}

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'otica-popular',
    })
    return { usuario: { id: Number(payload.sub), papel: payload.papel, nome: payload.nome } }
  } catch (err) {
    return {
      erro: err.name === 'TokenExpiredError' ? 'Sessão expirada. Faça login novamente.' : 'Token inválido',
    }
  }
}

/** Exige um Bearer token válido. Popula req.usuario. */
function exigirAutenticacao(req, _res, next) {
  const { usuario, erro } = lerToken(req)
  if (erro) return next(naoAutorizado(erro))
  if (!usuario) return next(naoAutorizado('Token de acesso ausente'))

  req.usuario = usuario
  return next()
}

/**
 * Autenticação OPCIONAL: popula req.usuario quando o token é válido e segue em
 * frente quando não é — sem recusar a requisição.
 *
 * Serve às rotas que atendem os dois públicos no mesmo endereço, como o
 * catálogo: para o visitante ele mostra só o que está ativo e esconde a
 * referência; para quem está logado no painel, mostra tudo.
 *
 * O motivo de existir é um furo concreto: antes a rota decidia com
 * `!req.headers.authorization`, ou seja, olhava se o cabeçalho ESTAVA LÁ, sem
 * conferir o conteúdo. Bastava mandar `Authorization: Bearer qualquercoisa`
 * para ser tratado como administrador e receber os produtos inativos. Aqui o
 * token é verificado de verdade; token inválido volta a ser visitante.
 */
function autenticacaoOpcional(req, _res, next) {
  const { usuario } = lerToken(req)
  if (usuario) req.usuario = usuario
  return next()
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

module.exports = { exigirAutenticacao, autenticacaoOpcional, exigirPapel }
