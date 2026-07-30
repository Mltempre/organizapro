/**
 * Decomissiona totalmente a conta comercial demo (Barbearia Black Crown) —
 * uso único, se esta conta for encerrada. Apaga tudo: cenário, Site
 * Premium, configuração, vínculo, empresa, perfil e login.
 *
 * Uso: node scripts/remover-conta-comercial-demo.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function carregarEnv() {
  const raw = fs.readFileSync(path.resolve(__dirname, "..", ".env.local"), "utf-8");
  const env = {};
  for (const linha of raw.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  const env = carregarEnv();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const registroPath = path.resolve(__dirname, "..", "docs", "conta-comercial-demo.json");
  const registro = JSON.parse(fs.readFileSync(registroPath, "utf-8"));
  const { clinicaId, userId, email } = registro;

  console.log(`Removendo conta comercial demo: ${email} (clinica_id ${clinicaId})`);

  const tabelasPorClinica = [
    "avaliacoes", "agendamentos", "pacientes",
    "clinica_servicos", "clinica_equipe", "clinica_depoimentos",
    "clinica_config", "clinica_usuarios",
  ];
  for (const t of tabelasPorClinica) {
    const { error } = await admin.from(t).delete().eq("clinica_id", clinicaId);
    console.log(`  ${t} ->`, error ? `ERRO: ${error.message}` : "ok");
  }

  const { error: eClinica } = await admin.from("clinicas").delete().eq("id", clinicaId);
  console.log("  clinicas ->", eClinica ? `ERRO: ${eClinica.message}` : "ok");

  const { error: eUsuario } = await admin.from("usuarios").delete().eq("id", userId);
  console.log("  usuarios ->", eUsuario ? `ERRO: ${eUsuario.message}` : "ok");

  const { error: eAuth } = await admin.auth.admin.deleteUser(userId);
  console.log("  auth.users ->", eAuth ? `ERRO: ${eAuth.message}` : "ok");

  fs.unlinkSync(registroPath);
  console.log("\n✅ Decomissionamento concluído. docs/conta-comercial-demo.json removido.");
}

main().catch(err => { console.error("\n❌ Erro inesperado:", err?.message ?? String(err)); process.exit(1); });
