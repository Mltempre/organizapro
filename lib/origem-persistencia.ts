import type { SupabaseClient } from "@supabase/supabase-js";
import { podeVincularOrigem, type TipoOrigem } from "./atribuicao-origem";

// ── Persistência de origem — I/O real, fail-closed ──────────────────────────
// Único lugar do produto que efetivamente lê/escreve `origem_captacoes`.
// A tabela é PROPOSTA (ver docs/atribuicao-origem-fase1-migration-preparada.md)
// e NÃO existe ainda — toda chamada aqui é escrita para não quebrar nada
// quando isso acontece: erro de "tabela/coluna não existe" é só logado,
// nunca propagado. O dia em que a migration rodar, este mesmo código passa
// a persistir de verdade, sem nenhuma mudança. Mesmo padrão já usado em
// app/r/[codigo]/route.ts para o bloco de reputação.
//
// Recebe o client Supabase por parâmetro (nunca cria o seu) — quem chama
// decide se é o client anônimo (captura no site público) ou o de
// service_role (webhook, que já roda com esse privilégio para outras
// escritas). Nunca decide isso por conta própria.

export type OrigemParaPersistir = {
  clinicaId:      string;
  utmSource:      string | null;
  utmMedium:      string | null;
  utmCampaign:    string | null;
  utmContent:     string | null;
  gclid:          string | null;
  fbclid:         string | null;
  referrerHost:   string | null;
  classificacao:  TipoOrigem;
  codigoRastreio: string;
  capturadoEm:    string;
};

/**
 * Insere uma captura de origem. Nunca lança — falha (tabela ausente, RLS,
 * rede) vira só um warn no log do servidor. Não bloqueia nem atrasa a
 * renderização da página que chamou.
 */
export async function persistirOrigemCaptada(
  supabase: SupabaseClient,
  origem: OrigemParaPersistir
): Promise<void> {
  try {
    const { error } = await supabase.from("origem_captacoes").insert({
      clinica_id:      origem.clinicaId,
      utm_source:      origem.utmSource,
      utm_medium:      origem.utmMedium,
      utm_campaign:    origem.utmCampaign,
      utm_content:     origem.utmContent,
      gclid:           origem.gclid,
      fbclid:          origem.fbclid,
      referrer_host:   origem.referrerHost,
      classificacao:   origem.classificacao,
      codigo_rastreio: origem.codigoRastreio,
      capturado_em:    origem.capturadoEm,
    });
    if (error) {
      console.warn("[origem] persistirOrigemCaptada — não persistiu (esperado até a migration rodar):", error.message);
    }
  } catch (e) {
    console.warn("[origem] persistirOrigemCaptada exception:", e instanceof Error ? e.message : e);
  }
}

/**
 * Localiza a origem pelo código de rastreio, DENTRO do tenant informado
 * (nunca busca em outra clínica), e vincula ao paciente — só na primeira
 * vez (idempotente, via podeVincularOrigem + guarda .is() no UPDATE contra
 * corrida entre duas entregas quase simultâneas do webhook). Nunca lança;
 * falha vira warn. Nunca atribui por suposição: se o código não for
 * encontrado NESTE tenant, não faz nada — não tenta adivinhar nem busca em
 * outro clinica_id.
 */
export async function vincularOrigemPorCodigo(
  supabase: SupabaseClient,
  params: { clinicaId: string; codigo: string; pacienteId: string }
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("origem_captacoes")
      .select("id, vinculado_em")
      .eq("clinica_id", params.clinicaId)
      .eq("codigo_rastreio", params.codigo)
      .maybeSingle();

    if (error) {
      console.warn("[origem] vincularOrigemPorCodigo — busca falhou (esperado até a migration rodar):", error.message);
      return;
    }
    if (!data) return; // código inexistente ou de outro tenant — nunca inferido, só ignorado

    if (!podeVincularOrigem({ vinculadoEm: data.vinculado_em })) return;

    const { error: updateError } = await supabase
      .from("origem_captacoes")
      .update({ paciente_id: params.pacienteId, vinculado_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("clinica_id", params.clinicaId)
      .is("vinculado_em", null);

    if (updateError) {
      console.warn("[origem] vincularOrigemPorCodigo — update falhou:", updateError.message);
    }
  } catch (e) {
    console.warn("[origem] vincularOrigemPorCodigo exception:", e instanceof Error ? e.message : e);
  }
}
