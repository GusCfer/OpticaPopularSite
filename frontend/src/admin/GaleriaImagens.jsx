import { useId, useRef, useState } from 'react'
import { api, MAX_IMAGENS } from '../services/api'
import { prepararImagem, ErroImagem, TIPOS_ACEITOS } from '../lib/imagem'

/**
 * Galeria de até 8 fotos do produto.
 *
 * Trabalha com a lista de URLs e avisa o formulário por `aoMudar` — quem salva
 * é o ProdutoForm, junto com o resto do produto. O upload aqui só sobe o
 * arquivo e devolve a URL; nada é gravado no produto até o Salvar.
 */
function GaleriaImagens({ imagens, aoMudar, desabilitado }) {
  const [erros, setErros] = useState([])
  const [progresso, setProgresso] = useState('')
  const idArquivo = useId()
  const idCamera = useId()
  const inputArquivo = useRef(null)
  const inputCamera = useRef(null)

  const restantes = MAX_IMAGENS - imagens.length
  const ocupado = progresso !== '' || desabilitado

  async function receberArquivos(evento) {
    const escolhidos = Array.from(evento.target.files || [])
    // libera o input na hora: sem isso, escolher a mesma foto de novo não dispara o change
    evento.target.value = ''
    if (escolhidos.length === 0) return

    setErros([])
    const problemas = []

    let aceitos = escolhidos
    if (escolhidos.length > restantes) {
      aceitos = escolhidos.slice(0, restantes)
      problemas.push(
        `Você escolheu ${escolhidos.length} fotos e só cabem mais ${restantes}. ` +
          `As ${escolhidos.length - restantes} últimas foram ignoradas.`
      )
    }

    const prontos = []
    try {
      for (let i = 0; i < aceitos.length; i += 1) {
        setProgresso(`Preparando ${i + 1} de ${aceitos.length}…`)
        try {
          prontos.push(await prepararImagem(aceitos[i]))
        } catch (err) {
          // uma foto ruim não derruba as outras
          problemas.push(err instanceof ErroImagem ? err.message : `Falha em "${aceitos[i].name}".`)
        }
      }

      if (prontos.length > 0) {
        setProgresso(prontos.length === 1 ? 'Enviando…' : `Enviando ${prontos.length} fotos…`)
        const resposta = await api.enviarImagens(prontos)
        const novas = (resposta.imagens || []).map((img) => img.url)
        aoMudar([...imagens, ...novas].slice(0, MAX_IMAGENS))
      }
    } catch (err) {
      problemas.push(err.message || 'Não consegui enviar as fotos.')
    } finally {
      setProgresso('')
      setErros(problemas)
    }
  }

  function remover(indice) {
    aoMudar(imagens.filter((_, i) => i !== indice))
  }

  /** Troca a foto de lugar com a vizinha. A primeira da lista é a capa. */
  function mover(indice, passo) {
    const destino = indice + passo
    if (destino < 0 || destino >= imagens.length) return
    const lista = [...imagens]
    ;[lista[indice], lista[destino]] = [lista[destino], lista[indice]]
    aoMudar(lista)
  }

  return (
    <div className="galeria">
      <div className="galeria__cabecalho">
        <span>Fotos do produto</span>
        <small className={restantes === 0 ? 'galeria__contador galeria__contador--cheio' : 'galeria__contador'}>
          {imagens.length} de {MAX_IMAGENS}
        </small>
      </div>

      {imagens.length > 0 && (
        <ul className="galeria__grade">
          {imagens.map((url, i) => (
            <li className="galeria__item" key={url}>
              <img src={url} alt={`Foto ${i + 1} do produto`} loading="lazy" />

              {i === 0 && <span className="galeria__capa">Capa</span>}

              <div className="galeria__controles">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0 || ocupado}
                  aria-label={`Mover a foto ${i + 1} para trás`}
                  title="Mover para trás"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="galeria__remover"
                  onClick={() => remover(i)}
                  disabled={ocupado}
                  aria-label={`Remover a foto ${i + 1}`}
                  title="Remover"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === imagens.length - 1 || ocupado}
                  aria-label={`Mover a foto ${i + 1} para frente`}
                  title="Mover para frente"
                >
                  ›
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {imagens.length === 0 && !progresso && (
        <p className="galeria__vazio">Nenhuma foto ainda. A primeira que você adicionar vira a capa.</p>
      )}

      <div className="galeria__acoes">
        {/* input escondido: o <label> é que vira botão, e fica estilizado como os outros */}
        <input
          ref={inputArquivo}
          id={idArquivo}
          type="file"
          className="galeria__input"
          accept={TIPOS_ACEITOS.join(',')}
          multiple
          onChange={receberArquivos}
          disabled={ocupado || restantes === 0}
        />
        <label htmlFor={idArquivo} className={`galeria__botao ${ocupado || restantes === 0 ? 'is-off' : ''}`}>
          Escolher fotos
        </label>

        {/* capture abre a câmera nativa do aparelho; no desktop o CSS esconde este botão */}
        <input
          ref={inputCamera}
          id={idCamera}
          type="file"
          className="galeria__input"
          accept="image/*"
          capture="environment"
          onChange={receberArquivos}
          disabled={ocupado || restantes === 0}
        />
        <label
          htmlFor={idCamera}
          className={`galeria__botao galeria__botao--camera ${ocupado || restantes === 0 ? 'is-off' : ''}`}
        >
          Tirar foto
        </label>
      </div>

      {progresso && <p className="galeria__progresso">{progresso}</p>}

      {restantes === 0 && !progresso && (
        <small className="galeria__dica">Limite de {MAX_IMAGENS} fotos. Remova uma para adicionar outra.</small>
      )}

      {imagens.length > 1 && !progresso && (
        <small className="galeria__dica">Use ‹ e › para reordenar. A primeira aparece na home e no catálogo.</small>
      )}

      {erros.length > 0 && (
        <ul className="galeria__erros">
          {erros.map((mensagem) => (
            <li key={mensagem}>{mensagem}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default GaleriaImagens
