'use strict'

const { z } = require('zod')
const db = require('../lib/db')
const env = require('../config/env')
const { gerarSlug } = require('../lib/slug')
const { naoEncontrado, requisicaoInvalida, conflito } = require('../lib/erros')

const numeroBR = z.preprocess((v) => {
  if (typeof v === 'string') {
    // aceita "1.299,90" e "1299.90"
    const limpo = v.trim().replace(/\./g, '').replace(',', '.')
    return limpo === '' ? undefined : Number(limpo)
  }
  return v
}, z.number())

const booleano = z.preprocess((v) => {
  if (typeof v === 'string') return v === 'true' || v === '1' || v === 'on'
  return v
}, z.boolean())

const produtoSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(120),
  descricao: z.string().trim().max(4000).optional().or(z.literal('')),
  marca: z.string().trim().max(80).optional().or(z.literal('')),
  preco: numeroBR.refine((n) => n >= 0, 'Preço não pode ser negativo'),
  precoPromocional: numeroBR.optional().nullable(),
  categoriaId: z.coerce.number().int().positive('Selecione uma categoria'),
  ativo: booleano.default(true),
  destaque: booleano.default(false),
  imagemUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
})

const SELECT_PRODUTO = `
  SELECT p.id, p.nome, p.slug, p.descricao, p.marca,
         p.preco::float8            AS preco,
         p.preco_promocional::float8 AS "precoPromocional",
         p.imagem_url  AS "imagemUrl",
         p.ativo, p.destaque,
         p.ordem_destaque AS "ordemDestaque",
         p.categoria_id   AS "categoriaId",
         p.criado_em      AS "criadoEm",
         p.atualizado_em  AS "atualizadoEm",
         json_build_object('id', c.id, 'slug', c.slug, 'nome', c.nome) AS categoria
    FROM produtos p
    JOIN categorias c ON c.id = p.categoria_id
`

/** Converte o caminho salvo no banco em URL absoluta pro frontend. */
function comUrlAbsoluta(produto) {
  if (!produto) return produto
  if (produto.imagemUrl && produto.imagemUrl.startsWith('/uploads/')) {
    produto.imagemUrl = `${env.API_PUBLIC_URL}${produto.imagemUrl}`
  }
  return produto
}

async function listar({ categoria, destaque, ativo, busca, limite = 100 } = {}) {
  const where = []
  const params = []

  if (categoria) {
    params.push(categoria)
    where.push(`c.slug = $${params.length}`)
  }
  if (destaque !== undefined) {
    params.push(destaque)
    where.push(`p.destaque = $${params.length}`)
  }
  if (ativo !== undefined) {
    params.push(ativo)
    where.push(`p.ativo = $${params.length}`)
  }
  if (busca) {
    params.push(`%${busca}%`)
    where.push(`(p.nome ILIKE $${params.length} OR p.marca ILIKE $${params.length})`)
  }

  params.push(Math.min(Number(limite) || 100, 200))

  const sql = `
    ${SELECT_PRODUTO}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.destaque DESC, p.ordem_destaque NULLS LAST, p.criado_em DESC
    LIMIT $${params.length}
  `
  const { rows } = await db.query(sql, params)
  return rows.map(comUrlAbsoluta)
}

async function listarDestaques() {
  const { rows } = await db.query(
    `${SELECT_PRODUTO}
     WHERE p.destaque = TRUE AND p.ativo = TRUE
     ORDER BY p.ordem_destaque NULLS LAST, p.criado_em DESC
     LIMIT $1`,
    [env.MAX_DESTAQUES]
  )
  return rows.map(comUrlAbsoluta)
}

async function buscarPorId(id) {
  const { rows } = await db.query(`${SELECT_PRODUTO} WHERE p.id = $1`, [id])
  if (!rows[0]) throw naoEncontrado('Produto não encontrado')
  return comUrlAbsoluta(rows[0])
}

async function contarDestaques() {
  const { rows } = await db.query('SELECT COUNT(*)::int AS total FROM produtos WHERE destaque = TRUE')
  return rows[0].total
}

async function slugUnico(base, ignorarId = null) {
  let slug = base || 'produto'
  let n = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await db.query(
      'SELECT id FROM produtos WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)',
      [slug, ignorarId]
    )
    if (rows.length === 0) return slug
    n += 1
    slug = `${base}-${n}`
  }
}

