import { useId } from 'react'

// Contorno da lente esquerda: topo reto e base arredondada, o formato
// "panto quadrado" das armações de acetato atuais. A direita é o espelho
// dela em torno de x = 300.
const LENTE_ESQ =
  'M 92 52 H 250 Q 274 52 274 78 V 136 Q 274 200 208 202 H 134 Q 66 200 66 136 V 78 Q 66 52 92 52 Z'
const LENTE_DIR =
  'M 508 52 H 350 Q 326 52 326 78 V 136 Q 326 200 392 202 H 466 Q 534 200 534 136 V 78 Q 534 52 508 52 Z'

/**
 * Armação desenhada em SVG para o topo da home.
 *
 * Ilustração e não foto: fica nítida em qualquer tela, pesa poucos KB e
 * usa as cores da marca. É decorativa (aria-hidden); quem usa leitor de tela
 * já recebe o título e o texto do hero.
 *
 * useId: os ids dos gradientes precisam ser únicos na página, senão uma
 * segunda armação herdaria o gradiente da primeira.
 */
function Armacao({ className = '' }) {
  const id = useId().replace(/:/g, '')
  const acetato = `acetato-${id}`
  const brilho = `brilho-${id}`
  const lente = `lente-${id}`
  const recorte = `recorte-${id}`

  return (
    <svg
      className={className}
      viewBox="0 0 600 250"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* acetato tartaruga: marrom escuro com veios dourados */}
        <linearGradient id={acetato} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a1a12" />
          <stop offset="0.22" stopColor="#6b4329" />
          <stop offset="0.38" stopColor="#c9a26b" />
          <stop offset="0.5" stopColor="#5a3b27" />
          <stop offset="0.68" stopColor="#8a5a3a" />
          <stop offset="0.82" stopColor="#3a2619" />
          <stop offset="1" stopColor="#1e1814" />
        </linearGradient>

        <linearGradient id={lente} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9b98f" stopOpacity="0.22" />
          <stop offset="1" stopColor="#f6f0e7" stopOpacity="0.04" />
        </linearGradient>

        <linearGradient id={brilho} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffcf7" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fffcf7" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fffcf7" stopOpacity="0" />
        </linearGradient>

        <clipPath id={recorte}>
          <path d={LENTE_ESQ} />
          <path d={LENTE_DIR} />
        </clipPath>
      </defs>

      {/* hastes vistas de frente: só o começo delas, indo para trás */}
      <path d="M 66 70 L 18 62 Q 10 61 10 69 L 10 72 Q 10 79 18 80 L 66 86 Z" fill={`url(#${acetato})`} />
      <path d="M 534 70 L 582 62 Q 590 61 590 69 L 590 72 Q 590 79 582 80 L 534 86 Z" fill={`url(#${acetato})`} />

      {/* lentes */}
      <path d={LENTE_ESQ} fill={`url(#${lente})`} />
      <path d={LENTE_DIR} fill={`url(#${lente})`} />

      {/* reflexo que atravessa as lentes de tempos em tempos */}
      <g clipPath={`url(#${recorte})`}>
        <rect className="armacao__reflexo" x="-160" y="-40" width="90" height="330" fill={`url(#${brilho})`} transform="rotate(18)" />
        {/* reflexo fixo: a curva de luz que toda lente tem no canto de cima */}
        <path d="M 92 74 Q 110 64 140 64" stroke="#fffcf7" strokeOpacity="0.4" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M 352 74 Q 370 64 400 64" stroke="#fffcf7" strokeOpacity="0.4" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>

      {/* aro */}
      <path d={LENTE_ESQ} fill="none" stroke={`url(#${acetato})`} strokeWidth="15" strokeLinejoin="round" />
      <path d={LENTE_DIR} fill="none" stroke={`url(#${acetato})`} strokeWidth="15" strokeLinejoin="round" />

      {/* sobrancelha: o topo mais grosso é o que dá cara de armação moderna */}
      <path d="M 62 82 V 78 Q 62 46 92 46 H 250 Q 278 46 278 78 V 82" fill="none" stroke={`url(#${acetato})`} strokeWidth="10" strokeLinecap="round" />
      <path d="M 538 82 V 78 Q 538 46 508 46 H 350 Q 322 46 322 78 V 82" fill="none" stroke={`url(#${acetato})`} strokeWidth="10" strokeLinecap="round" />

      {/* ponte */}
      <path d="M 272 88 Q 300 64 328 88" fill="none" stroke={`url(#${acetato})`} strokeWidth="13" strokeLinecap="round" />

      {/* fio de luz no acetato: dá volume ao aro */}
      <path d="M 92 50 H 248" stroke="#fffcf7" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
      <path d="M 352 50 H 508" stroke="#fffcf7" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />

      {/* rebites dourados */}
      <circle cx="80" cy="66" r="4" fill="#d9b98f" />
      <circle cx="520" cy="66" r="4" fill="#d9b98f" />
    </svg>
  )
}

export default Armacao
