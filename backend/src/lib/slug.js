'use strict'

/** "Óculos Ray-Ban Aviador" -> "oculos-ray-ban-aviador" */
function gerarSlug(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 130)
}

module.exports = { gerarSlug }
