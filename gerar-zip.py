#!/usr/bin/env python3
"""
Gera o pacote que vai para o servidor: _entrega/otica-servidor.zip

Só o código — sem node_modules, sem dist, sem .git e sem nenhum .env
(as senhas de produção são criadas direto no servidor).

Por que as permissões são forçadas aqui: o zip guarda o modo Unix de cada
arquivo, e a pasta do projeto no Windows chega como 0700. Com 0700 os .sql
de docker/initdb ficam ilegíveis para o uid 999 do container do Postgres —
o entrypoint acha que a pasta está vazia, cria um banco em branco e não
reclama de nada. O sintoma é "relation \"usuarios\" does not exist" muito
depois, sem pista nenhuma da causa.
"""

import hashlib
import os
import zipfile
from datetime import datetime

RAIZ = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(RAIZ, '_entrega', 'otica-servidor.zip')

EXCLUIR_DIRS = {'node_modules', 'dist', '.git', '_entrega', '.vscode', '.idea'}
EXCLUIR_ARQ = {'.env', '.env.local', 'Thumbs.db', '.DS_Store'}

MODO_ARQUIVO = 0o644
MODO_EXECUTAVEL = 0o755   # scripts .sh
MODO_DIR = 0o755


EXECUTAVEIS = {'deploy/otica-publicar'}


def modo_de(rel):
    if rel.endswith('.sh') or rel in EXECUTAVEIS:
        return MODO_EXECUTAVEL
    return MODO_ARQUIVO


def main():
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    total = 0
    carimbo = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    assinatura = hashlib.sha256()

    with zipfile.ZipFile(SAIDA, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, dirs, arquivos in os.walk(RAIZ):
            dirs[:] = sorted(d for d in dirs if d not in EXCLUIR_DIRS)

            rel_dir = os.path.relpath(base, RAIZ).replace('\\', '/')
            if rel_dir != '.':
                info = zipfile.ZipInfo('OticaPopularSap/' + rel_dir + '/')
                info.external_attr = (MODO_DIR | 0o040000) << 16
                z.writestr(info, b'')

            for nome in sorted(arquivos):
                if nome in EXCLUIR_ARQ:
                    continue

                caminho = os.path.join(base, nome)
                rel = os.path.relpath(caminho, RAIZ).replace('\\', '/')

                # imagens já enviadas não vão para o servidor novo
                if rel.startswith('backend/uploads/produtos/') and not rel.endswith('.gitkeep'):
                    continue

                with open(caminho, 'rb') as f:
                    dados = f.read()

                info = zipfile.ZipInfo(
                    'OticaPopularSap/' + rel,
                    date_time=(2026, 1, 1, 0, 0, 0),
                )
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (modo_de(rel) | 0o100000) << 16
                info.create_system = 3          # Unix, para o modo ser respeitado
                z.writestr(info, dados)
                assinatura.update(rel.encode())
                assinatura.update(dados)
                total += 1

        # Carimbo dentro do pacote: o otica-publicar mostra esta linha antes de
        # instalar, então dá para bater com o que apareceu aqui. É a defesa
        # contra o gerenciador de arquivos salvar como "arquivo(1).zip" e você
        # acabar publicando o zip antigo sem perceber.
        versao = f'{carimbo} | {total} arquivos | {assinatura.hexdigest()[:12]}\n'
        info = zipfile.ZipInfo('OticaPopularSap/_versao.txt', date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = (MODO_ARQUIVO | 0o100000) << 16
        info.create_system = 3
        z.writestr(info, versao.encode())

    tamanho = os.path.getsize(SAIDA) / 1024
    print(f'{SAIDA}')
    print(f'{total} arquivos | {tamanho:.1f} KB')
    print(f'modos: {oct(MODO_ARQUIVO)} nos arquivos, {oct(MODO_EXECUTAVEL)} nos .sh, {oct(MODO_DIR)} nas pastas')
    print()
    print('VERSAO: ' + versao.strip())
    print('Confira se o servidor mostra esta mesma linha antes de instalar.')


if __name__ == '__main__':
    main()
