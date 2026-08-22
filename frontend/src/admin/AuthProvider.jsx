import { useEffect, useMemo, useState } from 'react'
import { api, setToken, getToken } from '../services/api'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  // Só entra em "carregando" se existe token pra validar.
  const [carregando, setCarregando] = useState(() => Boolean(getToken()))

  // Ao abrir o painel, confere o token guardado contra a API.
  useEffect(() => {
    if (!getToken()) return undefined

    let ativo = true
    api
      .eu()
      .then((dados) => {
        if (ativo) setUsuario(dados)
      })
      .catch(() => {
        setToken(null)
        if (ativo) setUsuario(null)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  const valor = useMemo(
    () => ({
      usuario,
      carregando,
      async entrar(email, senha) {
        const { token, usuario: dados } = await api.login(email, senha)
        setToken(token)
        setUsuario(dados)
        return dados
      },
      sair() {
        setToken(null)
        setUsuario(null)
      },
    }),
    [usuario, carregando]
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
