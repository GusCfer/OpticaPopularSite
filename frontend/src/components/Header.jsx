import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/Optica Popular - Logo Branco.png'
import './Header.css'

// âncoras que só existem na home
const ancoras = [
  { hash: '#diferenciais', label: 'Diferenciais' },
  { hash: '#depoimentos', label: 'Depoimentos' },
  { hash: '#contato', label: 'Contato' },
]

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const naHome = location.pathname === '/'

  /**
   * Na home, rola até a seção. Em outra página (/produtos), volta para a home
   * pedindo o scroll pela state da rota — quem faz o scroll é a Home.
   */
  function irParaSecao(evento, hash) {
    evento.preventDefault()
    setOpen(false)

    if (naHome) {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
      window.history.replaceState(null, '', hash)
    } else {
      navigate('/', { state: { rolarPara: hash } })
    }
  }

  return (
    <header className="header">
      <div className="container header__bar">
        <Link to="/" className="header__logo" onClick={() => setOpen(false)}>
          <img src={logo} alt="Óptica Popular" />
        </Link>

        <nav className={`header__nav ${open ? 'is-open' : ''}`}>
          <ul>
            <li>
              <Link
                to="/produtos"
                className={location.pathname === '/produtos' ? 'is-atual' : ''}
                onClick={() => setOpen(false)}
              >
                Produtos
              </Link>
            </li>
            {ancoras.map((link) => (
              <li key={link.hash}>
                <a href={naHome ? link.hash : `/${link.hash}`} onClick={(e) => irParaSecao(e, link.hash)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={naHome ? '#contato' : '/#contato'}
            className="btn btn-primary header__cta"
            onClick={(e) => irParaSecao(e, '#contato')}
          >
            Agende sua avaliação
          </a>
        </nav>

        <button
          type="button"
          className={`header__toggle ${open ? 'is-open' : ''}`}
          aria-label="Abrir menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  )
}

export default Header
