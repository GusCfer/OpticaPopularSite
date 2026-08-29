/**
 * Prepara a foto no navegador, antes de enviar.
 *
 * Foto de celular tem 3 a 6 MB e uns 4000px de largura. O catálogo mostra no
 * máximo ~1600px, então todo o resto é dado jogado fora: do 4G da loja, do
 * disco do servidor e do tempo de quem abre o site. Reduzir aqui resolve os
 * três de uma vez.
 *
 * Reencodar sempre, mesmo quando a foto já é pequena, tem um segundo motivo:
 * o canvas descarta os metadados EXIF — e foto de celular costuma carregar a
 * localização GPS de onde foi tirada. Não é dado que deva ir parar num
 * arquivo público do catálogo.
 */

export const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const TAMANHO_MAX_MB = 5

/** Erro com mensagem pronta para mostrar ao usuário. */
export class ErroImagem extends Error {}

/** Valida antes de processar: evita gastar CPU com arquivo que seria recusado. */
export function validarArquivo(arquivo) {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new ErroImagem(`"${arquivo.name}" não é uma imagem JPG, PNG, WEBP ou AVIF.`)
  }
  if (arquivo.size > TAMANHO_MAX_MB * 1024 * 1024) {
    const mb = (arquivo.size / 1024 / 1024).toFixed(1)
    throw new ErroImagem(`"${arquivo.name}" tem ${mb} MB — o limite é ${TAMANHO_MAX_MB} MB.`)
  }
}

/**
 * Decodifica o arquivo respeitando a orientação da câmera.
 *
 * Sem o imageOrientation, foto tirada com o celular deitado aparece girada:
 * o EXIF diz "gire 90°" e o canvas ignora isso por padrão.
 */
async function decodificar(arquivo) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    } catch {
      /* navegador antigo sem a opção: cai no <img> abaixo */
    }
  }

  const url = URL.createObjectURL(arquivo)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new ErroImagem(`Não consegui abrir "${arquivo.name}".`))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function extensaoDe(tipo) {
  return tipo === 'image/webp' ? 'webp' : 'jpg'
}

/**
 * Reduz e recomprime. Devolve um File novo, pronto para o upload.
 *
 * @param {File} arquivo
 * @param {{maxLado?: number, qualidade?: number}} opcoes
 */
export async function prepararImagem(arquivo, { maxLado = 1600, qualidade = 0.82 } = {}) {
  validarArquivo(arquivo)

  const fonte = await decodificar(arquivo)
  const largura = fonte.width
  const altura = fonte.height

  // só encolhe; foto menor que o limite mantém o tamanho original
  const escala = Math.min(1, maxLado / Math.max(largura, altura))
  const w = Math.max(1, Math.round(largura * escala))
  const h = Math.max(1, Math.round(altura * escala))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, 0, 0, w, h)
  if (typeof fonte.close === 'function') fonte.close()

  const blob = await new Promise((resolve) => {
    // Safari antigo ignora o webp e devolve png; o tipo do blob revela o que
    // realmente saiu, e é ele que decide a extensão.
    canvas.toBlob((b) => resolve(b), 'image/webp', qualidade)
  })

  if (!blob) throw new ErroImagem(`Não consegui processar "${arquivo.name}".`)

  const base = arquivo.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${base}.${extensaoDe(blob.type)}`, {
    type: blob.type,
    lastModified: Date.now(),
  })
}
