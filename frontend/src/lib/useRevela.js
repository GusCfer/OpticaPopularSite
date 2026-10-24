import { useEffect, useRef } from 'react'

/**
 * Entrada suave ao rolar: devolve uma ref; todo filho dela com a classe
 * .revela ganha .is-visivel quando entra na tela (uma vez só).
 * O CSS da animação está no index.css, e respeita prefers-reduced-motion.
 */
export function useRevela(deps = []) {
  const ref = useRef(null)

  useEffect(() => {
    const raiz = ref.current
    if (!raiz) return
    const alvos = raiz.querySelectorAll('.revela')

    if (typeof IntersectionObserver === 'undefined') {
      alvos.forEach((el) => el.classList.add('is-visivel'))
      return
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (!entrada.isIntersecting) return
          entrada.target.classList.add('is-visivel')
          observador.unobserve(entrada.target)
        })
      },
      { rootMargin: '0px 0px -10% 0px' }
    )
    alvos.forEach((el) => observador.observe(el))
    return () => observador.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
