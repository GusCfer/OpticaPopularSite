import './Paginacao.css'

/**
 * Navegação de páginas, usada no catálogo e no painel.
 *
 * No desktop mostra os números; no celular vira "Página 2 de 8" com as setas,
 * porque uma fileira de números não cabe sem virar alvo de toque minúsculo.
 */

/** Números a exibir, com reticências quando são muitas páginas: 1 … 4 5 6 … 12 */
function janela(atual, total, vizinhos = 1) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const paginas = new Set([1, total, atual])
  for (let d = 1; d <= vizinhos; d += 1) {
    if (atual - d > 1) paginas.add(atual - d)
    if (atual + d < total) paginas.add(atual + d)
  }

  const ordenadas = [...paginas].sort((a, b) => a - b)
  const saida = []
  let anterior = 0
  for (const n of ordenadas) {
    if (anterior && n - anterior > 1) saida.push('...')
    saida.push(n)
    anterior = n
  }
  return saida
}

function Paginacao({ pagina, paginas, aoTrocar, rotulo = 'Páginas' }) {
  // uma página só não precisa de navegação
  if (!paginas || paginas <= 1) return null

  const numeros = janela(pagina, paginas)

  return (
    <nav className="paginacao" aria-label={rotulo}>
      <button
        type="button"
        className="paginacao__seta"
        onClick={() => aoTrocar(pagina - 1)}
        disabled={pagina <= 1}
        aria-label="Página anterior"
      >
        ‹
      </button>

      <ol className="paginacao__numeros">
        {numeros.map((n, i) =>
          n === '...' ? (
            <li key={`gap-${i}`} className="paginacao__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              <button
                type="button"
                className={`paginacao__numero ${n === pagina ? 'is-atual' : ''}`}
                onClick={() => aoTrocar(n)}
                aria-label={`Página ${n}`}
                aria-current={n === pagina ? 'page' : undefined}
              >
                {n}
              </button>
            </li>
          )
        )}
      </ol>

      {/* no celular os números somem e sobra este resumo */}
      <span className="paginacao__resumo" aria-live="polite">
        Página {pagina} de {paginas}
      </span>

      <button
        type="button"
        className="paginacao__seta"
        onClick={() => aoTrocar(pagina + 1)}
        disabled={pagina >= paginas}
        aria-label="Próxima página"
      >
        ›
      </button>
    </nav>
  )
}

export default Paginacao
