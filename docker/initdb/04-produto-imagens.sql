-- =====================================================================
-- Óptica Popular — galeria de até 8 imagens por produto
-- Executado pelo Postgres na PRIMEIRA subida do container.
-- Banco já existente? Rode:  cd backend && npm run migrar
-- (o script roda este mesmo arquivo; tudo aqui é idempotente)
--
-- A coluna produtos.imagem_url CONTINUA existindo e vira a "capa": a
-- primeira imagem da galeria, mantida em dia por trigger. Assim a home,
-- o catálogo e os destaques não precisaram mudar uma linha de SQL, e os
-- produtos já cadastrados continuam funcionando.
-- =====================================================================

CREATE TABLE IF NOT EXISTS produto_imagens (
    id          SERIAL       PRIMARY KEY,
    produto_id  INTEGER      NOT NULL,
    caminho     VARCHAR(255) NOT NULL,
    ordem       SMALLINT     NOT NULL DEFAULT 0,
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_produto_imagens_produto
        FOREIGN KEY (produto_id)
        REFERENCES produtos (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    -- O limite de 8 sai de graça da combinação destes dois: a ordem só
    -- pode ir de 0 a 7, e não se repete dentro do mesmo produto. Nada de
    -- trigger contando linhas — o Postgres garante sozinho.
    CONSTRAINT uq_produto_imagens_ordem UNIQUE (produto_id, ordem),
    CONSTRAINT ck_produto_imagens_ordem CHECK (ordem >= 0 AND ordem < 8),

    CONSTRAINT ck_produto_imagens_caminho CHECK (caminho <> '')
);

CREATE INDEX IF NOT EXISTS ix_produto_imagens_produto
    ON produto_imagens (produto_id, ordem);

COMMENT ON TABLE produto_imagens IS 'Galeria do produto: no máximo 8, ordenadas. A de menor ordem é a capa.';
COMMENT ON COLUMN produto_imagens.caminho IS 'Caminho relativo (/uploads/produtos/...). A URL absoluta é montada na resposta da API.';

-- ---------------------------------------------------------------------
-- Capa sempre em dia
--
-- produtos.imagem_url passa a ser derivada: é a imagem de menor ordem.
-- Deixar isso no banco, e não só no service, significa que mexer na
-- galeria pelo pgAdmin também acerta a capa — e que a home nunca aponta
-- para uma foto que foi removida.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_capa_produto()
RETURNS TRIGGER AS $$
DECLARE
    alvo INTEGER := COALESCE(NEW.produto_id, OLD.produto_id);
BEGIN
    UPDATE produtos p
       SET imagem_url = (
             SELECT i.caminho
               FROM produto_imagens i
              WHERE i.produto_id = alvo
              ORDER BY i.ordem, i.id
              LIMIT 1
           )
     WHERE p.id = alvo;

    -- Quando o produto inteiro é apagado, o CASCADE remove as imagens e
    -- este UPDATE não encontra ninguém. É esperado, não é erro.
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_capa_produto ON produto_imagens;
CREATE TRIGGER trg_sync_capa_produto
    AFTER INSERT OR UPDATE OR DELETE ON produto_imagens
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_capa_produto();

-- ---------------------------------------------------------------------
-- Migração dos produtos que já existem
--
-- Quem já tinha uma foto ganha a galeria com ela na posição 0. O
-- NOT EXISTS é o que torna isto seguro de rodar quantas vezes for.
-- ---------------------------------------------------------------------
INSERT INTO produto_imagens (produto_id, caminho, ordem)
SELECT p.id, p.imagem_url, 0
  FROM produtos p
 WHERE p.imagem_url IS NOT NULL
   AND btrim(p.imagem_url) <> ''
   AND NOT EXISTS (
         SELECT 1 FROM produto_imagens i WHERE i.produto_id = p.id
       );
