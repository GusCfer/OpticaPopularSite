'use strict'

const { Router } = require('express')
const produtos = require('../services/produtos.service')
const { exigirAutenticacao } = require('../middlewares/auth')
const env = require('../config/env')
const { uploadGaleria, arquivosEnviados } = require('../middlewares/upload')

const router = Router()

// ------------------------- rotas públicas ---------------------------
router.get('/categorias', async (_req, res, next) => {
  try {
    res.json(await produtos.listarCategorias())
  } catch (err) {
    next(err)
  }
})

router.get('/produtos/destaques', async (_req, res, next) => {
  try {
    res.json(await produtos.listarDestaques())
  } catch (err) {
    next(err)
  }
})

/**
 * Vitrine da home: produtos sorteados, com foto. ?limite=14 (padrão 12, teto 24).
 * Precisa vir antes de /produtos/:id, senão "vitrine" seria lido como um id.
 */
router.get('/produtos/vitrine', async (req, res, next) => {
  try {
    res.json(await produtos.listarVitrine(req.query.limite))
  } catch (err) {
    next(err)
  }
})

/**
 * Catálogo paginado. Resposta: { itens, total, pagina, porPagina, paginas }.
 * Aceita ?pagina=2&porPagina=12&categoria=solar&busca=aviador
 */
router.get('/produtos', async (req, res, next) => {
  try {
    const publico = !req.headers.authorization
    res.json(
      await produtos.listar({
        categoria: req.query.categoria,
        busca: req.query.busca,
        pagina: req.query.pagina,
        porPagina: req.query.porPagina ?? req.query.limite,
        destaque: req.query.destaque === undefined ? undefined : req.query.destaque === 'true',
        // visitante só enxerga produto ativo
        ativo: publico ? true : req.query.ativo === undefined ? undefined : req.query.ativo === 'true',
        // o contador de destaques do painel é do catálogo todo, não da página
        contarDestaquesTambem: !publico,
      })
    )
  } catch (err) {
    next(err)
  }
})

// antes de /produtos/:id, senão "slug" seria interpretado como um id
router.get('/produtos/slug/:slug', async (req, res, next) => {
  try {
    res.json(await produtos.buscarPorSlug(req.params.slug))
  } catch (err) {
    next(err)
  }
})

router.get('/produtos/:id', async (req, res, next) => {
  try {
    res.json(await produtos.buscarPorId(Number(req.params.id)))
  } catch (err) {
    next(err)
  }
})

// ------------------------- rotas do admin ---------------------------
router.post('/produtos', exigirAutenticacao, async (req, res, next) => {
  try {
    res.status(201).json(await produtos.criar(req.body))
  } catch (err) {
    next(err)
  }
})

router.put('/produtos/:id', exigirAutenticacao, async (req, res, next) => {
  try {
    res.json(await produtos.atualizar(Number(req.params.id), req.body))
  } catch (err) {
    next(err)
  }
})

router.patch('/produtos/:id/destaque', exigirAutenticacao, async (req, res, next) => {
  try {
    res.json(await produtos.definirDestaque(Number(req.params.id), req.body.destaque === true))
  } catch (err) {
    next(err)
  }
})

router.delete('/produtos/:id', exigirAutenticacao, async (req, res, next) => {
  try {
    // o service já apaga do disco a galeria inteira
    await produtos.remover(Number(req.params.id))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

/**
 * Upload das fotos. Aceita de uma a oito por vez e devolve os caminhos, que o
 * painel envia de volta no PUT/POST do produto — o upload não altera produto
 * nenhum sozinho.
 *
 * A resposta traz "imagens" (a lista) e também "caminho"/"url" da primeira,
 * que é o formato antigo, de quando cada produto tinha uma foto só.
 */
router.post('/upload', exigirAutenticacao, uploadGaleria, (req, res, next) => {
  try {
    const arquivos = arquivosEnviados(req)
    if (arquivos.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma imagem enviada', codigo: 'SEM_ARQUIVO' })
    }

    const imagens = arquivos.map((arquivo) => {
      const caminho = `/uploads/produtos/${arquivo.filename}`
      return { caminho, url: `${env.API_PUBLIC_URL}${caminho}`, tamanho: arquivo.size }
    })

    res.status(201).json({ imagens, ...imagens[0] })
  } catch (err) {
    next(err)
  }
})

module.exports = router
