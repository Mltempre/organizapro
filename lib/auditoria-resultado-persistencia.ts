// ── Auditoria das Decisões — vínculo de Resultado (P1.3, Missão 3) ──────
// I/O real (fora do motor puro lib/auditoria-decisoes.ts, mesmo padrão já
// usado em lib/follow-up-persistencia.ts e lib/origem-persistencia.ts) —
// fecha o elo que faltava na cadeia SINAL → RECOMENDAÇÃO → AÇÃO →
// RESULTADO: prepararVinculoResultado já existia em lib/auditoria-
// decisoes.ts, mas nenhuma rota real o chamava (motor pronto, nunca
// disparado). Este arquivo é o gatilho real: toda vez que uma entidade
// que já teve uma decisão auditada (auditoria.decisao, gravada por
// app/api/follow-up/tentativa) muda de status de verdade, tenta vincular
// esse fato como resultado da decisão original.
//
// Fail-safe por design: nunca lança, nunca bloqueia a transição real que
// já aconteceu — evidência é best-effort, a ação do usuário não pode
// depender dela (mesmo princípio já documentado em app/api/follow-up/
// tentativa/route.ts para a escrita de auditoria.decisao).
//
// Nunca fabrica atribuição: se não existir uma auditoria.decisao prévia
// para esta MESMA entidade, nada é registrado — não infere, não
// "encontra a decisão mais parecida", não assume nada.
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepararVinculoResultado } from "./auditoria-decisoes";

export async function registrarResultadoSeHouveDecisao(
  admin: SupabaseClient,
  params: { clinicaId: string; entidadeTipo: string; entidadeId: string; fatoObservado: string; observadoEm: string }
): Promise<void> {
  try {
    const { data: decisao, error: erroBusca } = await admin
      .from("eventos_dominio")
      .select("chave_idempotencia")
      .eq("clinica_id", params.clinicaId)
      .eq("tipo", "auditoria.decisao")
      .eq("entidade_id", params.entidadeId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (erroBusca || !decisao) return; // sem decisão auditada prévia para esta entidade — nada a vincular

    const registro = prepararVinculoResultado({
      clinicaId: params.clinicaId,
      decisaoOrigemChave: decisao.chave_idempotencia,
      entidadeTipo: params.entidadeTipo,
      entidadeId: params.entidadeId,
      fatoObservado: params.fatoObservado,
      observadoEm: params.observadoEm,
    });
    if (!registro) return;

    const { error: erroInsert } = await admin.from("eventos_dominio").insert({
      clinica_id: params.clinicaId,
      tipo: registro.tipoEvento,
      entidade_tipo: registro.entidadeTipo,
      entidade_id: registro.entidadeId,
      chave_idempotencia: registro.chaveIdempotencia,
      payload: registro.payload,
      criado_em: new Date().toISOString(),
    });
    if (erroInsert && !/duplicate|unique/i.test(erroInsert.message ?? "")) {
      console.warn("[auditoria-resultado] não gravou:", erroInsert.message);
    }
  } catch (e) {
    console.warn("[auditoria-resultado] exceção:", e instanceof Error ? e.message : e);
  }
}
