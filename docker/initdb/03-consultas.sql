-- =====================================================================
-- Óptica Popular — agendamento de consultas + lembrete por e-mail
-- Executado pelo Postgres na PRIMEIRA subida do container.
-- Banco já existente? Rode:  cd backend && npm run migrar
-- (o script roda este mesmo arquivo; tudo aqui é idempotente)
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_consulta') THEN
        CREATE TYPE status_consulta AS ENUM ('AGENDADA', 'REALIZADA', 'CANCELADA');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS consultas (
    id                   SERIAL          PRIMARY KEY,
    paciente_nome        VARCHAR(120)    NOT NULL,
    paciente_email       VARCHAR(160)    NOT NULL,
    paciente_telefone    VARCHAR(30),
    medico_nome          VARCHAR(120)    NOT NULL,
    data_hora            TIMESTAMP       NOT NULL,   -- horário local da óptica
    observacoes          TEXT,
    status               status_consulta NOT NULL DEFAULT 'AGENDADA',
    lembrete_enviado_em  TIMESTAMPTZ,
    lembrete_erro        TEXT,
    criado_por           INTEGER,
    criado_em            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    atualizado_em        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_consultas_usuario
        FOREIGN KEY (criado_por)
        REFERENCES usuarios (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT ck_consultas_email_formato
        CHECK (paciente_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

COMMENT ON TABLE  consultas IS 'Consultas agendadas. Um lembrete por e-mail sai no dia anterior.';
COMMENT ON COLUMN consultas.data_hora IS 'Sem timezone: é sempre o horário local da óptica (TZ do .env).';
COMMENT ON COLUMN consultas.lembrete_enviado_em IS 'NULL = lembrete ainda não enviado. Evita envio duplicado.';

CREATE INDEX IF NOT EXISTS idx_consultas_data_hora ON consultas (data_hora);
CREATE INDEX IF NOT EXISTS idx_consultas_status    ON consultas (status);
-- índice usado pelo job de lembretes: só o que ainda não recebeu aviso
CREATE INDEX IF NOT EXISTS idx_consultas_lembrete_pendente
    ON consultas (data_hora)
    WHERE lembrete_enviado_em IS NULL AND status = 'AGENDADA';

-- Não deixa marcar dois pacientes no mesmo médico, no mesmo horário.
-- Consulta cancelada libera o horário de novo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultas_medico_horario
    ON consultas (LOWER(medico_nome), data_hora)
    WHERE status <> 'CANCELADA';

DROP TRIGGER IF EXISTS trg_consultas_atualizado_em ON consultas;
CREATE TRIGGER trg_consultas_atualizado_em
    BEFORE UPDATE ON consultas
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_atualizado_em();
