/**
 * Link compartilhável do produto.
 *
 * Um único lugar decide como o link é montado, porque ele aparece em três
 * situações que precisam concordar entre si: o botão "Copiar link", a mensagem
 * do WhatsApp e a rota que o React registra ao abrir a foto ampliada. Se
 * divergissem, o cliente receberia um endereço que não abre no produto certo.
 */

export const WHATSAPP = '5543996335759'

/** Caminho interno usado pelo react-router: /produto/aviator-classic */
export function rotaDoProduto(produto) {
  return `/produto/${produto?.slug ?? ''}`
}

/**
 * Endereço completo, o que vai colado na conversa.
 *
 * A origem sai do próprio navegador de propósito: em produção dá
 * https://opticapopularsap.com.br, e durante os testes dá o localhost — sem
 * precisar de variável de ambiente nem de link quebrado no desenvolvimento.
 */
export function linkDoProduto(produto) {
  const origem = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origem}${rotaDoProduto(produto)}`
}

/**
 * Conversa no WhatsApp já com o link do produto.
 *
 * O link vai numa linha só dele: o WhatsApp só transforma em prévia (com foto e
 * preço) quando o endereço não está grudado no texto.
 */
export function linkWhatsApp(produto) {
  const texto = `Olá! Tenho interesse neste produto: ${produto.nome}\n${linkDoProduto(produto)}`
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`
}

/**
 * Copia para a área de transferência.
 *
 * navigator.clipboard só existe em HTTPS (ou localhost) e pode ser recusado
 * pelo navegador; por isso o caminho antigo com execCommand continua aqui como
 * reserva. Devolve true/false para a tela avisar se deu certo.
 */
export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    /* recusado — cai na reserva abaixo */
  }

  try {
    const campo = document.createElement('textarea')
    campo.value = texto
    // fora da vista, mas ainda selecionável: display:none impediria a cópia
    campo.setAttribute('readonly', '')
    campo.style.position = 'fixed'
    campo.style.top = '-1000px'
    document.body.appendChild(campo)
    campo.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(campo)
    return ok
  } catch {
    return false
  }
}
