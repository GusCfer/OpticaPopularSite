import { Link } from 'react-router-dom'
import logo from '../assets/Optica Popular - Logo Branco.png'
import { faixaDoDia } from '../lib/horarios'
import { WHATSAPP } from '../lib/compartilhar'
import './Footer.css'

const year = new Date().getFullYear()

const ENDERECO = 'R. Mal. Deodoro da Fonseca, 922'
const CIDADE = 'Centro, Santo Antônio da Platina, PR'
const CEP = '86430-000'
const TELEFONE = '(43) 99633-5759'

const MAPA = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${ENDERECO}, ${CIDADE}, ${CEP}`
)}`

/**
 * O horário vem do horarios.js, que é a fonte única: se a loja mudar o
 * expediente, o rodapé acompanha sozinho. Datas fixas de janeiro/2024 servem
 * só de amostra (dia 1 foi segunda; dias 6 e 20, 1º e 3º sábados).
 */
function texto(faixa) {
  return faixa ? `${faixa.inicio} às ${faixa.fim}` : 'Fechado'
}

const horarios = [
  { dia: 'Segunda a sexta', hora: texto(faixaDoDia(new Date(2024, 0, 1))) },
  { dia: '1º e 2º sábado', hora: texto(faixaDoDia(new Date(2024, 0, 6))) },
  { dia: 'Demais sábados', hora: texto(faixaDoDia(new Date(2024, 0, 20))) },
  { dia: 'Domingo', hora: texto(faixaDoDia(new Date(2024, 0, 7))) },
]

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__marca">
          <Link to="/" className="footer__logo">
            <img src={logo} alt="Óptica Popular" />
          </Link>
          <p>
            Cuidando da sua visão com <em>estilo e proximidade</em>.
          </p>
        </div>

        <nav className="footer__col" aria-label="Rodapé">
          <h2 className="footer__titulo">Navegue</h2>
          <ul>
            <li>
              <Link to="/produtos">Produtos</Link>
            </li>
            <li>
              <a href="/#vitrine">Vitrine</a>
            </li>
            <li>
              <a href="/#contato">Visite a loja</a>
            </li>
          </ul>
        </nav>

        <div className="footer__col">
          <h2 className="footer__titulo">Contato</h2>
          <address>
            <a href={MAPA} target="_blank" rel="noreferrer">
              {ENDERECO}
              <br />
              {CIDADE}
              <br />
              CEP {CEP}
            </a>
          </address>
          <a
            className="footer__whatsapp"
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp {TELEFONE}
          </a>
        </div>

        <div className="footer__col">
          <h2 className="footer__titulo">Horário</h2>
          <dl className="footer__horarios">
            {horarios.map((h) => (
              <div key={h.dia}>
                <dt>{h.dia}</dt>
                <dd>{h.hora}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="container footer__bottom">
        <span>&copy; {year} Óptica Popular. Todos os direitos reservados.</span>
        <span>Desenvolvido por Carvalho</span>
      </div>
    </footer>
  )
}

export default Footer