async function criar(dados) {
  const d = produtoSchema.parse(dados)
  validarPromocional(d)
  await garantirCategoria(d.categoriaId)

  const slug = await slugUnico(gerarSlug(d.nome))
  const ordemDestaque = d.destaque ? (await contarDestaques()) + 1 : null

  const { rows } = await db.query(
    `INSERT INTO produtos
       (nome, slug, descricao, marca, preco, preco_promocional, imagem_url, ativo, destaque, ordem_destaque, categoria_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      d.nome, slug, vazioParaNull(d.descricao), vazioParaNull(d.marca),
      d.preco, d.precoPromocional ?? null, paraCaminhoRelativo(d.imagemUrl),
      d.ativo, d.destaque, ordemDestaque, d.categoriaId,
    ]
  )
  return buscarPorId(rows[0].id)
}

async function atualizar(id, dados) {
  const atual = await buscarPorId(id)
  const d = produtoSchema.parse({
    nome: dados.nome ?? atual.nome,
    descricao: dados.descricao ?? atual.descricao ?? '',
    marca: dados.marca ?? atual.marca ?? '',
    preco: dados.preco ?? atual.preco,
    precoPromocional: dados.precoPromocional ?? atual.precoPromocional,
    categoriaId: dados.categoriaId ?? atual.categoriaId,
    ativo: dados.ativo ?? atual.ativo,
    destaque: dados.destaque ?? atual.destaque,
    imagemUrl: dados.imagemUrl ?? atual.imagemUrl ?? '',
  })
  validarPromocional(d)
  await garantirCategoria(d.categoriaId)

  const slug = d.nome !== atual.nome ? await slugUnico(gerarSlug(d.nome), id) : atual.slug

  let ordemDestaque = atual.ordemDestaque
  if (d.destaque && !atual.destaque) ordemDestaque = (await contarDestaques()) + 1
  if (!d.destaque) ordemDestaque = null

  // guarda o caminho relativo, não a URL absoluta que devolvemos ao front
  const imagem = paraCaminhoRelativo(d.imagemUrl)

  await db.query(
    `UPDATE produtos SET
        nome = $1, slug = $2, descricao = $3, marca = $4, preco = $5,
        preco_promocional = $6, imagem_url = $7, ativo = $8, destaque = $9,
        ordem_destaque = $10, categoria_id = $11
      WHERE id = $12`,
    [
      d.nome, slug, vazioParaNull(d.descricao), vazioParaNull(d.marca), d.preco,
      d.precoPromocional ?? null, imagem, d.ativo, d.destaque, ordemDestaque, d.categoriaId, id,
    ]
  )
  return buscarPorId(id)
}

/** Liga/desliga o destaque respeitando o limite de 5. */
async function definirDestaque(id, destaque) {
  const produto = await buscarPorId(id)

  if (destaque && !produto.destaque) {
    const total = await contarDestaques()
    if (total >= env.MAX_DESTAQUES) {
      throw conflito(
        `Limite de ${env.MAX_DESTAQUES} produtos em destaque atingido. Desmarque um antes de marcar outro.`,
        'LIMITE_DESTAQUES'
      )
    }
    await db.query('UPDATE produtos SET destaque = TRUE, ordem_destaque = $1 WHERE id = $2', [total + 1, id])
  } else if (!destaque) {
    await db.query('UPDATE produtos SET destaque = FALSE, ordem_destaque = NULL WHERE id = $1', [id])
  }
  return buscarPorId(id)
}

async function remover(id) {
  const { rows } = await db.query('DELETE FROM produtos WHERE id = $1 RETURNING imagem_url', [id])
  if (rows.length === 0) throw naoEncontrado('Produto não encontrado')
  return { imagemUrl: rows[0].imagem_url }
}

// ---------- auxiliares ----------
function vazioParaNull(v) {
  return v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim()
}

function paraCaminhoRelativo(url) {
  const v = vazioParaNull(url)
  if (!v) return null
  return v.startsWith(env.API_PUBLIC_URL) ? v.slice(env.API_PUBLIC_URL.length) : v
}

function validarPromocional(d) {
  if (d.precoPromocional !== undefined && d.precoPromocional !== null) {
    if (d.precoPromocional < 0) throw requisicaoInvalida('Preço promocional não pode ser negativo')
    if (d.precoPromocional >= d.preco) {
      throw requisicaoInvalida('O preço promocional precisa ser menor que o preço normal')
    }
  }
}

async function garantirCategoria(categoriaId) {
  const { rows } = await db.query('SELECT id FROM categorias WHERE id = $1', [categoriaId])
  if (rows.length === 0) throw requisicaoInvalida('Categoria inexistente', 'CATEGORIA_INVALIDA')
}

async function listarCategorias() {
  const { rows } = await db.query(
    `SELECT c.id, c.slug, c.nome, c.descricao, c.ordem,
            COUNT(p.id)::int AS "totalProdutos"
       FROM categorias c
       LEFT JOIN produtos p ON p.categoria_id = c.id
      GROUP BY c.id
      ORDER BY c.ordem, c.nome`
  )
  return rows
}

module.exports = {
  listar, listarDestaques, buscarPorId, criar, atualizar, definirDestaque,
  remover, contarDestaques, listarCategorias, paraCaminhoRelativo,
}
