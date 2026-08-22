'use strict'

/** Erro de negócio previsto — vira resposta HTTP limpa, sem vazar stack. */
class ErroApp extends Error {
  constructor(status, mensagem, codigo = null) {
    super(mensagem)
    this.name = 'ErroApp'
    this.status = status
    this.codigo = codigo
  }
}

const naoEncontrado = (msg = 'Recurso não encontrado') => new ErroApp(404, msg, 'NAO_ENCONTRADO')
const requisicaoInvalida = (msg, codigo) => new ErroApp(400, msg, codigo || 'REQUISICAO_INVALIDA')
const naoAutorizado = (msg = 'Não autorizado') => new ErroApp(401, msg, 'NAO_AUTORIZADO')
const proibido = (msg = 'Acesso negado') => new ErroApp(403, msg, 'PROIBIDO')
const conflito = (msg, codigo) => new ErroApp(409, msg, codigo || 'CONFLITO')

module.exports = { ErroApp, naoEncontrado, requisicaoInvalida, naoAutorizado, proibido, conflito }
