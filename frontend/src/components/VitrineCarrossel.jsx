import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatarPreco } from '../services/api'
import { rotaDoProduto } from '../lib/compartilhar'
import './VitrineCarrossel.css'

const QUANTOS = 14
// quanto maior, mais devagar a esteira anda
const SEGUNDOS_POR_ITEM = 5
// abaixo disto a fileira não cobre a largura da tela e o loop fica com buraco
const MINIMO_NA_ESTEIRA = 6

/**
 * Vitrine em esteira: uma fileira de produtos que desliza sem parar.
 *
 * O sorteio é do servidor (ORDER BY random()), não do navegador — assim cada
 * visita vê uma seleção diferente sem precisar baixar o catálogo inteiro para
 * embaralhar aqui.
 *
 * O movimento é uma animação CSS de um `transform`, e não JavaScript mexendo na
 * posição quadro a quadro: o navegador roda isso na placa de vídeo, sem passar
 * pela thread principal. Na prática é a diferença entre uma esteira lisa e uma
 * que engasga enquanto a pessoa rola a página no celular.
 *
 * O truque do loop infinito: a lista é renderizada DUAS vezes e o trilho anda
 * exatamente -50%. Quando a primeira cópia termina de sair, a segunda está no
 * lugar idêntico onde a primeira começou — a animação reinicia e ninguém vê
 * emenda. Por isso o espaçamento é `margin-right` em cada item, e não `gap`:
 * com `gap` o trilho mediria 2N itens + (2N-1) espaços, e metade disso não seria
 * uma cópia exata — a esteira daria um pulinho a cada volta.
 */
function VitrineCarrossel() {
  const [produtos, setProdutos] = useState(null)
  // dedo em cima: a esteira para para a pessoa conseguir tocar na peça certa
  const [tocando, setTocando] = useState(false)
  const [naTela, setNaTela] = useState(true)
  const secaoRef = useRef(null)
  const navegar = useNavigate()

  useEffect(() => {
    let ativo = true
    api
      .vitrine(QUANTOS)
      .then((lista) => ativo && setProdutos(lista))
      .catch(() => ativo && setProdutos([]))
    return () => {
      ativo = false
    }
  }, [])

  // Animação rodando fora da vista é bateria do celular indo embora sem que
  // ninguém veja nada. Enquanto a seção não está na tela, a esteira fica parada.
  useEffect(() => {
    const alvo = secaoRef.current
    if (!alvo || typeof IntersectionObserver === 'undefined') return

    const observador = new IntersectionObserver(
      ([entrada]) => setNaTela(entrada.isIntersecting),
      { rootMargin: '150px' }
    )
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [produtos])

  // Catálogo pequeno (3 ou 4 peças com foto) não preenche a largura da tela:
  // a lista se repete até dar corpo, e só então é duplicada para o loop.
  const fileira = useMemo(() => {
    if (!produtos?.length) return []
    const lista = [...produtos]
    while (lista.length < MINIMO_NA_ESTEIRA) lista.push(...produtos)
    return lista
  }, [produtos])

  // Ainda carregando, ou sem nenhuma peça com foto: a seção simplesmente não
  // aparece, em vez de deixar um buraco ou um "carregando…" piscando na home.
  if (fileira.length === 0) return null

  const parada = tocando || !naTela

  return (
    <section id="vitrine" className="section vitrine" ref={secaoRef}>
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow">Passeando pelo catálogo</span>
          <h2>Vitrine da loja</h2>
          <p>Uma seleção diferente a cada visita. Toque em uma peça para ver de perto.</p>
        </div>
      </div>

      {/* fora do .container de propósito: a esteira vai de ponta a ponta da tela */}
      <div
        className="vitrine__esteira"
        onPointerDown={() => setTocando(true)}
        onPointerUp={() => setTocando(false)}
        onPointerCancel={() => setTocando(false)}
        onPointerLeave={() => setTocando(false)}
      >
        <div
          className={`vitrine__trilho ${parada ? 'is-parada' : ''}`}
          style={{ '--duracao': `${fileira.length * SEGUNDOS_POR_ITEM}s` }}
        >
          {/* A segunda cópia existe só para o olho: para quem usa leitor de tela
              ela seria a mesma lista lida duas vezes, então some do acessível. */}
          {[0, 1].map((copia) =>
            fileira.map((produto, i) => (
              <button
                type="button"
                key={`${copia}-${i}-${produto.id}`}
                className="vitrine__item"
                onClick={() => navegar(rotaDoProduto(produto))}
                aria-hidden={copia === 1}
                tabIndex={copia === 1 ? -1 : 0}
              >
                <span className="vitrine__foto">
                  <img src={produto.imagemUrl} alt="" loading="lazy" draggable={false} />
                </span>
                <span className="vitrine__nome">{produto.nome}</span>
                <span className="vitrine__preco">
                  {formatarPreco(produto.precoPromocional ?? produto.preco)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export default VitrineCarrossel
