import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (arquivo) => readFileSync(path.join(root, arquivo), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (sql) => sql.replace(/--.*$/gm, "");

const pasta = "sql/saneamento-pendente";
const preflight = ler(`${pasta}/preflight-migrations-bloqueadores-v1.sql`);
const origem = ler(`${pasta}/fix-origem-captacoes-canonica-nova-base-v1.sql`);
const pedidos = ler(`${pasta}/fix-pedidos-paciente-tenant-v1.sql`);
const oportunidades = ler(`${pasta}/fix-oportunidades-update-governado-v1.sql`);
const config = ler(`${pasta}/fix-clinica-config-rls-v2.sql`);
const chatbotNovo = ler(`${pasta}/baseline-chatbot-leads-nova-base-v1.sql`);
const chatbotExistente = ler(`${pasta}/fix-chatbot-leads-existente-v1.sql`);
const policyPublica = ler("sql/supabase-public-clinicas-policy.sql");

test("pre-flight é somente leitura e cobre catálogos, policies, grants, funções e views", () => {
  const ativo = semComentarios(preflight);
  assert.doesNotMatch(ativo, /\b(insert|update|delete|alter|create|drop|grant|revoke|truncate|call)\b/i);
  for (const contrato of ["information_schema.columns", "pg_constraint", "pg_policies", "role_table_grants", "pg_proc", "pg_get_functiondef", "pg_get_viewdef"]) {
    assert.match(ativo, new RegExp(contrato.replace(".", "\\."), "i"));
  }
});

test("origem canônica fecha tenant do paciente e acesso exige vínculo ativo OrganizaPro", () => {
  assert.match(origem, /foreign key \(paciente_id, clinica_id\)[\s\S]*references public\.pacientes \(id, clinica_id\)/i);
  assert.match(origem, /on delete set null \(paciente_id\)/i);
  assert.match(origem, /cu\.ativo = true/);
  assert.match(origem, /c\.produto = 'organizapro'/);
  assert.match(origem, /revoke all on public\.origem_captacoes from public, anon, authenticated/i);
  assert.doesNotMatch(semComentarios(origem), /\bcreated_at\b/i);
});

test("fix de pedidos falha para divergência e só valida FK composta após proteger novas escritas", () => {
  assert.match(pedidos, /p\.clinica_id <> pe\.clinica_id/);
  assert.match(pedidos, /raise exception '% pedidos possuem paciente de outro tenant/);
  assert.match(pedidos, /foreign key \(paciente_id, clinica_id\)[\s\S]*references public\.pacientes \(id, clinica_id\)/i);
  assert.match(pedidos, /not valid;[\s\S]*validate constraint pedidos_paciente_tenant_fk/i);
});

test("oportunidades preserva leitura e remove o bypass de UPDATE", () => {
  const ativo = semComentarios(oportunidades);
  assert.match(ativo, /drop policy if exists oportunidades_demanda_update_own/i);
  assert.match(ativo, /revoke update on public\.oportunidades_demanda from public, anon, authenticated/i);
  assert.match(ativo, /grant execute on function[\s\S]*to service_role/i);
  assert.doesNotMatch(ativo, /create policy[\s\S]*for update/i);
  assert.doesNotMatch(ativo, /revoke select/i);
});

test("SQL público antigo está fail-closed e não cria policy ampla", () => {
  const ativo = semComentarios(policyPublica);
  assert.match(ativo, /raise exception/i);
  assert.doesNotMatch(ativo, /create\s+policy/i);
  assert.doesNotMatch(ativo, /using\s*\(\s*slug/i);
});

test("clinica_config aborta com policy desconhecida e exige tenant ativo do produto", () => {
  assert.match(config, /policies_desconhecidas/);
  assert.match(config, /raise exception 'policies desconhecidas/i);
  assert.match(config, /cu\.ativo = true/g);
  assert.match(config, /c\.produto = 'organizapro'/g);
  assert.match(config, /revoke all on public\.clinica_config from anon/i);
  assert.doesNotMatch(config, /FOR pol IN SELECT policyname/i);
});

test("baseline novo do chatbot é integral, tenant-safe e server-side", () => {
  for (const coluna of ["ultima_interacao", "porte_clinica", "sistema_atual", "dor_principal", "origem"]) {
    assert.match(chatbotNovo, new RegExp(`\\b${coluna}\\b`));
  }
  assert.match(chatbotNovo, /clinica_id[\s\S]*references public\.clinicas\(id\)/i);
  assert.match(chatbotNovo, /score\s+integer not null default 10[\s\S]*check \(score in \(10, 50, 100\)\)/i);
  assert.match(chatbotNovo, /etapa\s+text not null default 'inicial'/i);
  assert.match(chatbotNovo, /revoke all on public\.chatbot_leads from public, anon, authenticated/i);
});

test("reconciliação do chatbot nunca converte score textual desconhecido silenciosamente", () => {
  assert.match(chatbotExistente, /score not in \('frio', 'morno', 'quente', '10', '50', '100'\)/i);
  assert.match(chatbotExistente, /raise exception '% scores textuais nao possuem mapeamento canonico'/i);
  assert.match(chatbotExistente, /alter column etapa set default 'inicial'/i);
  assert.match(chatbotExistente, /alter column etapa set not null/i);
  assert.match(chatbotExistente, /revoke all on public\.chatbot_leads from public, anon, authenticated/i);
});

test("fixes pendentes ficam fora do diretório automático de migrations", () => {
  for (const arquivo of [
    "preflight-migrations-bloqueadores-v1.sql",
    "fix-origem-captacoes-canonica-nova-base-v1.sql",
    "fix-pedidos-paciente-tenant-v1.sql",
    "fix-oportunidades-update-governado-v1.sql",
    "fix-clinica-config-rls-v2.sql",
    "baseline-chatbot-leads-nova-base-v1.sql",
    "fix-chatbot-leads-existente-v1.sql",
  ]) {
    assert.ok(ler(`${pasta}/${arquivo}`).length > 100, `${arquivo} deveria existir fora de supabase/migrations`);
  }
});

test("SQLs preparados não contêm palavras-chave ou catálogos truncados", () => {
  for (const sql of [preflight, origem, pedidos, config, chatbotExistente]) {
    assert.doesNotMatch(sql, /\b(?:selec|inser|pg_constrain|column_defaul)\b/i);
  }
  assert.match(origem, /for select/i);
  assert.match(config, /for select/i);
  assert.match(config, /for insert/i);
  assert.match(pedidos, /from pg_constraint/i);
  assert.match(chatbotExistente, /from pg_constraint/i);
});
