import { useState } from 'react'
import { api, MAX_DESTAQUES } from '../services/api'
import GaleriaImagens from './GaleriaImagens'

const VAZIO = {
  nome: '',
  marca: '',
  descricao: '',
  preco: '',
  precoPromocional: '',
  categoriaId: '',
  ativo: true,
  destaque: false,
  imagens: [],
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
    // produto antigo, de antes da galeria, tinha só imagemUrl
    imagens: produto.imagens?.length ? produto.imagens : produto.imagemUrl ? [produto.imagemUrl] : [],
  }
}

// O Painel passa key={id}, então trocar de produto remonta o componente
// e o estado inicial abaixo já vem certo — sem useEffect de sincronização.
function ProdutoForm({ produto, categorias, destaquesUsados, aoSalvar, aoCancelar }) {
  const [form, setForm] = useState(() => estadoInicial(produto))
  const [erro, setErro] = useState('')
  const [detalhes, setDetalhes] = useState([])
  const [salvando, setSalvando] = useState(false)

  // Já está no limite e este produto ainda não é destaque? O check trava.
  const jaEraDestaque = produto?.destaque === true
  const limiteAtingido = !jaEraDestaque && destaquesUsados >= MAX_DESTAQUES

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
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
        <GaleriaImagens
          imagens={form.imagens}
          aoMudar={(lista) => alterar('imagens', lista)}
          desabilitado={salvando}
        />
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
        <button type="submit" className="btn btn-dark" disabled={salvando}>
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
