import { useEffect } from 'react'
import { formatarPreco } from '../services/api'
import './Lightbox.css'

/** Imagem ampliada do produto. Fecha no Esc, no X ou clicando no fundo. */
function Lightbox({ produto, aoFechar }) {
  useEffect(() => {
    function aoTeclar(evento) {
      if (evento.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    // trava a rolagem do site enquanto a foto está aberta
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [aoFechar])

  if (!produto) return null

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ampliada: ${produto.nome}`}
      onClick={aoFechar}
    >
      <button type="button" className="lightbox__fechar" onClick={aoFechar} aria-label="Fechar">
        ×
      </button>

      <figure className="lightbox__conteudo" onClick={(e) => e.stopPropagation()}>
        <img src={produto.imagemUrl} alt={produto.nome} />
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
