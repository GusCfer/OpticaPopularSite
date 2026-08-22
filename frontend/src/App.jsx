import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'
import Home from './pages/Home'
import Produtos from './pages/Produtos'
import { AuthProvider } from './admin/AuthProvider'
import RotaProtegida from './admin/RotaProtegida'
import Login from './admin/Login'
import Painel from './admin/Painel'

/** Header/Footer/WhatsApp são do site público — o painel não usa. */
function Site() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/produtos" element={<Produtos />} />
      </Routes>
      <Footer />
      <WhatsAppButton />
    </>
  )
}

function Rotas() {
  const location = useLocation()
  const noAdmin = location.pathname.startsWith('/admin')

  if (noAdmin) {
    return (
      <Routes>
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <RotaProtegida>
              <Painel />
            </RotaProtegida>
          }
        />
      </Routes>
    )
  }

  return <Site />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
