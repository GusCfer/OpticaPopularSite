'use strict'

const { z } = require('zod')
const db = require('../lib/db')
const env = require('../config/env')
const { gerarSlug } = require('../lib/slug')
const { naoEncontrado, requisicaoInvalida, conflito } = require('../lib/erros')
const { apagarImagens } = require('../lib/arquivos')

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
  imagens: z
    .array(z.string().trim().max(255))
    .max(env.MAX_IMAGENS_PRODUTO, `No máximo ${env.MAX_IMAGENS_PRODUTO} imagens por produto`)
    .optional(),
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
         json_build_object('id', c.id, 'slug', c.slug, 'nome', c.nome) AS categoria,
         -- galeria na ordem definida no painel; [] quando ainda não tem foto
         COALESCE((
           SELECT json_agg(i.caminho ORDER BY i.ordem, i.id)
             FROM produto_imagens i
            WHERE i.produto_id = p.id
         ), '[]'::json) AS imagens
    FROM produtos p
    JOIN categorias c ON c.id = p.categoria_id
`

/** Converte o caminho salvo no banco em URL absoluta pro frontend. */
function paraUrlAbsoluta(caminho) {
  if (!caminho || !String(caminho).startsWith('/uploads/')) return caminho
  return `${env.API_PUBLIC_URL}${caminho}`
}

function comUrlAbsoluta(produto) {
  if (!produto) return produto
  produto.imagemUrl = paraUrlAbsoluta(produto.imagemUrl)
  produto.imagens = (produto.imagens || []).map(paraUrlAbsoluta)
  return produto
}

/**
 * A galeria é a fonte da verdade; imagem_url é só a capa (a primeira delas).
 *
 * Uma requisição no formato antigo, que manda apenas imagemUrl, é lida como
 * uma galeria de uma foto — nada que já chamava a API precisa mudar. Quando
 * nem imagens nem imagemUrl vêm, a galeria atual é preservada.
 */
function normalizarGaleria(dados, anteriores = []) {
  let bruta
  if (Array.isArray(dados.imagens)) bruta = dados.imagens
  else if (dados.imagemUrl !== undefined) bruta = [dados.imagemUrl]
  else bruta = anteriores

  const caminhos = []
  for (const item of bruta) {
    const caminho = paraCaminhoRelativo(item)
    // ignora vazios e repetidos: a mesma foto duas vezes não faz sentido
    if (caminho && !caminhos.includes(caminho)) caminhos.push(caminho)
  }
  return caminhos.slice(0, env.MAX_IMAGENS_PRODUTO)
}

/** Regrava a galeria inteira, numerando a ordem a partir de zero. */
async function salvarGaleria(client, produtoId, caminhos) {
  await client.query('DELETE FROM produto_imagens WHERE produto_id = $1', [produtoId])
  for (let i = 0; i < caminhos.length; i += 1) {
    await client.query(
      'INSERT INTO produto_imagens (produto_id, caminho, ordem) VALUES ($1, $2, $3)',
      [produtoId, caminhos[i], i]
    )
  }
}

/**
 * Monta o WHERE dos filtros uma vez só: a contagem e a página de resultados
 * precisam usar exatamente o mesmo critério, senão o total não bate com o que
 * aparece na tela.
 */
function montarFiltros({ categoria, destaque, ativo, busca }) {
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

  return { clausula: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

/**
 * Lista paginada.
 *
 * Devolve um objeto, não um array: com paginação o cliente precisa saber
 * quantos existem no total para desenhar a navegação. Só a página pedida
 * trafega, então o catálogo aguenta centenas de produtos sem o celular baixar
 * todas as fotos de uma vez.
 *
 * @returns {Promise<{itens: object[], total: number, pagina: number, porPagina: number, paginas: number, destaquesUsados?: number}>}
 */
async function listar({
  categoria,
  destaque,
  ativo,
  busca,
  pagina = 1,
  porPagina = env.PRODUTOS_POR_PAGINA,
  contarDestaquesTambem = false,
} = {}) {
  const { clausula, params } = montarFiltros({ categoria, destaque, ativo, busca })

  const porPaginaLimpo = Math.min(Math.max(Number(porPagina) || env.PRODUTOS_POR_PAGINA, 1), 60)

  const { rows: contagem } = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM produtos p
       JOIN categorias c ON c.id = p.categoria_id
       ${clausula}`,
    params
  )
  const total = contagem[0].total
  const paginas = Math.max(1, Math.ceil(total / porPaginaLimpo))

  // pedir a página 9 de um catálogo com 3 traz a última, não uma tela vazia
  const paginaLimpa = Math.min(Math.max(Number(pagina) || 1, 1), paginas)
  const deslocamento = (paginaLimpa - 1) * porPaginaLimpo

  const paramsPagina = [...params, porPaginaLimpo, deslocamento]
  const { rows } = await db.query(
    `${SELECT_PRODUTO}
     ${clausula}
     ORDER BY p.destaque DESC, p.ordem_destaque NULLS LAST, p.criado_em DESC
     LIMIT $${paramsPagina.length - 1} OFFSET $${paramsPagina.length}`,
    paramsPagina
  )

  const resposta = {
    itens: rows.map(comUrlAbsoluta),
    total,
    pagina: paginaLimpa,
    porPagina: porPaginaLimpo,
    paginas,
  }

  // o painel precisa do total de destaques do catálogo inteiro, não só da
  // página aberta — senão o contador "3/5" mentiria ao virar de página
  if (contarDestaquesTambem) resposta.destaquesUsados = await contarDestaques()

  return resposta
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
  const galeria = normalizarGaleria(dados)

  // produto e galeria juntos: ou entram os dois, ou não entra nenhum
  const id = await db.transacao(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO produtos
         (nome, slug, descricao, marca, preco, preco_promocional, imagem_url, ativo, destaque, ordem_destaque, categoria_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        d.nome, slug, vazioParaNull(d.descricao), vazioParaNull(d.marca),
        d.preco, d.precoPromocional ?? null, galeria[0] ?? null,
        d.ativo, d.destaque, ordemDestaque, d.categoriaId,
      ]
    )
    await salvarGaleria(client, rows[0].id, galeria)
    return rows[0].id
  })

  return buscarPorId(id)
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

  // buscarPorId devolve URL absoluta; no banco guardamos o caminho relativo
  const anteriores = (atual.imagens || []).map(paraCaminhoRelativo).filter(Boolean)
  const galeria = normalizarGaleria(dados, anteriores)
  validarPromocional(d)
  await garantirCategoria(d.categoriaId)

  const slug = d.nome !== atual.nome ? await slugUnico(gerarSlug(d.nome), id) : atual.slug

  let ordemDestaque = atual.ordemDestaque
  if (d.destaque && !atual.destaque) ordemDestaque = (await contarDestaques()) + 1
  if (!d.destaque) ordemDestaque = null

  await db.transacao(async (client) => {
    await client.query(
      `UPDATE produtos SET
          nome = $1, slug = $2, descricao = $3, marca = $4, preco = $5,
          preco_promocional = $6, imagem_url = $7, ativo = $8, destaque = $9,
          ordem_destaque = $10, categoria_id = $11
        WHERE id = $12`,
      [
        d.nome, slug, vazioParaNull(d.descricao), vazioParaNull(d.marca), d.preco,
        // a capa é sempre a primeira da galeria (a trigger do banco também garante)
        d.precoPromocional ?? null, galeria[0] ?? null, d.ativo, d.destaque,
        ordemDestaque, d.categoriaId, id,
      ]
    )
    await salvarGaleria(client, id, galeria)
  })

  // Só depois do commit: foto que saiu da galeria não tem mais dono e some do
  // disco. Se fosse antes e a transação falhasse, o arquivo teria ido embora
  // com o registro ainda apontando para ele.
  apagarImagens(anteriores.filter((caminho) => !galeria.includes(caminho)))

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
  // lê a galeria ANTES: o ON DELETE CASCADE leva essas linhas junto
  const galeria = await db.query('SELECT caminho FROM produto_imagens WHERE produto_id = $1', [id])

  const { rows } = await db.query('DELETE FROM produtos WHERE id = $1 RETURNING imagem_url', [id])
  if (rows.length === 0) throw naoEncontrado('Produto não encontrado')

  const caminhos = [rows[0].imagem_url, ...galeria.rows.map((r) => r.caminho)].filter(Boolean)
  apagarImagens(caminhos)
  return { imagensRemovidas: [...new Set(caminhos)] }
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
