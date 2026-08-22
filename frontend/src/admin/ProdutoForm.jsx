import { useRef, useState } from 'react'
import { api, MAX_DESTAQUES } from '../services/api'

const VAZIO = {
  nome: '',
  marca: '',
  descricao: '',
  preco: '',
  precoPromocional: '',
  categoriaId: '',
  ativo: true,
  destaque: false,
  imagemUrl: '',
}

function estadoInicial(produto) {
  if (!produto) return VAZIO
  return {
    nome: produto.nome || '',
    marca: produto.marca || '',
    descricao: produto.descricao || '',
    preco: produto.preco ?? '',
    precoPromocional: produto.precoPromocional ?? '',
    categoriaId: produto.categoriaId || '',
    ativo: produto.ativo ?? true,
    destaque: produto.destaque ?? false,
    imagemUrl: produto.imagemUrl || '',
  }
}

// O Painel passa key={id}, então trocar de produto remonta o componente
// e o estado inicial abaixo já vem certo — sem useEffect de sincronização.
function ProdutoForm({ produto, categorias, destaquesUsados, aoSalvar, aoCancelar }) {
  const [form, setForm] = useState(() => estadoInicial(produto))
  const [previa, setPrevia] = useState(() => produto?.imagemUrl || '')
  const [erro, setErro] = useState('')
  const [detalhes, setDetalhes] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const inputArquivo = useRef(null)

  // Já está no limite e este produto ainda não é destaque? O check trava.
  const jaEraDestaque = produto?.destaque === true
  const limiteAtingido = !jaEraDestaque && destaquesUsados >= MAX_DESTAQUES

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function aoEscolherImagem(evento) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return

    setErro('')
    setEnviandoImagem(true)
    try {
      const { url } = await api.enviarImagem(arquivo)
      alterar('imagemUrl', url)
      setPrevia(url)
    } catch (err) {
      setErro(err.message || 'Falha ao enviar a imagem')
    } finally {
      setEnviandoImagem(false)
      if (inputArquivo.current) inputArquivo.current.value = ''
    }
  }

  async function enviar(evento) {
    evento.preventDefault()
    setErro('')
    setDetalhes([])
    setSalvando(true)

    const dados = {
      ...form,
      categoriaId: Number(form.categoriaId),
      precoPromocional: form.precoPromocional === '' ? null : form.precoPromocional,
    }

    try {
      const salvo = produto
        ? await api.atualizarProduto(produto.id, dados)
        : await api.criarProduto(dados)
      aoSalvar(salvo)
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar')
      setDetalhes(err.detalhes || [])
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className="painel__form" onSubmit={enviar}>
      <h2>{produto ? 'Editar produto' : 'Novo produto'}</h2>

      {erro && (
        <div className="alerta alerta--erro">
          {erro}
          {detalhes.length > 0 && (
            <ul>
              {detalhes.map((d) => (
                <li key={d.campo}>
                  {d.campo}: {d.mensagem}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="campo">
        <span>Nome *</span>
        <input
          value={form.nome}
          onChange={(e) => alterar('nome', e.target.value)}
          maxLength={120}
          required
        />
      </label>

      <div className="campo-linha">
        <label className="campo">
          <span>Categoria *</span>
          <select
            value={form.categoriaId}
            onChange={(e) => alterar('categoriaId', e.target.value)}
            required
          >
            <option value="">Selecione…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          <span>Marca</span>
          <input
            value={form.marca}
            onChange={(e) => alterar('marca', e.target.value)}
            maxLength={80}
          />
        </label>
      </div>

      <div className="campo-linha">
        <label className="campo">
          <span>Preço (R$) *</span>
          <input
            value={form.preco}
            onChange={(e) => alterar('preco', e.target.value)}
            inputMode="decimal"
            placeholder="249,90"
            required
          />
        </label>

        <label className="campo">
          <span>Preço promocional</span>
          <input
            value={form.precoPromocional ?? ''}
            onChange={(e) => alterar('precoPromocional', e.target.value)}
            inputMode="decimal"
            placeholder="opcional"
          />
        </label>
      </div>

      <label className="campo">
        <span>Descrição</span>
        <textarea
          value={form.descricao}
          onChange={(e) => alterar('descricao', e.target.value)}
          rows={3}
          maxLength={4000}
        />
      </label>

      <div className="campo">
        <span>Imagem</span>
        <div className="upload">
          <div className="upload__previa">
            {previa ? <img src={previa} alt="Prévia" /> : <span>Sem imagem</span>}
          </div>
          <div className="upload__acoes">
            <input
              ref={inputArquivo}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={aoEscolherImagem}
              disabled={enviandoImagem}
            />
            <small>JPG, PNG, WEBP ou AVIF — até 5 MB.</small>
            {enviandoImagem && <small>Enviando…</small>}
            {previa && (
              <button
                type="button"
                className="botao-link"
                onClick={() => {
                  alterar('imagemUrl', '')
                  setPrevia('')
                }}
              >
                Remover imagem
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="campo-checks">
        <label className="check">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => alterar('ativo', e.target.checked)}
          />
          <span>Ativo (visível no site)</span>
        </label>

        <label className={`check ${limiteAtingido ? 'check--travado' : ''}`}>
          <input
            type="checkbox"
            checked={form.destaque}
            disabled={limiteAtingido}
            onChange={(e) => alterar('destaque', e.target.checked)}
          />
          <span>
            Destaque na home
            {limiteAtingido && ` — limite de ${MAX_DESTAQUES} atingido`}
          </span>
        </label>
      </div>

      <div className="painel__form-acoes">
        <button type="submit" className="btn btn-dark" disabled={salvando || enviandoImagem}>
          {salvando ? 'Salvando…' : produto ? 'Salvar alterações' : 'Cadastrar produto'}
        </button>
        <button type="button" className="botao-link" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default ProdutoForm
