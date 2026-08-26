import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import ProdutoCard from '../components/ProdutoCard'
import Lightbox from '../components/Lightbox'
import './Produtos.css'

function Produtos() {
  // a categoria fica na URL (/produtos?categoria=solar) — dá pra compartilhar o link
  const [params, setParams] = useSearchParams()
  const categoria = params.get('categoria') || ''

  const [categorias, setCategorias] = useState([])
  const [produtos, setProdutos] = useState(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [ampliado, setAmpliado] = useState(null)

  useEffect(() => {
    let ativo = true
    api
      .categorias()
      .then((lista) => ativo && setCategorias(lista))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    let ativo = true
    api
      .produtos({ categoria, limite: 200 })
      .then((lista) => ativo && setProdutos(lista))
      .catch((err) => {
        if (!ativo) return
        setProdutos([])
        setErro(err.message || 'Não consegui carregar os produtos agora.')
      })
    return () => {
      ativo = false
    }
  }, [categoria])

  // a busca por texto é feita no navegador, sem ida extra ao servidor
  const visiveis = useMemo(() => {
    const lista = produtos || []
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter((p) =>
      `${p.nome} ${p.marca || ''} ${p.descricao || ''}`.toLowerCase().includes(termo)
    )
  }, [produtos, busca])

  function trocarCategoria(slug) {
    if (slug) setParams({ categoria: slug })
    else setParams({})
  }

  const carregando = produtos === null
  const nomeCategoria = categorias.find((c) => c.slug === categoria)?.nome

  return (
    <>
      <section className="produtos-topo">
        <div className="container">
          <span className="eyebrow produtos-topo__eyebrow">Catálogo</span>
          <h1>{nomeCategoria || 'Nossos produtos'}</h1>
          <p>
            Óculos, relógios e joias disponíveis na loja.{' '}
            {/* a instrução só no desktop: no celular custava duas linhas antes da grade */}
            <span className="produtos-topo__extra">
              Clique na foto para ampliar e chame a gente no WhatsApp para reservar.
            </span>
          </p>
        </div>
      </section>

      <section className="section produtos">
        <div className="container">
          <div className="produtos__filtros">
            <div className="produtos__chips">
              <button
                type="button"
                className={`chip ${categoria === '' ? 'chip--ativo' : ''}`}
                onClick={() => trocarCategoria('')}
              >
                Todos
              </button>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${categoria === c.slug ? 'chip--ativo' : ''}`}
                  onClick={() => trocarCategoria(c.slug)}
                >
                  {c.nome}
                </button>
              ))}
            </div>

            <input
              type="search"
              className="produtos__busca"
              placeholder="Buscar por nome ou marca…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar produtos"
            />
          </div>

          {erro && <p className="produtos__aviso">{erro}</p>}

          {carregando ? (
            <p className="produtos__aviso">Carregando produtos…</p>
          ) : visiveis.length === 0 ? (
            <p className="produtos__aviso">
              {busca
                ? `Nenhum produto encontrado para "${busca}".`
                : 'Nenhum produto cadastrado nesta categoria ainda.'}
            </p>
          ) : (
            <>
              <p className="produtos__contagem">
                {visiveis.length} {visiveis.length === 1 ? 'produto' : 'produtos'}
              </p>
              <div className="produtos__grid">
                {visiveis.map((produto) => (
                  <ProdutoCard key={produto.id} produto={produto} aoAmpliar={setAmpliado} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {ampliado && <Lightbox produto={ampliado} aoFechar={() => setAmpliado(null)} />}
    </>
  )
}

export default Produtos
