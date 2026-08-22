import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, formatarPreco, MAX_DESTAQUES } from '../services/api'
import { useAuth } from './useAuth'
import ProdutoForm from './ProdutoForm'
import logo from '../assets/Optica Popular - Logo Branco.png'
import './admin.css'

function Painel() {
  const { usuario, sair } = useAuth()

  // null enquanto a primeira carga não terminou.
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [versao, setVersao] = useState(0) // incrementar força um recarregamento
  const [editando, setEditando] = useState(null) // null = fechado, 'novo' ou objeto produto

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let ativo = true

    Promise.all([
      api.produtosAdmin({ categoria: filtroCategoria, busca, limite: 200 }),
      api.categorias(),
    ])
      .then(([lista, cats]) => {
        if (ativo) setDados({ produtos: lista, categorias: cats })
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Falha ao carregar os produtos')
      })

    return () => {
      ativo = false
    }
  }, [filtroCategoria, busca, versao])

  const carregando = dados === null
  const produtos = useMemo(() => dados?.produtos ?? [], [dados])
  const categorias = dados?.categorias ?? []

  const destaquesUsados = useMemo(() => produtos.filter((p) => p.destaque).length, [produtos])

  function mostrarAviso(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 4000)
  }

  async function alternarDestaque(produto) {
    setErro('')
    try {
      const atualizado = await api.definirDestaque(produto.id, !produto.destaque)
      setDados((atual) => ({
        ...atual,
        produtos: atual.produtos.map((p) => (p.id === atualizado.id ? atualizado : p)),
      }))
    } catch (err) {
      setErro(err.message)
    }
  }

  async function excluir(produto) {
    if (!window.confirm(`Excluir "${produto.nome}"? Essa ação não pode ser desfeita.`)) return
    setErro('')
    try {
      await api.excluirProduto(produto.id)
      setDados((atual) => ({
        ...atual,
        produtos: atual.produtos.filter((p) => p.id !== produto.id),
      }))
      mostrarAviso('Produto excluído.')
    } catch (err) {
      setErro(err.message)
    }
  }

  function aoSalvar(salvo) {
    setEditando(null)
    mostrarAviso(`"${salvo.nome}" salvo com sucesso.`)
    recarregar()
  }

  return (
    <div className="painel">
      <header className="painel__topo">
        <div className="painel__marca">
          <img src={logo} alt="Óptica Popular" />
          <div>
            <strong>Painel administrativo</strong>
            <span>Catálogo de produtos</span>
          </div>
        </div>
        <div className="painel__usuario">
          <span>
            {usuario?.nome} <em>({usuario?.papel})</em>
          </span>
          <a href="/" className="botao-link" target="_blank" rel="noreferrer">
            Ver site
          </a>
          <button type="button" className="botao-link" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <main className="painel__conteudo">
        <div className="painel__acoes">
          <div className="painel__filtros">
            <input
              type="search"
              placeholder="Buscar por nome ou marca…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.nome} ({c.totalProdutos})
                </option>
              ))}
            </select>
          </div>

          <div className="painel__acoes-dir">
            <span className={`contador ${destaquesUsados >= MAX_DESTAQUES ? 'contador--cheio' : ''}`}>
              Destaques: {destaquesUsados}/{MAX_DESTAQUES}
            </span>
            <button type="button" className="btn btn-dark" onClick={() => setEditando('novo')}>
              + Novo produto
            </button>
          </div>
        </div>

        {erro && <div className="alerta alerta--erro">{erro}</div>}
        {aviso && <div className="alerta alerta--ok">{aviso}</div>}

        {editando && (
          <ProdutoForm
            key={editando === 'novo' ? 'novo' : editando.id}
            produto={editando === 'novo' ? null : editando}
            categorias={categorias}
            destaquesUsados={destaquesUsados}
            aoSalvar={aoSalvar}
            aoCancelar={() => setEditando(null)}
          />
        )}

        {carregando ? (
          <div className="admin-carregando">Carregando produtos…</div>
        ) : produtos.length === 0 ? (
          <div className="vazio">
            <p>Nenhum produto cadastrado ainda.</p>
            <button type="button" className="btn btn-dark" onClick={() => setEditando('novo')}>
              Cadastrar o primeiro
            </button>
          </div>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Status</th>
                  <th>Destaque</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {produtos.map((produto) => (
                  <tr key={produto.id} className={produto.ativo ? '' : 'linha--inativa'}>
                    <td>
                      <div className="miniatura">
                        {produto.imagemUrl ? (
                          <img src={produto.imagemUrl} alt="" />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong>{produto.nome}</strong>
                      {produto.marca && <small>{produto.marca}</small>}
                    </td>
                    <td>{produto.categoria?.nome}</td>
                    <td>
                      {produto.precoPromocional ? (
                        <>
                          <s>{formatarPreco(produto.preco)}</s>{' '}
                          <strong>{formatarPreco(produto.precoPromocional)}</strong>
                        </>
                      ) : (
                        formatarPreco(produto.preco)
                      )}
                    </td>
                    <td>
                      <span className={`pill ${produto.ativo ? 'pill--ok' : 'pill--off'}`}>
                        {produto.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`estrela ${produto.destaque ? 'estrela--on' : ''}`}
                        onClick={() => alternarDestaque(produto)}
                        title={
                          produto.destaque
                            ? 'Remover dos destaques'
                            : destaquesUsados >= MAX_DESTAQUES
                              ? `Limite de ${MAX_DESTAQUES} destaques atingido`
                              : 'Colocar em destaque na home'
                        }
                        disabled={!produto.destaque && destaquesUsados >= MAX_DESTAQUES}
                      >
                        {produto.destaque ? '★' : '☆'}
                      </button>
                    </td>
                    <td className="acoes">
                      <button type="button" className="botao-link" onClick={() => setEditando(produto)}>
                        Editar
                      </button>
                      <button type="button" className="botao-link botao-link--perigo" onClick={() => excluir(produto)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

export default Painel
