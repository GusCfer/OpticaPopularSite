-- =====================================================================
-- Dados iniciais: as 4 categorias fixas do catálogo
-- =====================================================================
INSERT INTO categorias (slug, nome, descricao, ordem) VALUES
    ('oculos',  'Óculos de Grau', 'Armações e lentes de grau para o dia a dia.',      1),
    ('solar',   'Óculos de Sol',  'Proteção UV com estilo, para todos os rostos.',     2),
    ('relogio', 'Relógios',       'Relógios masculinos e femininos.',                  3),
    ('joia',    'Joias',          'Anéis, correntes, brincos e pulseiras.',            4)
ON CONFLICT (slug) DO NOTHING;
