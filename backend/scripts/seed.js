#!/usr/bin/env node
'use strict'

/** Popula o catálogo com produtos de exemplo (opcional): npm run seed */

const db = require('../src/lib/db')
const produtos = require('../src/services/produtos.service')

const EXEMPLOS = [
  { nome: 'Armação Acetato Quadrada Preta', categoria: 'oculos',  marca: 'Óptica Popular', preco: 249.9,  destaque: true,  descricao: 'Armação leve em acetato, formato quadrado, ideal para rostos ovais.' },
  { nome: 'Armação Metal Redonda Dourada',  categoria: 'oculos',  marca: 'Óptica Popular', preco: 289.9,  destaque: true,  descricao: 'Clássica armação redonda em metal dourado.' },
  { nome: 'Óculos de Sol Aviador Polarizado', categoria: 'solar', marca: 'Sun Line',       preco: 349.9,  precoPromocional: 299.9, destaque: true, descricao: 'Lentes polarizadas com proteção UV400.' },
  { nome: 'Relógio Analógico Aço Prata',    categoria: 'relogio', marca: 'Timeless',       preco: 459.9,  destaque: true,  descricao: 'Pulseira em aço inoxidável, resistente à água 30m.' },
  { nome: 'Corrente Prata 925 com Pingente', categoria: 'joia',   marca: 'Prata Fina',     preco: 189.9,  destaque: true,  descricao: 'Prata 925 legítima com pingente delicado.' },
  { nome: 'Óculos de Sol Gatinho Tartaruga', categoria: 'solar',  marca: 'Sun Line',       preco: 279.9,  destaque: false, descricao: 'Modelo gatinho em padronagem tartaruga.' },
  { nome: 'Relógio Digital Esportivo',      categoria: 'relogio', marca: 'Timeless',       preco: 219.9,  destaque: false, descricao: 'Cronômetro, alarme e luz de fundo.' },
  { nome: 'Anel Solitário Prata 925',       categoria: 'joia',    marca: 'Prata Fina',     preco: 149.9,  destaque: false, descricao: 'Acabamento polido com zircônia central.' },
]

async function main() {
  const { rows } = await db.query('SELECT id, slug FROM categorias')
  const porSlug = Object.fromEntries(rows.map((c) => [c.slug, c.id]))

  let criados = 0
  for (const ex of EXEMPLOS) {
    try {
      await produtos.criar({ ...ex, categoriaId: porSlug[ex.categoria] })
      criados += 1
      console.log(`  + ${ex.nome}`)
    } catch (err) {
      console.log(`  ! ${ex.nome}: ${err.message}`)
    }
  }
  console.log(`\n✓ ${criados} produto(s) de exemplo criados.\n`)
}

main()
  .catch((err) => {
    console.error('✗', err.message)
    process.exitCode = 1
  })
  .finally(() => db.pool.end())
