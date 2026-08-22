import { formatarPreco } from '../services/api'
import './ProdutoCard.css'

const WHATSAPP = '5543996335759'

/**
 * Card de produto usado na home (destaques) e na página /produtos.
 * Clicar na foto chama aoAmpliar(produto) — quem usa o card decide o que fazer.
 */
function ProdutoCard({ produto, aoAmpliar }) {
  const temImagem = Boolean(produto.imagemUrl)

  function ampliar() {
    if (temImagem && aoAmpliar) aoAmpliar(produto)
  }

  return (
    <article className="produto-card">
      {temImagem ? (
        <button
          type="button"
          className="produto-card__midia produto-card__midia--clicavel"
          onClick={ampliar}
          aria-label={`Ampliar a foto de ${produto.nome}`}
        >
          <img src={produto.imagemUrl} alt={produto.nome} loading="lazy" />
          <span className="produto-card__tag">{produto.categoria?.nome}</span>
          <span className="produto-card__lupa" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M11 8.5v5M8.5 11h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      ) : (
        <div className="produto-card__midia">
          <span className="produto-card__sem-foto">Sem foto</span>
          <span className="produto-card__tag">{produto.categoria?.nome}</span>
        </div>
      )}

      <div className="produto-card__corpo">
        {produto.marca && <span className="produto-card__marca">{produto.marca}</span>}
        <h3>{produto.nome}</h3>
        {produto.descricao && <p className="produto-card__desc">{produto.descricao}</p>}

        <div className="produto-card__preco">
          {produto.precoPromocional ? (
            <>
              <span className="produto-card__preco-antigo">{formatarPreco(produto.preco)}</span>
              <strong>{formatarPreco(produto.precoPromocional)}</strong>
            </>
          ) : (
            <strong>{formatarPreco(produto.preco)}</strong>
          )}
        </div>

        <a
          className="btn btn-dark produto-card__cta"
          href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
            `Olá! Tenho interesse no produto: ${produto.nome}`
          )}`}
          target="_blank"
          rel="noreferrer"
        >
          Tenho interesse
        </a>
      </div>
    </article>
  )
}

export default ProdutoCard
