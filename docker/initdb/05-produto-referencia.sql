-- =====================================================================
-- Óptica Popular — referência interna do produto
-- Executado pelo Postgres na PRIMEIRA subida do container.
-- Banco já existente? Rode:  cd backend && npm run migrar
-- (o script roda este mesmo arquivo; tudo aqui é idempotente)
--
-- A referência é o código que a loja usa para achar a peça na gaveta: nota
-- do fornecedor, etiqueta, código próprio. Ela NÃO aparece para o cliente
-- no catálogo — mas a busca do site casa com ela, para que a pessoa que
-- recebeu o código pelo WhatsApp consiga colar e chegar na peça.
--
-- Sem UNIQUE de propósito: a mesma armação em duas cores costuma sair com a
-- mesma referência do fornecedor, e um índice único obrigaria a loja a
-- inventar sufixos para contornar o sistema. Texto livre.
-- =====================================================================

ALTER TABLE produtos
    ADD COLUMN IF NOT EXISTS referencia VARCHAR(60);

COMMENT ON COLUMN produtos.referencia IS
    'Código interno da loja. Não vai para as respostas públicas da API; serve para buscar.';

-- Sem índice aqui, e isso é deliberado: a busca é um ILIKE '%texto%', e um
-- índice B-tree não serve para padrão que começa com curinga — o Postgres o
-- ignoraria e sobraria só o custo de manter. Se um dia o catálogo passar de
-- alguns milhares de peças e a busca ficar lenta, o caminho é a extensão
-- pg_trgm com um índice GIN:
--
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
--   CREATE INDEX ix_produtos_busca ON produtos
--     USING GIN (nome gin_trgm_ops, marca gin_trgm_ops, referencia gin_trgm_ops);
