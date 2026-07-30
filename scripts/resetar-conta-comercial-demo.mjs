/**
 * Reseta o cenário da conta comercial demo (Barbearia Black Crown) para o
 * estado canônico — rodar antes de cada apresentação comercial, sempre que
 * cliques reais (Confirmar, Resolver agora, editar cliente) tiverem
 * alterado o estado desde a última demonstração.
 *
 * Uso: node scripts/resetar-conta-comercial-demo.mjs
 *
 * NÃO apaga login, configuração ou conteúdo do Site Premium — só
 * pacientes/agendamentos/avaliacoes, sempre recarregados com datas
 * relativas ao momento em que este script roda.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { carregarCenario } from "./criar-conta-comercial-demo.mjs";

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

  const registro = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "docs", "conta-comercial-demo.json"), "utf-8"));
  const { clinicaId, userId } = registro;
  console.log(`Resetando cenário para clinica_id ${clinicaId}...`);

  for (const t of ["avaliacoes", "agendamentos", "pacientes"]) {
    const { error } = await admin.from(t).delete().eq("clinica_id", clinicaId);
    console.log(`  ${t} ->`, error ? `ERRO: ${error.message}` : "limpo");
  }

  await carregarCenario(admin, clinicaId, userId);
  console.log("\n✅ Cenário canônico recarregado.");
}

main().catch(err => { console.error("\n❌ Erro inesperado:", err?.message ?? String(err)); process.exit(1); });
