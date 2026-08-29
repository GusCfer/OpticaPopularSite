import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatarPreco } from '../services/api'
import './Lightbox.css'

const FATOR_ZOOM = 2.4
// "toque" ou "clique" conforme o aparelho — o texto errado confunde mais do que ajuda
const APONTADOR_FINO =
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
const VERBO = APONTADOR_FINO ? 'Clique' : 'Toque'
// arrastou mais que isto? foi rolagem do carrossel, não um toque para dar zoom
const TOLERANCIA_TOQUE = 10

/**
 * Foto ampliada do produto, com carrossel de até 8 imagens e zoom.
 *
 * O carrossel é CSS puro: scroll-snap dá o arrasto nativo, com a inércia e a
 * "presa" que o sistema operacional já faz melhor do que qualquer JS. Aqui o
 * JavaScript só observa qual slide está na frente e move o scroll quando
 * alguém usa as setas.
 */
function Lightbox({ produto, aoFechar }) {
  const imagens = useMemo(() => {
    if (produto?.imagens?.length) return produto.imagens
    return produto?.imagemUrl ? [produto.imagemUrl] : []
  }, [produto])

  const [indice, setIndice] = useState(0)
  const [zoom, setZoom] = useState(null) // { x, y } em % da imagem, ou null
  const trilhoRef = useRef(null)
  const toqueRef = useRef(null)

  const total = imagens.length

  const irPara = useCallback((alvo) => {
    const trilho = trilhoRef.current
    if (!trilho) return
    const destino = Math.max(0, Math.min(alvo, trilho.children.length - 1))
    trilho.scrollTo({ left: destino * trilho.clientWidth, behavior: 'smooth' })
  }, [])

  // Esc fecha, setas navegam, e a rolagem do site trava enquanto está aberto
  useEffect(() => {
    function aoTeclar(evento) {
      if (evento.key === 'Escape') return aoFechar()
      if (evento.key === 'ArrowRight') irPara(indice + 1)
      if (evento.key === 'ArrowLeft') irPara(indice - 1)
    }

    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', aoTeclar)

    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aoFechar, irPara, indice])

  /** Descobre o slide da frente pela posição do scroll. */
  function aoRolar() {
    const trilho = trilhoRef.current
    if (!trilho || trilho.clientWidth === 0) return
    const atual = Math.round(trilho.scrollLeft / trilho.clientWidth)
    setIndice((anterior) => (anterior === atual ? anterior : atual))
    if (zoom) setZoom(null)
  }

  // ---- zoom por toque/clique ----
  // Guarda onde o dedo (ou o mouse) desceu. Se subir quase no mesmo lugar, foi
  // um toque e vale como zoom; se arrastou, era rolagem e não faz nada.
  function aoPressionar(evento) {
    toqueRef.current = { x: evento.clientX, y: evento.clientY }
  }

  function aoSoltar(evento) {
    const inicio = toqueRef.current
    toqueRef.current = null
    if (!inicio) return

    const andou = Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y)
    if (andou > TOLERANCIA_TOQUE) return

    if (zoom) {
      setZoom(null)
      return
    }

    // ponto tocado em % da imagem: é para lá que o zoom aproxima
    const area = evento.currentTarget.getBoundingClientRect()
    setZoom({
      x: ((evento.clientX - area.left) / area.width) * 100,
      y: ((evento.clientY - area.top) / area.height) * 100,
    })
  }

  if (!produto || total === 0) return null

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${produto.nome}`}
      onClick={aoFechar}
    >
      <button type="button" className="lightbox__fechar" onClick={aoFechar} aria-label="Fechar">
        ×
      </button>

      <figure className="lightbox__conteudo" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox__palco">
          <div
            className={`lightbox__trilho ${zoom ? 'is-zoom' : ''}`}
            ref={trilhoRef}
            onScroll={aoRolar}
          >
            {imagens.map((url, i) => (
              <div className="lightbox__slide" key={url}>
                <img
                  src={url}
                  alt={`${produto.nome} — foto ${i + 1} de ${total}`}
                  className={zoom && i === indice ? 'is-zoom' : ''}
                  style={
                    zoom && i === indice
                      ? {
                          transform: `scale(${FATOR_ZOOM})`,
                          transformOrigin: `${zoom.x}% ${zoom.y}%`,
                        }
                      : undefined
                  }
                  onPointerDown={aoPressionar}
                  onPointerUp={aoSoltar}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          {total > 1 && (
            <>
              <button
                type="button"
                className="lightbox__seta lightbox__seta--antes"
                onClick={() => irPara(indice - 1)}
                disabled={indice === 0}
                aria-label="Foto anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="lightbox__seta lightbox__seta--depois"
                onClick={() => irPara(indice + 1)}
                disabled={indice === total - 1}
                aria-label="Próxima foto"
              >
                ›
              </button>
            </>
          )}

          <span className="lightbox__posicao" aria-live="polite">
            {total > 1 ? `Foto ${indice + 1} de ${total}` : '1 foto'}
          </span>

          <span className="lightbox__dica-zoom">
            {zoom ? `${VERBO} para afastar` : `${VERBO} para ampliar`}
          </span>
        </div>

        {total > 1 && (
          <div className="lightbox__miniaturas">
            {imagens.map((url, i) => (
              <button
                type="button"
                key={url}
                className={`lightbox__miniatura ${i === indice ? 'is-atual' : ''}`}
                onClick={() => irPara(i)}
                aria-label={`Ver a foto ${i + 1}`}
                aria-current={i === indice}
              >
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        <figcaption className="lightbox__legenda">
          <div>
            {produto.marca && <span className="lightbox__marca">{produto.marca}</span>}
            <strong>{produto.nome}</strong>
          </div>
          <span className="lightbox__preco">
            {produto.precoPromocional ? (
              <>
                <s>{formatarPreco(produto.preco)}</s> {formatarPreco(produto.precoPromocional)}
              </>
            ) : (
              formatarPreco(produto.preco)
            )}
          </span>
        </figcaption>
      </figure>
    </div>
  )
}

export default Lightbox
