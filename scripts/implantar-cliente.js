'use strict';

/**
 * Script de implantação de novo cliente OrganizaPro.
 * Uso: node scripts/implantar-cliente.js
 * Teste: node scripts/implantar-cliente.js --dry-run
 */

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// ── Utilitários ───────────────────────────────────────────────────────────────

function falhar(msg) {
  console.error('\n❌ ERRO: ' + msg + '\n');
  process.exit(1);
}

function slugValido(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Leitura do .env.local ─────────────────────────────────────────────────────

function carregarEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    falhar('.env.local não encontrado. Certifique-se de executar na raiz do projeto.');
  }
  const raw = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const linha of raw.split(/\r?\n/)) {
    const match = linha.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// ── Coleta de dados no terminal ───────────────────────────────────────────────

function perguntar(rl, texto) {
  return new Promise(resolve => rl.question(texto, resposta => resolve(resposta.trim())));
}

async function coletarDados(rl) {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     OrganizaPro — Implantação de Cliente     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const nome = await perguntar(rl, 'Nome do negócio: ');
  if (!nome) falhar('Nome do negócio é obrigatório.');

  const email = (await perguntar(rl, 'E-mail do administrador: ')).toLowerCase();
  if (!email)          falhar('E-mail é obrigatório.');
  if (!emailValido(email)) falhar(`E-mail inválido: "${email}"`);

  const senha = await perguntar(rl, 'Senha temporária (mín. 6 caracteres): ');
  if (!senha || senha.length < 6) falhar('Senha deve ter no mínimo 6 caracteres.');

  const whatsapp = (await perguntar(rl, 'WhatsApp (somente números, opcional): ')).replace(/\D/g, '');

  const slug = (await perguntar(rl, 'Slug da URL (ex: meu-negocio): ')).toLowerCase();
  if (!slug)             falhar('Slug é obrigatório.');
  if (!slugValido(slug)) falhar(`Slug inválido: "${slug}". Use apenas letras minúsculas, números e hífens.`);

  return { nome, email, senha, whatsapp, slug };
}

// ── Etapas de implantação ─────────────────────────────────────────────────────

async function validarPreCondicoes(supabase, dados) {
  console.log('\n⏳ Validando pré-condições...');

  // Slug único
  const { data: clinicaExistente, error: slugErr } = await supabase
    .from('clinicas')
    .select('id')
    .eq('slug', dados.slug)
    .maybeSingle();
  if (slugErr) falhar('Não foi possível verificar slug: ' + slugErr.message);
  if (clinicaExistente) falhar(`Slug "${dados.slug}" já está em uso. Escolha outro.`);

  console.log('   ✅ Slug disponível');
  console.log('   ✅ Formato de dados válido');
}

async function criarUsuario(supabase, email, senha) {
  console.log('⏳ Etapa 1/4: Criando usuário no Supabase Auth...');
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
      falhar(`E-mail "${email}" já está cadastrado no sistema.`);
    }
    falhar('Falha ao criar usuário: ' + msg);
  }
  if (!data?.user) falhar('Usuário não retornado pelo Supabase Auth.');
  console.log(`   → Usuário criado: ${data.user.id}`);
  return data.user;
}

async function criarEmpresa(supabase, dados, userId) {
  console.log('⏳ Etapa 2/4: Criando registro em clinicas...');
  const { data: clinica, error } = await supabase
    .from('clinicas')
    .insert({ nome: dados.nome, whatsapp: dados.whatsapp || null, slug: dados.slug })
    .select('id')
    .single();
  if (error || !clinica) {
    // Rollback: remover usuário criado
    await supabase.auth.admin.deleteUser(userId).catch(() => null);
    falhar('Falha ao criar empresa: ' + (error?.message ?? 'resposta vazia'));
  }
  console.log(`   → Empresa criada: ${clinica.id}`);
  return clinica;
}

