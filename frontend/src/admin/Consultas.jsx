import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, STATUS_CONSULTA, formatarDataHora } from '../services/api'
import ConsultaForm from './ConsultaForm'

/** Como está o lembrete de uma consulta — vira a coluna "Lembrete" da tabela. */
function situacaoLembrete(consulta) {
  if (consulta.status === 'CANCELADA') return { texto: '—', classe: 'pill--off', titulo: 'Consulta cancelada' }
  if (consulta.lembreteEnviadoEm) {
    const quando = new Date(consulta.lembreteEnviadoEm).toLocaleString('pt-BR')
    return { texto: 'Enviado', classe: 'pill--ok', titulo: `Enviado em ${quando}` }
  }
  if (consulta.lembreteErro) return { texto: 'Falhou', classe: 'pill--erro', titulo: consulta.lembreteErro }
  return { texto: 'Na fila', classe: 'pill--espera', titulo: 'Sai automaticamente na véspera da consulta' }
}

function Consultas() {
  const [dados, setDados] = useState(null) // null = primeira carga
  const [emailStatus, setEmailStatus] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [versao, setVersao] = useState(0)
  const [editando, setEditando] = useState(null) // null | 'nova' | consulta
  const [ocupado, setOcupado] = useState(null) // id da linha em ação

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let ativo = true
    Promise.all([
      api.consultas({ busca, status: filtroStatus, de, ate }),
      api.medicos(),
      api.resumoConsultas(),
    ])
      .then(([lista, medicos, resumo]) => {
        if (ativo) setDados({ lista, medicos, resumo })
      })
      .catch((err) => {
        if (ativo) setErro(err.message || 'Falha ao carregar a agenda')
      })
    return () => {
      ativo = false
    }
  }, [busca, filtroStatus, de, ate, versao])

  // Configuração do e-mail: carrega uma vez, só para o aviso do topo.
  useEffect(() => {
    let ativo = true
    api
      .statusEmail()
      .then((s) => ativo && setEmailStatus(s))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  const carregando = dados === null
  const consultas = useMemo(() => dados?.lista ?? [], [dados])
  const medicos = dados?.medicos ?? []
  const resumo = dados?.resumo

  function mostrarAviso(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 6000)
  }

  async function comLinha(consulta, acao) {
    setErro('')
    setOcupado(consulta.id)
    try {
      await acao()
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(null)
    }
  }

  const reenviarLembrete = (consulta) =>
    comLinha(consulta, async () => {
      const atualizada = await api.enviarLembrete(consulta.id)
      setDados((d) => ({ ...d, lista: d.lista.map((c) => (c.id === atualizada.id ? atualizada : c)) }))
      mostrarAviso(`Lembrete enviado para ${atualizada.pacienteEmail}.`)
    })

  const trocarStatus = (consulta, status) =>
    comLinha(consulta, async () => {
      const atualizada = await api.definirStatusConsulta(consulta.id, status)
      setDados((d) => ({ ...d, lista: d.lista.map((c) => (c.id === atualizada.id ? atualizada : c)) }))
      recarregar()
    })

  const excluir = (consulta) => {
    if (!window.confirm(`Excluir a consulta de "${consulta.pacienteNome}"? Essa ação não pode ser desfeita.`)) return
    return comLinha(consulta, async () => {
      await api.excluirConsulta(consulta.id)
      setDados((d) => ({ ...d, lista: d.lista.filter((c) => c.id !== consulta.id) }))
      mostrarAviso('Consulta excluída.')
      recarregar()
    })
  }

  async function testarEmail() {
    setErro('')
    try {
      const r = await api.testarEmail()
      mostrarAviso(r.mensagem)
    } catch (err) {
      setErro(err.message)
    }
  }

  function aoSalvar(salva) {
    setEditando(null)
    mostrarAviso(`Consulta de "${salva.pacienteNome}" salva para ${formatarDataHora(salva.dataHora)}.`)
    recarregar()
  }

  return (
    <>
      {emailStatus && !emailStatus.configurado && (
        <div className="alerta alerta--aviso">
          <strong>O envio de e-mail ainda não está configurado.</strong> As consultas podem ser
          cadastradas normalmente, mas nenhum lembrete sai enquanto <code>SMTP_USER</code> e{' '}
          <code>SMTP_PASS</code> estiverem vazios no <code>backend/.env</code>. Use uma senha de app
          do Gmail, não a senha da conta.
        </div>
      )}

      <div className="painel__acoes">
        <div className="painel__filtros painel__filtros--agenda">
          <input
            type="search"
            placeholder="Buscar por paciente, médico ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todas as situações</option>
            {Object.entries(STATUS_CONSULTA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <label className="filtro-data">
            De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label className="filtro-data">
            Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </label>
        </div>

        <div className="painel__acoes-dir">
          {resumo && (
            <span className="contador" title="Consultas agendadas de hoje em diante">
              Hoje: {resumo.hoje} · Amanhã: {resumo.amanha}
            </span>
          )}
          <button type="button" className="btn btn-dark" onClick={() => setEditando('nova')}>
            + Nova consulta
          </button>
        </div>
      </div>

      {emailStatus?.configurado && (
        <p className="painel__nota">
          Lembretes saem de <strong>{emailStatus.remetente}</strong> todo dia no horário{' '}
          <code>{emailStatus.agendador || 'desligado'}</code> ({emailStatus.fuso}), avisando quem tem
          consulta no dia seguinte.{' '}
          <button type="button" className="botao-link" onClick={testarEmail}>
            Testar conexão
          </button>
        </p>
      )}

      {erro && <div className="alerta alerta--erro">{erro}</div>}
      {aviso && <div className="alerta alerta--ok">{aviso}</div>}

      {editando && (
        <ConsultaForm
          key={editando === 'nova' ? 'nova' : editando.id}
          consulta={editando === 'nova' ? null : editando}
          medicos={medicos}
          aoSalvar={aoSalvar}
          aoCancelar={() => setEditando(null)}
        />
      )}

      {carregando ? (
        <div className="admin-carregando">Carregando a agenda…</div>
      ) : consultas.length === 0 ? (
        <div className="vazio">
          <p>Nenhuma consulta encontrada.</p>
          <button type="button" className="btn btn-dark" onClick={() => setEditando('nova')}>
            Agendar a primeira
          </button>
        </div>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela tabela--cartoes">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Médico(a)</th>
                <th>Data e horário</th>
                <th>Situação</th>
                <th>Lembrete</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {consultas.map((consulta) => {
                const lembrete = situacaoLembrete(consulta)
                const cancelada = consulta.status === 'CANCELADA'
                return (
                  <tr key={consulta.id} className={cancelada ? 'linha--inativa' : ''}>
                    <td data-rotulo="Paciente">
                      <strong>{consulta.pacienteNome}</strong>
                      <small>{consulta.pacienteEmail}</small>
                      {consulta.pacienteTelefone && <small>{consulta.pacienteTelefone}</small>}
                    </td>
                    <td data-rotulo="Médico(a)">{consulta.medicoNome}</td>
                    <td data-rotulo="Data e horário">
                      {formatarDataHora(consulta.dataHora)}
                      {consulta.observacoes && <small title={consulta.observacoes}>{consulta.observacoes}</small>}
                    </td>
                    <td data-rotulo="Situação">
                      <span
                        className={`pill ${
                          consulta.status === 'AGENDADA'
                            ? 'pill--ok'
                            : consulta.status === 'REALIZADA'
                              ? 'pill--espera'
                              : 'pill--off'
                        }`}
                      >
                        {STATUS_CONSULTA[consulta.status]}
                      </span>
                    </td>
                    <td data-rotulo="Lembrete">
                      <span className={`pill ${lembrete.classe}`} title={lembrete.titulo}>
                        {lembrete.texto}
                      </span>
                    </td>
                    <td className="acoes">
                      <button type="button" className="botao-link" onClick={() => setEditando(consulta)}>
                        Editar
                      </button>
                      {!cancelada && (
                        <button
                          type="button"
                          className="botao-link"
                          disabled={ocupado === consulta.id}
                          onClick={() => reenviarLembrete(consulta)}
                          title="Manda o lembrete agora, sem esperar a véspera"
                        >
                          {ocupado === consulta.id ? 'Enviando…' : 'Enviar lembrete'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="botao-link"
                        disabled={ocupado === consulta.id}
                        onClick={() => trocarStatus(consulta, cancelada ? 'AGENDADA' : 'CANCELADA')}
                      >
                        {cancelada ? 'Reativar' : 'Cancelar'}
                      </button>
                      <button
                        type="button"
                        className="botao-link botao-link--perigo"
                        disabled={ocupado === consulta.id}
                        onClick={() => excluir(consulta)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default Consultas
