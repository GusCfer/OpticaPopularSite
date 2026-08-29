import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/Optica Popular - Logo Branco.png'
import './Header.css'

// âncoras que só existem na home
const ancoras = [
  { hash: '#diferenciais', label: 'Diferenciais' },
  // o rótulo acompanha o título da seção: "Visite a loja" diz o que tem lá
  { hash: '#contato', label: 'Visite a loja' },
]

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const naHome = location.pathname === '/'

  /**
   * Com o menu aberto no celular, a página atrás continuava rolando e o Esc
   * não fechava nada. Trava a rolagem e escuta o Esc só enquanto está aberto.
   */
  useEffect(() => {
    if (!open) return

    function aoTeclar(evento) {
      if (evento.key === 'Escape') setOpen(false)
    }

    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', aoTeclar)

    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [open])

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

        <nav id="menu-principal" className={`header__nav ${open ? 'is-open' : ''}`}>
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

        {/* fundo escuro atrás do menu: dá contraste e fecha ao tocar fora */}
        {open && (
          <button
            type="button"
            className="header__backdrop"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
        )}

        <button
          type="button"
          className={`header__toggle ${open ? 'is-open' : ''}`}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="menu-principal"
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
