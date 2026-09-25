/**
 * Cria a conta comercial oficial de demonstração — Barbearia Black Crown.
 * Uso: node scripts/criar-conta-comercial-demo.mjs
 *
 * Segue exatamente a mesma sequência de scripts/implantar-cliente.mjs
 * (o caminho real de provisionamento de um cliente), seguida da carga do
 * cenário canônico (scripts/lib/cenario-barbearia-black-crown.mjs) e do
 * conteúdo mínimo do Site Premium.
 *
 * Idempotente: aborta sem escrever nada se o e-mail ou o slug já existirem.
 * A senha é gerada e exibida só no terminal — nunca gravada em arquivo.
 * Opcional: CONTA_DEMO_SENHA no ambiente define a senha (mín. 12 caracteres);
 * sem ela, uma senha aleatória forte é gerada. Nunca hardcoded no código.
 */
import fs from "fs";
import { randomBytes } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import {
  gerarClientes, gerarAgendamentos, gerarAvaliacoes,
  ALEXANDRE, MATHEUS,
} from "./lib/cenario-barbearia-black-crown.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NOME_NEGOCIO = "Barbearia Black Crown";
const EMAIL = "barbearia.demo@organizaprooficial.com.br";
const SLUG = "barbearia-black-crown";

function carregarEnv() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  const raw = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const linha of raw.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  const env = carregarEnv();
  const senha = process.env.CONTA_DEMO_SENHA || randomBytes(18).toString("base64url");
  if (senha.length < 12) {
    console.error("❌ CONTA_DEMO_SENHA deve ter pelo menos 12 caracteres.");
    process.exit(1);
  }
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("⏳ Validando pré-condições...");
  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersPage.users.find(u => u.email === EMAIL)) {
    console.error(`❌ E-mail "${EMAIL}" já existe. Abortando sem escrever nada.`);
    process.exit(1);
  }
  const { data: slugExistente } = await admin.from("clinica_config").select("id").eq("slug", SLUG).maybeSingle();
  if (slugExistente) {
    console.error(`❌ Slug "${SLUG}" já existe. Abortando sem escrever nada.`);
    process.exit(1);
  }
  console.log("   ✅ E-mail e slug disponíveis\n");

  console.log("⏳ Etapa 1/5: Criando usuário no Supabase Auth...");
  const { data: userData, error: eUser } = await admin.auth.admin.createUser({
    email: EMAIL, password: senha, email_confirm: true,
  });
  if (eUser) { console.error("❌", eUser.message); process.exit(1); }
  const userId = userData.user.id;
  console.log(`   → ${userId}\n`);

  console.log("⏳ Etapa 2/5: Criando perfil em usuarios...");
  await admin.from("usuarios").insert({ id: userId, nome: "Barbearia Black Crown (Demo Comercial)", email: EMAIL });
  console.log("   → ok\n");

  console.log("⏳ Etapa 3/5: Criando empresa em clinicas...");
  const { data: clinica, error: eClinica } = await admin.from("clinicas").insert({
    nome: NOME_NEGOCIO,
    especialidade: "Barbearia",
    telefone: "41988887000",
    email: EMAIL,
    endereco: "Rua Voluntários da Pátria, 1234 - Centro",
    cidade: "Curitiba",
    estado: "PR",
    whatsapp: "41988887000",
    plano: "pro",
    plano_ativo: true,
  }).select().single();
  if (eClinica) { console.error("❌", eClinica.message); process.exit(1); }
  const clinicaId = clinica.id;
  console.log(`   → ${clinicaId}\n`);

  console.log("⏳ Etapa 4/5: Vinculando usuário à empresa (papel: dono)...");
  await admin.from("clinica_usuarios").insert({ usuario_id: userId, clinica_id: clinicaId, papel: "dono", ativo: true });
  console.log("   → ok\n");

  console.log("⏳ Etapa 5/5: Criando configuração em clinica_config...");
  await admin.from("clinica_config").upsert({
    user_id: userId,
    clinica_id: clinicaId,
    nome_clinica: NOME_NEGOCIO,
    telefone: "41988887000",
    email: EMAIL,
    endereco: "Rua Voluntários da Pátria, 1234 - Centro",
    horario_funcionamento: "Seg a Sáb: 09h - 17h",
    slug: SLUG,
    nota_google: 4.7,
    num_avaliacoes: 89,
    msg_lembrete:
      "Olá, {nome}! 👋\n\nPassamos para lembrar do seu compromisso agendado para *amanhã, {data}* às *{horario}*.\n\nPara confirmar sua presença, responda *SIM*.\nPara remarcar, é só nos avisar com antecedência. 📅\n\nContamos com você. Até amanhã! 😊",
    msg_confirmacao:
      "Olá, {nome}! ✅\n\nSeu compromisso está *confirmado* para *{data}* às *{horario}*.\n\n📍 Chegue com 5 minutos de antecedência.\n\nQualquer dúvida, é só chamar aqui. Até lá! 😊",
    msg_avaliacao:
      "Olá, {nome}! 😊\n\nEsperamos que seu atendimento tenha sido excelente! Sua opinião é muito importante para nós e ajuda outros clientes a nos encontrar.\n\nPoderia nos avaliar no Google? Leva menos de 1 minuto:\n👉 {link}\n\nMuito obrigado pela confiança! 🙏",
    msg_reagendamento:
      "Olá, {nome}! 📅\n\nIdentificamos que seu compromisso do dia *{data}* às *{horario}* precisa ser reagendado.\n\nQual o melhor horário para você? Estamos à disposição para encontrar uma data conveniente.\n\nAguardamos seu retorno! 😊",
  }, { onConflict: "user_id" });
  console.log("   → ok\n");

  console.log("⏳ Site Premium: serviços, equipe, depoimentos...");
  await admin.from("clinica_servicos").insert([
    { clinica_id: clinicaId, icone: "✂️", nome: "Corte Masculino",       descricao: "Corte moderno com acabamento em navalha e finalização impecável.", ordem: 0 },
    { clinica_id: clinicaId, icone: "🪒", nome: "Barba",                 descricao: "Barba desenhada com toalha quente e produtos premium.",            ordem: 1 },
    { clinica_id: clinicaId, icone: "💈", nome: "Combo Corte + Barba",   descricao: "O pacote completo: corte e barba no mesmo horário.",                ordem: 2 },
    { clinica_id: clinicaId, icone: "🎨", nome: "Pigmentação de Barba",  descricao: "Realça e uniformiza os fios da barba com pigmentação natural.",     ordem: 3 },
  ]);
  await admin.from("clinica_equipe").insert([
    { clinica_id: clinicaId, nome: ALEXANDRE, especialidade: "Cortes Clássicos",   descricao: "Mais de 12 anos de experiência em cortes clássicos e acabamento em navalha.", ordem: 0 },
    { clinica_id: clinicaId, nome: MATHEUS,   especialidade: "Barba e Acabamento", descricao: "Especialista em barba desenhada, toalha quente e acabamento de precisão.",   ordem: 1 },
  ]);
  await admin.from("clinica_depoimentos").insert([
    { clinica_id: clinicaId, nome: "Marcelo Andrade", cidade: "Curitiba, PR", comentario: "Cortei o cabelo com o Alexandre e saí outro homem. Atenção incrível aos detalhes.",   nota: 5, ordem: 0 },
    { clinica_id: clinicaId, nome: "Rafael Tondo",    cidade: "Curitiba, PR", comentario: "Ambiente agradável e o Matheus é fera na barba. Já virei cliente fixo.",              nota: 5, ordem: 1 },
    { clinica_id: clinicaId, nome: "Gabriel Nunes",   cidade: "Curitiba, PR", comentario: "Preço justo pela qualidade. Só não gosto que às vezes tem que esperar um pouco.",      nota: 4, ordem: 2 },
  ]);
  console.log("   → ok\n");

  console.log("⏳ Carregando cenário (clientes, agendamentos, avaliações)...");
  await carregarCenario(admin, clinicaId, userId);
  console.log("   → ok\n");

  const registro = {
    nome: NOME_NEGOCIO, email: EMAIL, slug: SLUG,
    userId, clinicaId,
    criadoEm: new Date().toISOString(),
  };
  fs.writeFileSync(path.resolve(__dirname, "..", "docs", "conta-comercial-demo.json"), JSON.stringify(registro, null, 2));

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   ✅ CONTA COMERCIAL DEMO CRIADA — Barbearia Black Crown ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  E-mail: ${EMAIL}`);
  console.log(`║  Senha:  ${senha}`);
  console.log(`║  Slug:   ${SLUG}`);
  console.log(`║  user_id:    ${userId}`);
  console.log(`║  clinica_id: ${clinicaId}`);
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("\n⚠️  A senha acima só existe neste terminal — guarde-a com segurança. Não foi gravada em nenhum arquivo.");
}

export async function carregarCenario(admin, clinicaId, userId) {
  const agora = new Date();
  const clientes = gerarClientes(agora);
  const porId = Object.fromEntries(clientes.map(c => [c.id, c]));

  const { data: pacientesInseridos, error: eP } = await admin.from("pacientes").insert(
    clientes.map(c => ({
      nome: c.nome, telefone: c.tel, whatsapp: c.tel,
      status: "ativo", proxima_consulta: c.proximaConsulta,
      clinica_id: clinicaId, user_id: userId,
    }))
  ).select();
  if (eP) throw new Error("pacientes: " + eP.message);

  const agendamentos = gerarAgendamentos(agora);
  const { data: agendamentosInseridos, error: eA } = await admin.from("agendamentos").insert(
    agendamentos.map(a => {
      const c = porId[a.clienteId];
      return {
        paciente_nome: c.nome, telefone: c.tel,
        data: a.data, hora: a.hora,
        tipo_consulta: a.servico, profissional: a.profissional,
        status: a.status,
        clinica_id: clinicaId, user_id: userId,
      };
    })
  ).select();
  if (eA) throw new Error("agendamentos: " + eA.message);

  // Casa cada avaliação com o agendamento certo (clienteId + data exata).
  const avaliacoes = gerarAvaliacoes();
  const paraData = (delta) => {
    const d = new Date(agora);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  const linhasAvaliacoes = avaliacoes.map(av => {
    const c = porId[av.clienteId];
    const dataAlvo = paraData(av.agendamentoDelta);
    const agendamento = agendamentosInseridos.find(a => a.telefone === c.tel && a.data === dataAlvo);
    if (!agendamento) throw new Error(`avaliação sem agendamento correspondente: ${av.clienteId} / ${dataAlvo}`);
    return {
      clinica_id: clinicaId,
      agendamento_id: agendamento.id,
      paciente_nome: c.nome,
      telefone: c.tel,
      enviado_em: new Date(new Date(agora).setUTCDate(agora.getUTCDate() + av.enviadoDelta)).toISOString(),
      respondeu: av.respondeu,
    };
  });
  const { error: eV } = await admin.from("avaliacoes").insert(linhasAvaliacoes);
  if (eV) throw new Error("avaliacoes: " + eV.message);

  return { pacientes: pacientesInseridos, agendamentos: agendamentosInseridos };
}

const executadoDiretamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDiretamente) {
  main().catch(err => { console.error("\n❌ Erro inesperado:", err?.message ?? String(err)); process.exit(1); });
}
