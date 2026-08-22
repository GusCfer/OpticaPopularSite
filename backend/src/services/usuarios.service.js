'use strict'

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')

const db = require('../lib/db')
const env = require('../config/env')
const { naoAutorizado, conflito, requisicaoInvalida } = require('../lib/erros')

const CUSTO_BCRYPT = 12
const MAX_TENTATIVAS = 5
const MINUTOS_BLOQUEIO = 15

// Colunas seguras — senha_hash NUNCA sai daqui.
const CAMPOS_PUBLICOS = 'id, nome, email, papel, ativo, ultimo_login, criado_em'

const senhaSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .max(72, 'A senha pode ter no máximo 72 caracteres')
  .refine((s) => /[a-zA-Z]/.test(s) && /[0-9]/.test(s), {
    message: 'A senha precisa ter pelo menos uma letra e um número',
  })

const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(160),
  senha: senhaSchema,
  papel: z.enum(['ADMIN', 'EDITOR']).default('EDITOR'),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail ou senha inválidos').max(160),
  senha: z.string().min(1).max(72),
})

async function criarUsuario(dados) {
  const { nome, email, senha, papel } = criarUsuarioSchema.parse(dados)

  const existente = await db.query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)', [email])
  if (existente.rowCount > 0) {
    throw conflito('Já existe um usuário com esse e-mail', 'EMAIL_EM_USO')
  }

  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT)

  const { rows } = await db.query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel)
     VALUES ($1, $2, $3, $4)
     RETURNING ${CAMPOS_PUBLICOS}`,
    [nome, email, senhaHash, papel]
  )
  return rows[0]
}

async function autenticar(dados) {
  const parsed = loginSchema.safeParse(dados)
  // Mensagem genérica de propósito: não revela se o e-mail existe.
  if (!parsed.success) throw naoAutorizado('E-mail ou senha inválidos')
  const { email, senha } = parsed.data

  const { rows } = await db.query(
    `SELECT id, nome, email, senha_hash, papel, ativo, tentativas_login, bloqueado_ate
       FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  )
  const usuario = rows[0]

  // Compara mesmo sem usuário, pra o tempo de resposta não denunciar a existência do e-mail.
  const hashComparacao = usuario ? usuario.senha_hash : '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
  const senhaConfere = await bcrypt.compare(senha, hashComparacao)

  if (!usuario || !senhaConfere) {
    if (usuario) await registrarFalha(usuario)
    throw naoAutorizado('E-mail ou senha inválidos')
  }

  if (!usuario.ativo) throw naoAutorizado('Usuário desativado. Fale com o administrador.')

  if (usuario.bloqueado_ate && new Date(usuario.bloqueado_ate) > new Date()) {
    throw naoAutorizado(
      `Muitas tentativas de login. Tente novamente em alguns minutos.`
    )
  }

  await db.query(
    'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_login = NOW() WHERE id = $1',
    [usuario.id]
  )

  const token = jwt.sign(
    { sub: String(usuario.id), papel: usuario.papel, nome: usuario.nome },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256', issuer: 'otica-popular' }
  )

  return {
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
  }
}

async function registrarFalha(usuario) {
  const tentativas = (usuario.tentativas_login || 0) + 1
  if (tentativas >= MAX_TENTATIVAS) {
    await db.query(
      `UPDATE usuarios SET tentativas_login = $1, bloqueado_ate = NOW() + ($2 || ' minutes')::interval WHERE id = $3`,
      [tentativas, String(MINUTOS_BLOQUEIO), usuario.id]
    )
  } else {
    await db.query('UPDATE usuarios SET tentativas_login = $1 WHERE id = $2', [tentativas, usuario.id])
  }
}

async function buscarPorId(id) {
  const { rows } = await db.query(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1`, [id])
  return rows[0] || null
}

async function listar() {
  const { rows } = await db.query(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios ORDER BY criado_em`)
  return rows
}

async function alterarSenha(id, senhaAtual, senhaNova) {
  const { rows } = await db.query('SELECT senha_hash FROM usuarios WHERE id = $1', [id])
  if (!rows[0]) throw naoAutorizado('Usuário não encontrado')

  const confere = await bcrypt.compare(String(senhaAtual || ''), rows[0].senha_hash)
  if (!confere) throw naoAutorizado('Senha atual incorreta')

  const nova = senhaSchema.parse(senhaNova)
  if (await bcrypt.compare(nova, rows[0].senha_hash)) {
    throw requisicaoInvalida('A nova senha precisa ser diferente da atual')
  }

  const hash = await bcrypt.hash(nova, CUSTO_BCRYPT)
  await db.query('UPDATE usuarios SET senha_hash = $1, tentativas_login = 0, bloqueado_ate = NULL WHERE id = $2', [hash, id])
  return { ok: true }
}

module.exports = { criarUsuario, autenticar, buscarPorId, listar, alterarSenha, CUSTO_BCRYPT }
