'use strict'

const { Router } = require('express')
const produtos = require('../services/produtos.service')
const { exigirAutenticacao } = require('../middlewares/auth')
const { upload, apagarImagem } = require('../middlewares/upload')

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

router.get('/produtos', async (req, res, next) => {
  try {
    const publico = !req.headers.authorization
    res.json(
      await produtos.listar({
        categoria: req.query.categoria,
        busca: req.query.busca,
        limite: req.query.limite,
        destaque: req.query.destaque === undefined ? undefined : req.query.destaque === 'true',
        // visitante só enxerga produto ativo
        ativo: publico ? true : req.query.ativo === undefined ? undefined : req.query.ativo === 'true',
      })
    )
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
    const { imagemUrl } = await produtos.remover(Number(req.params.id))
    apagarImagem(imagemUrl)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// Upload da imagem: devolve a URL pra ser salva junto com o produto.
router.post('/upload', exigirAutenticacao, upload.single('imagem'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhuma imagem enviada', codigo: 'SEM_ARQUIVO' })
    const caminho = `/uploads/produtos/${req.file.filename}`
    res.status(201).json({
      caminho,
      url: `${require('../config/env').API_PUBLIC_URL}${caminho}`,
      tamanho: req.file.size,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
