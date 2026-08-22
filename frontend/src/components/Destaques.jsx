import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import ProdutoCard from './ProdutoCard'
import Lightbox from './Lightbox'
import './Destaques.css'

function Destaques() {
  const [produtos, setProdutos] = useState(null)
  const [ampliado, setAmpliado] = useState(null)

  useEffect(() => {
    let ativo = true
    api
      .destaques()
      .then((lista) => ativo && setProdutos(lista))
      .catch(() => ativo && setProdutos([]))
    return () => {
      ativo = false
    }
  }, [])

  // Sem destaques cadastrados (ou API fora do ar) a seção simplesmente não aparece.
  if (!produtos || produtos.length === 0) return null

  return (
    <section id="destaques" className="section destaques">
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow">Selecionados para você</span>
          <h2>Destaques da loja</h2>
          <p>Peças escolhidas a dedo pela nossa equipe. Passe na loja para experimentar.</p>
        </div>

        <div className="destaques__grid">
          {produtos.map((produto) => (
            <ProdutoCard key={produto.id} produto={produto} aoAmpliar={setAmpliado} />
          ))}
        </div>

        <div className="destaques__rodape">
          <Link to="/produtos" className="btn btn-dark">
            Ver todos os produtos
          </Link>
        </div>
      </div>

      {ampliado && <Lightbox produto={ampliado} aoFechar={() => setAmpliado(null)} />}
    </section>
  )
}

export default Destaques
