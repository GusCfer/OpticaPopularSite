import { Link } from 'react-router-dom'
import logo from '../assets/Optica Popular - Logo Branco.png'
import fotoLoja from '../assets/foto_loja.png'
import './Hero.css'

function Hero() {
  return (
    <section id="inicio" className="hero">
      <img
        className="hero__foto-loja"
        src={fotoLoja}
        alt="Interior da Óptica Popular"
        loading="lazy"
      />

      <div className="container hero__grid">
        <div className="hero__content">
          <span className="eyebrow hero__eyebrow">Óptica Popular</span>
          <h1>
            Sua visão, <br />o nosso estilo.
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
        </div>

        {/* a marca aparece solta sobre o fundo escuro — sem cartão nem moldura */}
        <div className="hero__visual">

          <img
            className="hero__marca"
            src={logo}
            alt="Óptica Popular"
            width="926"
            height="626"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  )
}

export default Hero
