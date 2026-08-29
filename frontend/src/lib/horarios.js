/**
 * Horário de funcionamento da loja e cálculo de "aberto agora".
 *
 * A regra do sábado é a que justifica existir este arquivo: o 1º e o 2º sábado
 * do mês têm horário diferente dos demais. Escrita numa linha de texto, ela é
 * praticamente indecifrável para quem só quer saber se pode passar lá hoje.
 *
 * Módulo puro, sem React: dá para testar cada regra isoladamente.
 */

/** 0 = domingo … 6 = sábado. Null = fechado. */
const SEMANA = {
  1: { inicio: '08:00', fim: '18:00' },
  2: { inicio: '08:00', fim: '18:00' },
  3: { inicio: '08:00', fim: '18:00' },
  4: { inicio: '08:00', fim: '18:00' },
  5: { inicio: '08:00', fim: '18:00' },
}

const SABADO_INICIO_DO_MES = { inicio: '09:00', fim: '17:00' } // 1º e 2º sábado
const SABADO_DEMAIS = { inicio: '08:00', fim: '12:00' }

export const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Qual sábado do mês esta data é: 1 para o primeiro, 2 para o segundo… */
export function ordemDoSabadoNoMes(data) {
  return Math.floor((data.getDate() - 1) / 7) + 1
}

/** Faixa de funcionamento da data, ou null se a loja fecha nesse dia. */
export function faixaDoDia(data) {
  const dia = data.getDay()
  if (dia === 6) {
    return ordemDoSabadoNoMes(data) <= 2 ? SABADO_INICIO_DO_MES : SABADO_DEMAIS
  }
  return SEMANA[dia] ?? null
}

function emMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Estado da loja no instante informado.
 * @returns {{aberta: boolean, faixa: object|null, fechaEm: string|null, abreEm: string|null}}
 */
export function estadoAgora(agora = new Date()) {
  const faixa = faixaDoDia(agora)
  if (!faixa) return { aberta: false, faixa: null, fechaEm: null, abreEm: null }

  const minutos = agora.getHours() * 60 + agora.getMinutes()
  const inicio = emMinutos(faixa.inicio)
  const fim = emMinutos(faixa.fim)

  if (minutos < inicio) return { aberta: false, faixa, fechaEm: null, abreEm: faixa.inicio }
  if (minutos >= fim) return { aberta: false, faixa, fechaEm: null, abreEm: null }
  return { aberta: true, faixa, fechaEm: faixa.fim, abreEm: null }
}

/**
 * Os sete dias a partir de hoje, para a tabela.
 * Começar em hoje (e não no domingo) põe a informação mais útil em cima.
 */
export function proximosSeteDias(agora = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const data = new Date(agora)
    data.setDate(agora.getDate() + i)
    const faixa = faixaDoDia(data)
    // O sábado tem duas regras; dizer qual está valendo evita a dúvida de
    // "esse horário é o meu?". Nos outros dias, a linha "Hoje" ganha o nome do
    // dia da semana, que some quando o rótulo já é o próprio nome.
    let detalhe = null
    if (data.getDay() === 6) {
      detalhe = ordemDoSabadoNoMes(data) <= 2 ? '1º e 2º sábado do mês' : 'demais sábados'
    } else if (i === 0) {
      detalhe = NOMES_DIAS[data.getDay()].toLowerCase()
    }

    return {
      data,
      hoje: i === 0,
      nome: i === 0 ? 'Hoje' : NOMES_DIAS[data.getDay()],
      detalhe,
      texto: faixa ? `${faixa.inicio} às ${faixa.fim}` : 'Fechado',
      fechado: !faixa,
    }
  })
}

/** Frase curta do estado atual, pronta para a etiqueta. */
export function fraseDoEstado(agora = new Date()) {
  const { aberta, fechaEm, abreEm } = estadoAgora(agora)
  if (aberta) return { aberta: true, texto: 'Aberto agora', detalhe: `Fecha às ${fechaEm}` }
  if (abreEm) return { aberta: false, texto: 'Fechado agora', detalhe: `Abre às ${abreEm}` }

  const proximo = proximosSeteDias(agora).slice(1).find((d) => !d.fechado)
  return {
    aberta: false,
    texto: 'Fechado agora',
    detalhe: proximo ? `Abre ${proximo.nome.toLowerCase()} às ${proximo.texto.split(' ')[0]}` : null,
  }
}
