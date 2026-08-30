'use strict'

/**
 * Página compartilhável do produto: /produto/<slug>
 *
 * Quem abre no navegador recebe o site normal — este arquivo devolve o mesmo
 * index.html que o Nginx serviria, e o React assume dali em diante.
 *
 * A diferença está no <head>: as meta tags Open Graph são preenchidas com a
 * foto, o nome e o preço daquele produto. É o que o WhatsApp lê para montar a
 * prévia do link. Sem isso, toda mensagem mostraria o mesmo cartão genérico do
 * site, e o robô do WhatsApp não executa JavaScript — não adianta a página
 * preencher as tags depois que o React sobe.
 */

const fs = require('node:fs')
const { Router } = require('express')

const env = require('../config/env')
const produtos = require('../services/produtos.service')

const router = Router()

/** Escapa o que vai dentro de um atributo HTML. */
function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatarPreco(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ---------------------------------------------------------------------
// index.html compilado, lido do disco e guardado em memória.
// A checagem de mtime faz um deploy novo ser percebido sem reiniciar a API.
// ---------------------------------------------------------------------
let cache = { mtime: 0, html: '' }

function lerIndex() {
  try {
    const { mtimeMs } = fs.statSync(env.SPA_INDEX)
    if (mtimeMs !== cache.mtime) {
      cache = { mtime: mtimeMs, html: fs.readFileSync(env.SPA_INDEX, 'utf8') }
    }
    return cache.html
  } catch {
    // Em desenvolvimento o site roda no Vite e não existe build no disco.
    // A prévia continua funcionando; quem abre no navegador é mandado ao site.
    return null
  }
}

/** Monta as meta tags do produto e as injeta no <head>. */
function comMetaTags(html, produto) {
  const titulo = produto.marca ? `${produto.nome} — ${produto.marca}` : produto.nome
  const preco = formatarPreco(produto.precoPromocional ?? produto.preco)
  const descricao = produto.descricao
    ? `${preco} · ${produto.descricao}`
    : `${preco} · ${produto.categoria?.nome ?? 'Óptica Popular'}`
  const url = `${env.API_PUBLIC_URL}/produto/${produto.slug}`

  const tags = [
    `<title>${escapar(titulo)} · Óptica Popular</title>`,
    `<meta name="description" content="${escapar(descricao)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Óptica Popular" />`,
    `<meta property="og:title" content="${escapar(titulo)}" />`,
    `<meta property="og:description" content="${escapar(descricao)}" />`,
    `<meta property="og:url" content="${escapar(url)}" />`,
    produto.imagemUrl ? `<meta property="og:image" content="${escapar(produto.imagemUrl)}" />` : '',
    produto.imagemUrl ? `<meta name="twitter:card" content="summary_large_image" />` : '',
  ]
    .filter(Boolean)
    .join('\n    ')

  // O título e a descrição genéricos do site precisam SAIR, não conviver com os
  // do produto: com duas tags iguais no head, o robô lê a primeira que achar —
  // que seria justamente a genérica.
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace('</head>', `  ${tags}\n</head>`)
}

/** Sem build no disco: página mínima, só com as tags, que redireciona. */
function paginaMinima(produto) {
  const url = `${env.API_PUBLIC_URL}/produtos`
  return comMetaTags(
    `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8" />` +
      `<meta http-equiv="refresh" content="0; url=${escapar(url)}" /><title>x</title></head>` +
      `<body><p>Abrindo o catálogo…</p></body></html>`,
    produto
  )
}

router.get('/produto/:slug', async (req, res, next) => {
  try {
    const produto = await produtos.buscarPorSlug(req.params.slug)
    const html = lerIndex()

    // sem cache-control longo: o preço e a foto mudam, e a prévia do WhatsApp
    // ficaria congelada com a versão antiga
    res.set('Cache-Control', 'public, max-age=300')
    res.type('html').send(html ? comMetaTags(html, produto) : paginaMinima(produto))
  } catch (err) {
    // Produto inexistente não é erro de servidor: entrega o site, e o React
    // mostra "não encontrado" com o catálogo a um clique.
    if (err.status === 404) {
      const html = lerIndex()
      if (html) return res.type('html').send(html)
      return res.redirect(`${env.API_PUBLIC_URL}/produtos`)
    }
    next(err)
  }
})

module.exports = router
