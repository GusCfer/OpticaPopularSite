const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/$/, '')

const CHAVE_TOKEN = 'otica.admin.token'

export function getToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, token)
    else localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    /* modo anônimo: segue sem persistir */
  }
}

export class ErroApi extends Error {
  constructor(mensagem, status, codigo, detalhes) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
    this.detalhes = detalhes
  }
}

async function request(path, { method = 'GET', body, auth = false, raw = false } = {}) {
  const headers = {}
  if (!raw && body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const resposta = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (resposta.status === 204) return null

  const texto = await resposta.text()
  const dados = texto ? JSON.parse(texto) : null

  if (!resposta.ok) {
    if (resposta.status === 401 && auth) setToken(null)
    throw new ErroApi(
      dados?.erro || `Erro ${resposta.status}`,
      resposta.status,
      dados?.codigo,
      dados?.detalhes
    )
  }

  return dados
}

export const api = {
  // ---- público ----
  destaques: () => request('/api/produtos/destaques'),
  categorias: () => request('/api/categorias'),
  produtos: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString()
    return request(`/api/produtos${qs ? `?${qs}` : ''}`)
  },

  // ---- autenticação ----
  login: (email, senha) => request('/api/auth/login', { method: 'POST', body: { email, senha } }),
  eu: () => request('/api/auth/eu', { auth: true }),
  alterarSenha: (senhaAtual, senhaNova) =>
    request('/api/auth/senha', { method: 'POST', auth: true, body: { senhaAtual, senhaNova } }),

  // ---- admin ----
  produtosAdmin: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString()
    return request(`/api/produtos${qs ? `?${qs}` : ''}`, { auth: true })
  },
  criarProduto: (dados) => request('/api/produtos', { method: 'POST', auth: true, body: dados }),
  atualizarProduto: (id, dados) =>
    request(`/api/produtos/${id}`, { method: 'PUT', auth: true, body: dados }),
  definirDestaque: (id, destaque) =>
    request(`/api/produtos/${id}/destaque`, { method: 'PATCH', auth: true, body: { destaque } }),
  excluirProduto: (id) => request(`/api/produtos/${id}`, { method: 'DELETE', auth: true }),
  enviarImagem: (arquivo) => {
    const form = new FormData()
    form.append('imagem', arquivo)
    return request('/api/upload', { method: 'POST', auth: true, body: form, raw: true })
  },
}

export const MAX_DESTAQUES = 5

export function formatarPreco(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default request
