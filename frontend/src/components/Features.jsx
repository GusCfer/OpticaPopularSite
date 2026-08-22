import './Features.css'

const features = [
  {
    title: 'Exame de vista',
    text: 'Avaliação completa com equipamento moderno para um diagnóstico preciso.',
  },
  {
    title: 'Ampla variedade',
    text: 'Armações e lentes para todos os estilos, idades e orçamentos.',
  },
  {
    title: 'Parcelamento facilitado',
    text: 'Condições de pagamento que cabem no seu bolso.',
  },
  {
    title: 'Garantia e ajuste',
    text: 'Suporte pós-venda com ajustes e manutenção gratuitos.',
  },
]

function Features() {
  return (
    <section id="diferenciais" className="section features">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Por que escolher a Óptica Popular</span>
          <h2>Cuidado com a sua visão, do início ao fim</h2>
        </div>

        <div className="features__grid">
          {features.map((feature, index) => (
            <div className="features__item" key={feature.title}>
              <span className="features__index">{String(index + 1).padStart(2, '0')}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
