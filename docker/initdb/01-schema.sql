-- =====================================================================
-- Óptica Popular — schema do banco
-- Executado automaticamente pelo Postgres na PRIMEIRA subida do container
-- (docker-entrypoint-initdb.d). Para reexecutar do zero:
--     docker compose down -v && docker compose up -d
-- =====================================================================

-- ---------------------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
    id          SERIAL       PRIMARY KEY,
    slug        VARCHAR(40)  NOT NULL UNIQUE,
    nome        VARCHAR(80)  NOT NULL,
    descricao   VARCHAR(255),
    ordem       INTEGER      NOT NULL DEFAULT 0,
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE categorias IS 'Categorias do catálogo: relogio, oculos, joia, solar';

-- ---------------------------------------------------------------------
-- PRODUTOS  (FK -> categorias)
-- ---------------------------------------------------------------------
CREATE TABLE produtos (
    id                 SERIAL        PRIMARY KEY,
    nome               VARCHAR(120)  NOT NULL,
    slug               VARCHAR(140)  NOT NULL UNIQUE,
    descricao          TEXT,
    marca              VARCHAR(80),
    preco              NUMERIC(10,2) NOT NULL,
    preco_promocional  NUMERIC(10,2),
    imagem_url         VARCHAR(255),
    ativo              BOOLEAN       NOT NULL DEFAULT TRUE,
    destaque           BOOLEAN       NOT NULL DEFAULT FALSE,
    ordem_destaque     INTEGER,
    categoria_id       INTEGER       NOT NULL,
    criado_em          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    atualizado_em      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_produtos_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categorias (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_produtos_preco_positivo
        CHECK (preco >= 0),
    CONSTRAINT ck_produtos_promocional_valido
        CHECK (preco_promocional IS NULL OR (preco_promocional >= 0 AND preco_promocional < preco))
);

CREATE INDEX idx_produtos_categoria  ON produtos (categoria_id);
CREATE INDEX idx_produtos_destaque   ON produtos (destaque) WHERE destaque = TRUE;
CREATE INDEX idx_produtos_ativo      ON produtos (ativo);

COMMENT ON COLUMN produtos.destaque IS 'Aparece na vitrine da home. Limite de 5, garantido por trigger.';

-- ---------------------------------------------------------------------
-- REGRA DE NEGÓCIO: no máximo 5 produtos em destaque
-- Garantida no próprio banco, não só na aplicação.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_limite_produtos_destaque()
RETURNS TRIGGER AS $$
DECLARE
    total_destaques INTEGER;
    limite CONSTANT INTEGER := 5;
BEGIN
    IF NEW.destaque IS TRUE THEN
        SELECT COUNT(*) INTO total_destaques
        FROM produtos
        WHERE destaque = TRUE
          AND id <> NEW.id;

        IF total_destaques >= limite THEN
            RAISE EXCEPTION
                'LIMITE_DESTAQUES: já existem % produtos em destaque (máximo %). Desmarque um antes de marcar outro.',
                total_destaques, limite
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_limite_produtos_destaque
    BEFORE INSERT OR UPDATE OF destaque ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION fn_limite_produtos_destaque();

-- ---------------------------------------------------------------------
-- atualizado_em automático
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_produtos_atualizado_em
    BEFORE UPDATE ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_atualizado_em();

-- ---------------------------------------------------------------------
-- USUÁRIOS (acesso ao painel admin)
-- A senha NUNCA é gravada em texto puro: só o hash bcrypt.
-- ---------------------------------------------------------------------
CREATE TYPE papel_usuario AS ENUM ('ADMIN', 'EDITOR');

CREATE TABLE usuarios (
    id                SERIAL        PRIMARY KEY,
    nome              VARCHAR(120)  NOT NULL,
    email             VARCHAR(160)  NOT NULL,
    senha_hash        VARCHAR(255)  NOT NULL,
    papel             papel_usuario NOT NULL DEFAULT 'EDITOR',
    ativo             BOOLEAN       NOT NULL DEFAULT TRUE,
    tentativas_login  INTEGER       NOT NULL DEFAULT 0,
    bloqueado_ate     TIMESTAMPTZ,
    ultimo_login      TIMESTAMPTZ,
    criado_em         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    atualizado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_usuarios_email_formato
        CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- e-mail único ignorando maiúsculas/minúsculas
CREATE UNIQUE INDEX uq_usuarios_email ON usuarios (LOWER(email));

CREATE TRIGGER trg_usuarios_atualizado_em
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_atualizado_em();

COMMENT ON COLUMN usuarios.senha_hash IS 'bcrypt, custo 12. Nunca expor via API.';