async function vincularUsuario(supabase, userId, clinicaId) {
  console.log('⏳ Etapa 3/4: Vinculando usuário à empresa...');
  const { error } = await supabase
    .from('clinica_usuarios')
    .insert({ usuario_id: userId, clinica_id: clinicaId });
  if (error) {
    // Rollback
    await supabase.auth.admin.deleteUser(userId).catch(() => null);
    await supabase.from('clinicas').delete().eq('id', clinicaId).catch(() => null);
    falhar('Falha ao criar vínculo: ' + error.message);
  }
  console.log('   → Vínculo criado em clinica_usuarios');
}

async function criarConfigInicial(supabase, userId, clinicaId, dados) {
  console.log('⏳ Etapa 4/4: Criando configuração inicial em clinica_config...');
  const { error } = await supabase
    .from('clinica_config')
    .upsert(
      {
        user_id:               userId,
        clinica_id:            clinicaId,
        nome_clinica:          dados.nome,
        telefone:              dados.whatsapp || '',
        email:                 dados.email,
        horario_funcionamento: 'Seg a Sex: 08h - 18h',
      },
      { onConflict: 'user_id' }
    );
  if (error) {
    console.warn('   ⚠ Configuração inicial não gravada:', error.message);
    console.warn('     O cliente pode preencher manualmente em /configuracoes.');
  } else {
    console.log('   → Configuração inicial criada');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  // Carregar e validar env
  const env = carregarEnv();
  const supabaseUrl    = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl         = env.NEXT_PUBLIC_APP_URL || 'https://app.organizapro.com.br';

  if (!supabaseUrl)    falhar('NEXT_PUBLIC_SUPABASE_URL ausente no .env.local');
  if (!serviceRoleKey) falhar('SUPABASE_SERVICE_ROLE_KEY ausente no .env.local — necessário para implantar clientes');

  // Modo dry-run: sem interatividade, sem chamadas ao banco
  if (isDryRun) {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║     OrganizaPro — DRY RUN (sem alterações)   ║');
    console.log('╚══════════════════════════════════════════════╝\n');
    console.log('✅ .env.local carregado');
    console.log('✅ NEXT_PUBLIC_SUPABASE_URL presente');
    console.log('✅ SUPABASE_SERVICE_ROLE_KEY presente');
    console.log('✅ @supabase/supabase-js disponível');
    console.log('\nEm produção, o script executaria:');
    console.log('  1. supabase.auth.admin.createUser({ email, password, email_confirm: true })');
    console.log('  2. INSERT INTO clinicas (nome, whatsapp, slug)');
    console.log('  3. INSERT INTO clinica_usuarios (usuario_id, clinica_id)');
    console.log('  4. UPSERT INTO clinica_config (user_id, clinica_id, nome_clinica, ...)');
    console.log('\nPara implantar de verdade: node scripts/implantar-cliente.js\n');
    process.exit(0);
  }

  // Inicializar cliente com service role
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Coletar dados interativamente
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let dados;
  try {
    dados = await coletarDados(rl);
  } finally {
    rl.close();
  }

  // Executar implantação
  await validarPreCondicoes(supabase, dados);
  const user    = await criarUsuario(supabase, dados.email, dados.senha);
  const clinica = await criarEmpresa(supabase, dados, user.id);
  await vincularUsuario(supabase, user.id, clinica.id);
  await criarConfigInicial(supabase, user.id, clinica.id, dados);

  // Resumo final
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║       ✅ CLIENTE IMPLANTADO COM SUCESSO       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Nome do negócio:   ${dados.nome.padEnd(26)}║`);
  console.log(`║  E-mail:            ${dados.email.padEnd(26)}║`);
  console.log(`║  Senha temporária:  ${dados.senha.padEnd(26)}║`);
  console.log(`║  URL de login:      ${(appUrl + '/login').padEnd(26)}║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  user_id:    ${user.id.slice(0, 33)}║`);
  console.log(`║  clinica_id: ${clinica.id.slice(0, 33)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('\n📋 Próximos passos:');
  console.log('   1. Enviar e-mail + senha temporária ao cliente');
  console.log('   2. Cliente acessa /login e altera a senha');
  console.log('   3. Cliente preenche configurações em /configuracoes');
  console.log('   4. Verificar vínculo no Supabase se algo parecer vazio\n');
}

main().catch(err => {
  console.error('\n❌ Erro inesperado:', err?.message ?? String(err));
  process.exit(1);
});
