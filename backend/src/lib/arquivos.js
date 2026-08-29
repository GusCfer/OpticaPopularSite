'use strict'

/**
 * Utilitários de disco para as imagens dos produtos.
 *
 * Isto morava em middlewares/upload.js, mas apagar arquivo não é assunto de
 * middleware: o service também precisa, quando uma foto sai da galeria. Aqui
 * os dois importam do mesmo lugar, sem service dependendo de middleware.
 */

const fs = require('node:fs')
const path = require('node:path')
const env = require('../config/env')

/**
 * Remove do disco a imagem de um produto apagado ou substituído.
 *
 * Silencioso de propósito: arquivo que já não existe não é erro, e falhar aqui
 * não pode derrubar a operação que o usuário pediu. O que NÃO é silencioso é a
 * checagem de caminho — só apaga dentro de UPLOAD_DIR, nunca fora.
 */
function apagarImagem(caminhoRelativo) {
  if (!caminhoRelativo || !String(caminhoRelativo).startsWith('/uploads/')) return

  const alvo = path.join(env.UPLOAD_DIR, String(caminhoRelativo).replace('/uploads/', ''))
  const dentroDaPasta = path.resolve(alvo).startsWith(path.resolve(env.UPLOAD_DIR))
  if (!dentroDaPasta) return

  fs.promises.unlink(alvo).catch(() => {})
}

/** Apaga uma lista de caminhos, ignorando nulos e repetidos. */
function apagarImagens(caminhos) {
  for (const caminho of new Set((caminhos || []).filter(Boolean))) {
    apagarImagem(caminho)
  }
}

module.exports = { apagarImagem, apagarImagens }
