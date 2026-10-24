import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import { rotaDoProduto } from '../lib/compartilhar'
import ProdutoCard from '../components/ProdutoCard'
import Lightbox from '../components/Lightbox'
import Paginacao from '../components/Paginacao'
import './Produtos.css'

const POR_PAGINA = 12
const ESPERA_BUSCA = 350 // ms parado antes de consultar o servidor

function Produtos() {
  // categoria, busca e página moram na URL: o link é compartilhável e o botão
  // voltar do navegador funciona de verdade
  const [params, setParams] = useSearchParams()
  // /produto/<slug> cai nesta mesma página: o slug da URL é quem manda na foto ampliada
  const { slug } = useParams()
  const navegar = useNavigate()
  const local = useLocation()
  const categoria = params.get('categoria') || ''
  const buscaUrl = params.get('busca') || ''
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const [categorias, setCategorias] = useState([])
  const [resposta, setResposta] = useState(null)
  const [erro, setErro] = useState('')
  // só usado quando o link chega de fora e o produto não está na página carregada
  const [produtoDoLink, setProdutoDoLink] = useState(null)
  const [linkQuebrado, setLinkQuebrado] = useState(false)
  // campo controlado à parte da URL: digitar não pode gerar uma consulta por tecla
  const [busca, setBusca] = useState(buscaUrl)
  // trava contra fechar duas vezes: navegar(-1) repetido volta dois passos e
  // tira a pessoa do site. Zera sozinha sempre que outra peça é aberta.
  const jaFechou = useRef(false)

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

  // enquanto a pessoa digita, só o último valor vira consulta
  useEffect(() => {
    if (busca === buscaUrl) return
    const id = setTimeout(() => {
      atualizarUrl({ busca, pagina: 1 })
    }, ESPERA_BUSCA)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  useEffect(() => {
    let ativo = true
    api
      .produtos({ categoria, busca: buscaUrl, pagina, porPagina: POR_PAGINA })
      // o erro só sai da tela quando uma carga dá certo, não ao começar a próxima
      .then((dados) => {
        if (!ativo) return
        setResposta(dados)
        setErro('')
      })
      .catch((err) => {
        if (!ativo) return
        setResposta({ itens: [], total: 0, pagina: 1, paginas: 1 })
        setErro(err.message || 'Não consegui carregar os produtos agora.')
      })
    return () => {
      ativo = false
    }
  }, [categoria, buscaUrl, pagina])

  const carregando = resposta === null
  const itens = resposta?.itens ?? []
  const total = resposta?.total ?? 0
  const nomeCategoria = categorias.find((c) => c.slug === categoria)?.nome
  // a foto ampliada é derivada da URL, nunca de um clique guardado em estado
  const naPagina = slug ? itens.find((p) => p.slug === slug) : null
  const ampliado = naPagina || (produtoDoLink?.slug === slug ? produtoDoLink : null)

  // Quem chega por um link compartilhado quase nunca cai na mesma página do
  // catálogo em que a peça está, então o produto é buscado pelo slug. Quando ele
  // já está na lista carregada (a pessoa clicou num card), essa ida ao servidor
  // não acontece — a abertura é instantânea.
  useEffect(() => {
    if (!slug || naPagina) return

    let ativo = true
    api
      .produtoPorSlug(slug)
      .then((p) => {
        if (!ativo) return
        setProdutoDoLink(p)
        setLinkQuebrado(false)
      })
      .catch(() => ativo && setLinkQuebrado(true))
    return () => {
      ativo = false
    }
  }, [slug, naPagina])

  useEffect(() => {
    jaFechou.current = false
  }, [slug])

  /** Abre a foto ampliada registrando a rota — é o que torna o link copiável. */
  function ampliar(produto) {
    navegar({ pathname: rotaDoProduto(produto), search: params.toString() })
  }

  /**
   * Fechar volta um passo no histórico, e não para um endereço fixo: assim quem
   * abriu a peça a partir da home volta para a home, e quem abriu do catálogo
   * volta para o catálogo com os mesmos filtros. Só quando a página do produto
   * FOI a porta de entrada (link recebido no WhatsApp) não há passo anterior —
   * aí o destino é o catálogo, sem deixar a pessoa presa numa tela sem saída.
   */
  function fechar() {
    if (jaFechou.current) return
    jaFechou.current = true
    if (local.key === 'default') navegar({ pathname: '/produtos', search: params.toString() })
    else navegar(-1)
  }

  /** Escreve os filtros na URL, omitindo o que estiver vazio ou no padrão. */
  function atualizarUrl({ categoria: cat = categoria, busca: b = buscaUrl, pagina: p = 1 }) {
    const novo = {}
    if (cat) novo.categoria = cat
    if (b) novo.busca = b
    if (p > 1) novo.pagina = String(p)
    setParams(novo)
  }

  function trocarCategoria(alvo) {
    // trocar de categoria sempre volta para a primeira página
    atualizarUrl({ categoria: alvo, pagina: 1 })
  }

  function trocarPagina(nova) {
    atualizarUrl({ pagina: nova })
    // sem isto a pessoa troca de página e continua olhando o rodapé
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <section className="produtos-topo">
        <div className="container">
          <span className="eyebrow produtos-topo__eyebrow">Catálogo</span>
          <h1>{nomeCategoria ? nomeCategoria : <>Nossos <em>produtos</em></>}</h1>
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
          {slug && linkQuebrado && (
            <p className="produtos__aviso">
              O produto deste link não está mais disponível. Veja o catálogo completo abaixo.
            </p>
          )}

          {carregando ? (
            <p className="produtos__aviso">Carregando produtos…</p>
          ) : itens.length === 0 ? (
            <p className="produtos__aviso">
              {buscaUrl
                ? `Nenhum produto encontrado para "${buscaUrl}".`
                : 'Nenhum produto cadastrado nesta categoria ainda.'}
            </p>
          ) : (
            <>
              <p className="produtos__contagem">
                {total} {total === 1 ? 'produto' : 'produtos'}
                {resposta.paginas > 1 && ` — página ${resposta.pagina} de ${resposta.paginas}`}
              </p>

              <div className="produtos__grid">
                {itens.map((produto) => (
                  <ProdutoCard key={produto.id} produto={produto} aoAmpliar={ampliar} />
                ))}
              </div>

              <Paginacao
                pagina={resposta.pagina}
                paginas={resposta.paginas}
                aoTrocar={trocarPagina}
                rotulo="Páginas do catálogo"
              />
            </>
          )}
        </div>
      </section>

      {ampliado && <Lightbox produto={ampliado} aoFechar={fechar} />}
    </>
  )
}

export default Produtos
