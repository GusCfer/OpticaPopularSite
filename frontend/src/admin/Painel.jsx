import { useState } from 'react'
import { useAuth } from './useAuth'
import ProdutosPainel from './ProdutosPainel'
import Consultas from './Consultas'
import logo from '../assets/Optica Popular - Logo Branco.png'
import './admin.css'

const ABAS = [
  { id: 'produtos', rotulo: 'Produtos', descricao: 'Catálogo de produtos' },
  { id: 'consultas', rotulo: 'Consultas', descricao: 'Agenda e lembretes' },
]

/** Casca do painel: cabeçalho, troca de aba e a tela escolhida. */
function Painel() {
  const { usuario, sair } = useAuth()
  const [aba, setAba] = useState('produtos')

  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0]

  return (
    <div className="painel">
      <header className="painel__topo">
        <div className="painel__marca">
          <img src={logo} alt="Óptica Popular" />
          <div>
            <strong>Painel administrativo</strong>
            <span>{atual.descricao}</span>
          </div>
        </div>
        <div className="painel__usuario">
          <span>
            {usuario?.nome} <em>({usuario?.papel})</em>
          </span>
          <a href="/" className="botao-link" target="_blank" rel="noreferrer">
            Ver site
          </a>
          <button type="button" className="botao-link" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <nav className="painel__abas" aria-label="Seções do painel">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`aba ${aba === a.id ? 'aba--ativa' : ''}`}
            aria-current={aba === a.id ? 'page' : undefined}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>

      <main className="painel__conteudo">
        {aba === 'consultas' ? <Consultas /> : <ProdutosPainel />}
      </main>
    </div>
  )
}

export default Painel
