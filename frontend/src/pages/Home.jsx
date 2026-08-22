import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Hero from '../components/Hero'
import Destaques from '../components/Destaques'
import Features from '../components/Features'
import Testimonials from '../components/Testimonials'
import Contact from '../components/Contact'

function Home() {
  const location = useLocation()
  const rolarPara = location.state?.rolarPara

  // quando o usuário clica em "Contato" estando na página de produtos,
  // o Header manda pra cá e a Home rola até a seção pedida
  useEffect(() => {
    if (!rolarPara) return
    const alvo = document.querySelector(rolarPara)
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth' })
  }, [rolarPara])

  return (
    <>
      <Hero />
      <Destaques />
      <Features />
      <Testimonials />
      <Contact />
    </>
  )
}

export default Home
