import logo from '../assets/Optica Popular - Logo Branco.png'
import './Footer.css'

const year = new Date().getFullYear()

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <a href="#inicio" className="footer__logo">
            <img src={logo} alt="Óptica Popular" />
          </a>
          <p>Cuidando da sua visão com estilo e proximidade.</p>
        </div>

        <nav className="footer__nav">
          <a href="/produtos">Produtos</a>
          <a href="/#vitrine">Vitrine</a>
          <a href="/#contato">Visite a loja</a>
        </nav>
      </div>

      <div className="container footer__bottom">
        <span>&copy; {year} Óptica Popular. Todos os direitos reservados. - Desenvolvido por Carvalho </span>
      </div>
    </footer>
  )
}

export default Footer
