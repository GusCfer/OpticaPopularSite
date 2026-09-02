import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, formatarPreco, MAX_DESTAQUES } from '../services/api'
import Paginacao from '../components/Paginacao'
import ProdutoForm from './ProdutoForm'

const POR_PAGINA = 12

function ProdutosPainel() {
  // null enquanto a primeira carga não terminou.
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [versao, setVersao] = useState(0) // incrementar força um recarregamento
  const [editando, setEditando] = useState(null) // null = fechado, 'novo' ou objeto produto

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let ativo = true

    Promise.all([
      api.produtosAdmin({ categoria: filtroCategoria, busca, pagina, porPagina: POR_PAGINA }),
      api.categorias(),
    ])
      .then(([resposta, cats]) => {
        if (ativo) setDados({ ...resposta, categorias: cats })
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Falha ao carregar os produtos')
      })

    return () => {
      ativo = false
    }
  }, [filtroCategoria, busca, pagina, versao])

  /**
   * Trocar filtro sempre volta para a primeira página: filtrar com a página 3
   * aberta mostraria "nenhum resultado" sem motivo nenhum.
   */
  function filtrarPor(campo, valor) {
    if (campo === 'busca') setBusca(valor)
    else setFiltroCategoria(valor)
    setPagina(1)
  }

  const carregando = dados === null
  const produtos = useMemo(() => dados?.itens ?? [], [dados])
  const categorias = dados?.categorias ?? []
  const total = dados?.total ?? 0

  // vem do servidor: contar só a página aberta faria o "3/5" mentir ao paginar
  const destaquesUsados = dados?.destaquesUsados ?? 0

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
        itens: atual.itens.map((p) => (p.id === atualizado.id ? atualizado : p)),
        destaquesUsados: atual.destaquesUsados + (atualizado.destaque ? 1 : -1),
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
      mostrarAviso('Produto excluído.')
      // recarrega em vez de remover na mão: a página precisa ser recomposta
      // com um item vindo da página seguinte
      recarregar()
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
    <>
    <div className="painel__acoes">
      <div className="painel__filtros">
        <input
          type="search"
          placeholder="Buscar por nome, marca ou referência…"
          value={busca}
          onChange={(e) => filtrarPor('busca', e.target.value)}
        />
        <select value={filtroCategoria} onChange={(e) => filtrarPor('categoria', e.target.value)}>
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
        <table className="tabela tabela--lista">
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
                <td data-rotulo="Foto">
                  <div className="miniatura">
                    {produto.imagemUrl ? (
                      <img src={produto.imagemUrl} alt="" />
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </td>
                <td data-rotulo="Produto">
                  <strong>{produto.nome}</strong>
                  {produto.marca && <small>{produto.marca}</small>}
                  {/* só o painel enxerga isto: a rota pública nem devolve o campo */}
                  {produto.referencia && (
                    <small className="lista__referencia">Ref. {produto.referencia}</small>
                  )}
                </td>
                <td data-rotulo="Categoria">{produto.categoria?.nome}</td>
                <td data-rotulo="Preço">
                  {produto.precoPromocional ? (
                    <>
                      <s>{formatarPreco(produto.preco)}</s>{' '}
                      <strong>{formatarPreco(produto.precoPromocional)}</strong>
                    </>
                  ) : (
                    formatarPreco(produto.preco)
                  )}
                </td>
                <td data-rotulo="Status">
                  <span className={`pill ${produto.ativo ? 'pill--ok' : 'pill--off'}`}>
                    {produto.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td data-rotulo="Destaque">
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

        <p className="painel__contagem">
          {total} {total === 1 ? 'produto' : 'produtos'}
          {dados.paginas > 1 && ` — página ${dados.pagina} de ${dados.paginas}`}
        </p>

        <Paginacao
          pagina={dados.pagina}
          paginas={dados.paginas}
          aoTrocar={setPagina}
          rotulo="Páginas do catálogo"
        />
      </div>
    )}
    </>
  )
}

export default ProdutosPainel
