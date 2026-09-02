import { useEffect, useState } from 'react'
import { fraseDoEstado, proximosSeteDias } from '../lib/horarios'
import './VisiteALoja.css'

const WHATSAPP = '5543996335759'
const TELEFONE = '(43) 99633-5759'
const ENDERECO = 'R. Mal. Deodoro da Fonseca, 922'
const BAIRRO = 'Centro — Santo Antônio da Platina, PR'
const CEP = '86430-000'

const ENDERECO_COMPLETO = `${ENDERECO}, ${BAIRRO}, ${CEP}`

const MAPA = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  ENDERECO_COMPLETO
)}`

// Mapa embutido SEM chave de API: o "output=embed" é a versão pública e gratuita
// do Google Maps. A alternativa (Static Maps) exige chave e cartão cadastrado.
const MAPA_EMBUTIDO = `https://www.google.com/maps?q=${encodeURIComponent(
  ENDERECO_COMPLETO
)}&z=16&output=embed`

/**
 * "Visite a loja": o que alguém procura no site de uma loja física — se está
 * aberta agora, até que horas, onde fica e como falar com ela.
 *
 * Ficou no lugar dos depoimentos e absorveu a seção de contato, mantendo a
 * âncora #contato do menu. O horário de sábado muda conforme a semana do mês,
 * e essa é justamente a informação que ninguém decifra lendo uma linha corrida
 * de texto — aqui o site responde por quem pergunta.
 */
function VisiteALoja() {
  // recalcula a cada minuto: quem deixa a aba aberta não fica vendo "aberto"
  // depois de a loja ter fechado
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const estado = fraseDoEstado(agora)
  const semana = proximosSeteDias(agora)

  return (
    <section id="contato" className="section visite">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Onde nos encontrar</span>
          <h2>Visite a loja</h2>
        </div>

        <div className="visite__grid">
          {/* ---------- horários ---------- */}
          <div className="visite__bloco">
            <p className={`visite__estado ${estado.aberta ? 'is-aberta' : ''}`}>
              <span className="visite__ponto" aria-hidden="true" />
              <strong>{estado.texto}</strong>
              {estado.detalhe && <span className="visite__detalhe">{estado.detalhe}</span>}
            </p>

            <table className="visite__horarios">
              <caption className="visite__legenda">Horário de funcionamento</caption>
              <tbody>
                {semana.map((dia) => (
                  <tr
                    key={dia.data.toISOString()}
                    className={`${dia.hoje ? 'is-hoje' : ''} ${dia.fechado ? 'is-fechado' : ''}`}
                  >
                    <th scope="row">
                      {dia.nome}
                      {dia.detalhe && <small>{dia.detalhe}</small>}
                    </th>
                    <td>{dia.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------- endereço e contato ---------- */}
          <div className="visite__bloco">
            {/*
              Miniatura do mapa acima do endereço: quem procura uma loja física
              quer reconhecer a esquina antes de ler a rua. O loading="lazy" é o
              que impede que ela pese na abertura da home — o mapa só é baixado
              quando a pessoa rola até aqui, e ele sozinho passa de 400 KB.
            */}
            <div className="visite__mapa">
              <iframe
                src={MAPA_EMBUTIDO}
                title={`Mapa: ${ENDERECO}`}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <address className="visite__endereco">
              <strong>{ENDERECO}</strong>
              <span>{BAIRRO}</span>
              <span>CEP {CEP}</span>
            </address>

            <div className="visite__acoes">
              <a
                className="btn btn-dark"
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noreferrer"
              >
                Falar no WhatsApp
              </a>
              <a className="btn btn-claro" href={MAPA} target="_blank" rel="noreferrer">
                Ver no mapa
              </a>
            </div>

            {/* tel: vira ligação de um toque no celular e é ignorado no desktop */}
            <p className="visite__telefone">
              Ou ligue para <a href={`tel:+55${WHATSAPP.slice(2)}`}>{TELEFONE}</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default VisiteALoja
