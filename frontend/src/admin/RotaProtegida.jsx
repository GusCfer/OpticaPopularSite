import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

function RotaProtegida({ children }) {
  const { usuario, carregando } = useAuth()
  const location = useLocation()

  if (carregando) {
    return <div className="admin-carregando">Carregando…</div>
  }

  if (!usuario) {
    return <Navigate to="/admin/login" state={{ de: location.pathname }} replace />
  }

  return children
}

export default RotaProtegida
