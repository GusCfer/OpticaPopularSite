import { Link } from 'react-router-dom'
import Armacao from './Armacao'
import './Hero.css'

// o que a loja já vende: a faixa abaixo dos botões responde "tem o que eu procuro?"
const categorias = ['Óculos de grau', 'Óculos de sol', 'Lentes de contato', 'Relógios', 'Joias']

function Hero() {
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

        {/* armação ilustrada no lugar da foto da fachada, que tinha resolução
            baixa demais para ser o destaque da página */}
        <div className="hero__visual">
          <span className="hero__aneis" aria-hidden="true" />
          <Armacao className="hero__armacao" />
          <span className="hero__sombra" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}

export default Hero
