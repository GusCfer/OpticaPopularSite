import { Link } from 'react-router-dom'
import logo from '../assets/Optica Popular - Logo Branco.png'
import './Hero.css'

function Hero() {
  return (
    <section id="inicio" className="hero">
      <div className="container hero__grid">
        <div className="hero__content">
          <span className="eyebrow hero__eyebrow">Óptica Popular</span>
          <h1>
            Sua visão, <br />o nosso estilo.
          </h1>
          <p className="hero__text">
            Óculos de grau, óculos de sol e lentes de contato com atendimento próximo e
            personalizado. Encontre o modelo perfeito para o seu rosto e para o seu dia a dia.
          </p>
          <div className="hero__actions">
            <Link to="/produtos" className="btn btn-primary">
              Ver produtos
            </Link>
            <a href="#contato" className="btn btn-outline">
              Agende uma avaliação
            </a>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__frame">
            <img src={logo} alt="Óptica Popular" className="hero__logo" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
