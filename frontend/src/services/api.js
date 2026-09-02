// Vazio de propósito em produção: com o Nginx na frente, site e API ficam na
// mesma origem e as chamadas viram /api/... (sem CORS, sem domínio no build).
// O ?? mantém a string vazia; só cai no localhost quando a variável nem existe.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333').replace(/\/$/, '')

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
  /** Catálogo paginado. Resposta: { itens, total, pagina, porPagina, paginas } */
  produtos: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString()
    return request(`/api/produtos${qs ? `?${qs}` : ''}`)
  },
  /** Um produto pelo slug — é assim que o link compartilhado abre a foto certa. */
  produtoPorSlug: (slug) => request(`/api/produtos/slug/${encodeURIComponent(slug)}`),
  /** Vitrine da home: produtos sorteados pelo servidor, só os que têm foto. */
  vitrine: (limite = 12) => request(`/api/produtos/vitrine?limite=${Number(limite) || 12}`),

  // ---- autenticação ----
  login: (email, senha) => request('/api/auth/login', { method: 'POST', body: { email, senha } }),
  eu: () => request('/api/auth/eu', { auth: true }),
  alterarSenha: (senhaAtual, senhaNova) =>
    request('/api/auth/senha', { method: 'POST', auth: true, body: { senhaAtual, senhaNova } }),

  // ---- admin ----
  /** Igual ao público, mas com token: traz inativos e o total de destaques. */
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
  /** Envia a galeria de uma vez. Resposta: { imagens: [{ caminho, url, tamanho }] } */
  enviarImagens: (arquivos) => {
    const form = new FormData()
    for (const arquivo of arquivos) form.append('imagens', arquivo)
    return request('/api/upload', { method: 'POST', auth: true, body: form, raw: true })
  },
  // ---- consultas (agenda) ----
  consultas: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString()
    return request(`/api/consultas${qs ? `?${qs}` : ''}`, { auth: true })
  },
  resumoConsultas: () => request('/api/consultas/resumo', { auth: true }),
  medicos: () => request('/api/consultas/medicos', { auth: true }),
  criarConsulta: (dados) => request('/api/consultas', { method: 'POST', auth: true, body: dados }),
  atualizarConsulta: (id, dados) =>
    request(`/api/consultas/${id}`, { method: 'PUT', auth: true, body: dados }),
  definirStatusConsulta: (id, status) =>
    request(`/api/consultas/${id}/status`, { method: 'PATCH', auth: true, body: { status } }),
  excluirConsulta: (id) => request(`/api/consultas/${id}`, { method: 'DELETE', auth: true }),
  enviarLembrete: (id) => request(`/api/consultas/${id}/lembrete`, { method: 'POST', auth: true }),
  rodarLembretes: (dia) =>
    request('/api/consultas/lembretes/rodar', { method: 'POST', auth: true, body: { dia } }),
  statusEmail: () => request('/api/consultas/email/status', { auth: true }),
  testarEmail: () => request('/api/consultas/email/testar', { method: 'POST', auth: true }),

}

export const MAX_DESTAQUES = 4
export const MAX_IMAGENS = 8

export const STATUS_CONSULTA = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
}

/** "2026-08-26T14:30" -> "26/08/2026" */
export function formatarData(dataHora) {
  if (!dataHora) return ''
  const [a, m, d] = dataHora.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** "2026-08-26T14:30" -> "14:30" */
export function formatarHora(dataHora) {
  return dataHora ? dataHora.slice(11, 16) : ''
}

/** "2026-08-26T14:30" -> "qua, 26/08 às 14:30" */
export function formatarDataHora(dataHora) {
  if (!dataHora) return ''
  const [a, m, d] = dataHora.slice(0, 10).split('-').map(Number)
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' })
    .format(new Date(Date.UTC(a, m - 1, d, 12)))
    .replace('.', '')
  return `${dia}, ${formatarData(dataHora)} às ${formatarHora(dataHora)}`
}

export function formatarPreco(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default request
