import { useState } from 'react'
import './Contact.css'

const WHATSAPP_NUMBER = '5543996335759'

function Contact() {
  const [sent, setSent] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    setSent(true)
  }

  return (
    <section id="contato" className="section contact">
      <div className="container contact__grid">
        <div>
          <div className="section-head">
            <span className="eyebrow">Contato</span>
            <h2>Vamos cuidar da sua visão</h2>
            <p>Preencha o formulário ou fale direto com a gente pelo WhatsApp.</p>
          </div>

          <ul className="contact__info">
            <li>
              <strong>Endereço</strong>
              <span>R. Mal. Deodoro da Fonseca, 922 - Santo Antônio da Platina, PR, 86430-000</span>
            </li>
            <li>
              <strong>Telefone / WhatsApp</strong>
              <span>(43) 99633-5759</span>
            </li>
            <li>
              <strong>Horário de funcionamento</strong>
              <span>Seg à Sex: 9h às 18h | Sáb 1 e 2 : 9h às 17h restante: 08:00 às 12:00</span>
            </li>
          </ul>

          <a
            className="btn btn-dark"
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
          >
            Falar no WhatsApp
          </a>
        </div>

        <form className="contact__form" onSubmit={handleSubmit}>
          <label>
            Nome
            <input type="text" name="name" required placeholder="Seu nome" />
          </label>
          <label>
            Telefone
            <input type="tel" name="phone" required placeholder="(00) 00000-0000" />
          </label>
          <label>
            Mensagem
            <textarea name="message" rows="4" placeholder="Como podemos ajudar?" />
          </label>
          <button type="submit" className="btn btn-primary">
            Enviar mensagem
          </button>
          {sent && <p className="contact__success">Recebemos sua mensagem! Em breve entraremos em contato.</p>}
        </form>
      </div>
    </section>
  )
}

export default Contact
