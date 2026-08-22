import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import logo from '../assets/Optica Popular - Logo Branco.png'
import './admin.css'

function Login() {
  const { entrar, usuario, carregando } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (carregando) return <div className="admin-carregando">Carregando…</div>
  if (usuario) return <Navigate to="/admin" replace />

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email, senha)
      navigate('/admin', { replace: true })
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={aoEnviar}>
        <img src={logo} alt="Óptica Popular" className="login__logo" />
        <h1>Painel administrativo</h1>
        <p className="login__sub">Entre para gerenciar os produtos do site.</p>

        {erro && <div className="alerta alerta--erro">{erro}</div>}

        <label className="campo">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="campo">
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="btn btn-primary login__botao" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

export default Login
