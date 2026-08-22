import './Testimonials.css'

const testimonials = [
  {
    name: 'Marina S.',
    text: 'Atendimento excelente, me ajudaram a escolher a armação ideal para o formato do meu rosto.',
  },
  {
    name: 'Roberto A.',
    text: 'Fiz o exame de vista e já saí com o óculos pronto em poucos dias. Recomendo!',
  },
  {
    name: 'Juliana P.',
    text: 'Preço justo e parcelamento que cabe no orçamento. Voltarei para o próximo par.',
  },
]

function Testimonials() {
  return (
    <section id="depoimentos" className="section testimonials">
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow">Depoimentos</span>
          <h2>Quem já visitou, recomenda</h2>
        </div>

        <div className="testimonials__grid">
          {testimonials.map((testimonial) => (
            <blockquote className="testimonials__card" key={testimonial.name}>
              <p>&ldquo;{testimonial.text}&rdquo;</p>
              <cite>{testimonial.name}</cite>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials
