import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import Armacao from './Armacao'
import './Hero.css'

// o que a loja já vende: a faixa abaixo dos botões responde "tem o que eu procuro?"
const categorias = ['Óculos de grau', 'Óculos de sol', 'Lentes de contato', 'Relógios', 'Joias']

// o three.js é pesado: só baixa depois da página, e enquanto isso fica a armação em SVG
const Armacao3D = lazy(() => import('./Armacao3D'))

function temWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function ArmacaoIlustrada() {
  return (
    <>
      <Armacao className="hero__armacao" />
      <span className="hero__sombra" aria-hidden="true" />
    </>
  )
}

function Hero() {
  const [usar3D] = useState(temWebGL)

  return (
    <section id="inicio" className="hero">
      <div className="container hero__grid">
        <div className="hero__content">
          <span className="eyebrow">Óptica e joalheria</span>
          <h1>
            Sua visão, <em>o nosso estilo</em>.
          </h1>
          <p className="hero__text">
            Óculos de grau, óculos de sol, lentes de contato, relógios e joias com atendimento próximo e
            personalizado.{' '}
            {/* segunda frase só no desktop: no celular ela custava duas linhas do topo */}
            <span className="hero__text-extra">
              Encontre o modelo perfeito para o seu rosto e para o seu dia a dia.
            </span>
          </p>
          <div className="hero__actions">
            <Link to="/produtos" className="btn btn-primary">
              Ver produtos
            </Link>
            <a href="#contato" className="btn btn-outline">
              Entre em contato
            </a>
          </div>

          <div className="hero__faixa">
            <ul className="hero__categorias" aria-label="O que você encontra na loja">
              {categorias.map((categoria) => (
                <li key={categoria}>{categoria}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* armação 3D no destaque; sem WebGL (ou enquanto o 3D carrega) fica a ilustrada */}
        <div className="hero__visual">
          <span className="hero__aneis" aria-hidden="true" />
          {usar3D ? (
            <Suspense fallback={<ArmacaoIlustrada />}>
              <Armacao3D fallback={<ArmacaoIlustrada />} />
            </Suspense>
          ) : (
            <ArmacaoIlustrada />
          )}
        </div>
      </div>
    </section>
  )
}

export default Hero
