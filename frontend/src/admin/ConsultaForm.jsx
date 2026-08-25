import { useState } from 'react'
import { api, STATUS_CONSULTA } from '../services/api'

const VAZIO = {
  pacienteNome: '',
  pacienteEmail: '',
  pacienteTelefone: '',
  medicoNome: '',
  dataHora: '',
  observacoes: '',
  status: 'AGENDADA',
}

function estadoInicial(consulta) {
  if (!consulta) return VAZIO
  return {
    pacienteNome: consulta.pacienteNome || '',
    pacienteEmail: consulta.pacienteEmail || '',
    pacienteTelefone: consulta.pacienteTelefone || '',
    medicoNome: consulta.medicoNome || '',
    dataHora: (consulta.dataHora || '').slice(0, 16),
    observacoes: consulta.observacoes || '',
    status: consulta.status || 'AGENDADA',
  }
}

/** Mínimo do calendário: hoje. Não adianta agendar para uma data que já passou. */
function hojeLocal() {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

// O Consultas passa key={id}, então trocar de consulta remonta o componente.
function ConsultaForm({ consulta, medicos = [], aoSalvar, aoCancelar }) {
  const [form, setForm] = useState(() => estadoInicial(consulta))
  const [erro, setErro] = useState('')
  const [detalhes, setDetalhes] = useState([])
  const [salvando, setSalvando] = useState(false)

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    setErro('')
    setDetalhes([])
    setSalvando(true)
    try {
      const salvo = consulta
        ? await api.atualizarConsulta(consulta.id, form)
        : await api.criarConsulta(form)
      aoSalvar(salvo)
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar')
      setDetalhes(err.detalhes || [])
    } finally {
      setSalvando(false)
    }
  }

  // Remarcar recoloca o lembrete na fila — avisa antes de o usuário salvar.
  const vaiReenviar =
    consulta?.lembreteEnviadoEm &&
    (form.dataHora !== (consulta.dataHora || '').slice(0, 16) ||
      form.pacienteEmail.trim().toLowerCase() !== (consulta.pacienteEmail || '').toLowerCase())

  return (
    <form className="painel__form" onSubmit={enviar}>
      <h2>{consulta ? 'Editar consulta' : 'Nova consulta'}</h2>

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

      <div className="campo-linha">
        <label className="campo">
          <span>Nome do paciente *</span>
          <input
            value={form.pacienteNome}
            onChange={(e) => alterar('pacienteNome', e.target.value)}
            maxLength={120}
            required
          />
        </label>

        <label className="campo">
          <span>Nome do médico *</span>
          <input
            list="lista-medicos"
            value={form.medicoNome}
            onChange={(e) => alterar('medicoNome', e.target.value)}
            maxLength={120}
            placeholder="Dr. / Dra. …"
            required
          />
          <datalist id="lista-medicos">
            {medicos.map((m) => (
              <option key={m.nome} value={m.nome} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="campo-linha">
        <label className="campo">
          <span>E-mail do paciente *</span>
          <input
            type="email"
            value={form.pacienteEmail}
            onChange={(e) => alterar('pacienteEmail', e.target.value)}
            maxLength={160}
            placeholder="paciente@email.com"
            required
          />
          <small className="campo__dica">O lembrete é enviado para este endereço.</small>
        </label>

        <label className="campo">
          <span>Telefone</span>
          <input
            value={form.pacienteTelefone}
            onChange={(e) => alterar('pacienteTelefone', e.target.value)}
            maxLength={30}
            placeholder="(00) 00000-0000"
          />
        </label>
      </div>

      <div className="campo-linha">
        <label className="campo">
          <span>Data e horário *</span>
          <input
            type="datetime-local"
            value={form.dataHora}
            onChange={(e) => alterar('dataHora', e.target.value)}
            min={`${hojeLocal()}T00:00`}
            required
          />
        </label>

        {consulta && (
          <label className="campo">
            <span>Situação</span>
            <select value={form.status} onChange={(e) => alterar('status', e.target.value)}>
              {Object.entries(STATUS_CONSULTA).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="campo">
        <span>Observações</span>
        <textarea
          value={form.observacoes}
          onChange={(e) => alterar('observacoes', e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Aparece no e-mail do paciente. Ex.: trazer os óculos atuais."
        />
      </label>

      {vaiReenviar && (
        <div className="alerta alerta--aviso">
          Você mudou a data ou o e-mail: o lembrete será enviado de novo, com as informações
          atualizadas.
        </div>
      )}

      <div className="painel__form-acoes">
        <button type="submit" className="btn btn-dark" disabled={salvando}>
          {salvando ? 'Salvando…' : consulta ? 'Salvar alterações' : 'Agendar consulta'}
        </button>
        <button type="button" className="botao-link" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default ConsultaForm
