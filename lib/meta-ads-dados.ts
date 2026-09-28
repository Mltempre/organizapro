import "server-only";

// ── Meta Ads V1 — resumo de estado + leitura de métricas (somente servidor) ─
//
// Máquina de estados honesta, reusando o vocabulário do contrato canônico
// ConexaoAds (lib/ads-contratos.ts):
//   • nao_configurada      → sem credencial no servidor OU sem conexão do tenant
//   • conectada            → credencial válida; leitura ok (ou erro de rede)
//   • revogada             → credencial não pôde ser decifrada (reconectar)
//   • pendente_homologacao → Meta recusou a leitura por permissão (App Review)
// Nunca fabrica métricas: falha vira metricas:null + erroMetricas:true.
import type { SupabaseClient } from "@supabase/supabase-js";
import { META_PERIODO_PADRAO, decifrarSegredoMeta, type ConfigMeta } from "./meta-ads";
import { ErroMeta, listarCampanhasMeta, listarInsightsMeta } from "./meta-ads-api";
import { mapearMetricas, type MetricaCampanha } from "./meta-ads-metricas";

export type EstadoMeta = "nao_configurada" | "conectada" | "revogada" | "pendente_homologacao";

/** Erro de domínio: a tabela meta_ads_conexoes não está disponível (migration
 *  ainda não aplicada). Classe própria — e não `instanceof Error` genérico —
 *  porque a verificação precisa ser estável entre módulos carregados em
 *  contextos distintos (testes) e no bundle único do Next (produção). */
export class ErroSchemaMetaAds extends Error {
  constructor() {
    super("META_ADS_SCHEMA_PENDENTE");
    this.name = "ErroSchemaMetaAds";
  }
}
export type DetalheEstadoMeta =
  | "configuracao_ausente"
  | "sem_conexao"
  | "ok"
  | "credencial_invalida"
  | "conta_sem_permissao"
  | "erro_leitura";

export type ResumoMeta = {
  estado: EstadoMeta;
  detalhe: DetalheEstadoMeta;
  conexao: { contaNome: string | null; conectadoEm: string | null } | null;
  metricas: { periodo: string; moeda: string | null; campanhas: MetricaCampanha[] } | null;
  erroMetricas: boolean;
};

const SEM_CONEXAO: ResumoMeta = {
  estado: "nao_configurada",
  detalhe: "sem_conexao",
  conexao: null,
  metricas: null,
  erroMetricas: false,
};

/** Lê o estado da conexão do TENANT e, quando conectado, busca campanhas e
 *  insights na Graph API. Qualquer falha de leitura externa nunca vira dado:
 *  devolve estado honesto + metricas:null. Erro de banco (tabela ainda não
 *  aplicada) é propagado como META_ADS_SCHEMA_PENDENTE para a rota responder
 *  503 indisponível — mesmo padrão de /api/atribuicao. */
export async function resumoMeta(
  admin: SupabaseClient,
  clinicaId: string,
  cfg: ConfigMeta | null
): Promise<ResumoMeta> {
  if (!cfg) {
    return { estado: "nao_configurada", detalhe: "configuracao_ausente", conexao: null, metricas: null, erroMetricas: false };
  }
  const { data, error } = await admin
    .from("meta_ads_conexoes")
    .select("conta_ads_id, conta_ads_nome, moeda, access_token_ciphertext, conectado_em")
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (error) throw new ErroSchemaMetaAds();
  if (!data) return SEM_CONEXAO;

  const conexao = {
    contaNome: typeof data.conta_ads_nome === "string" ? data.conta_ads_nome : null,
    conectadoEm: typeof data.conectado_em === "string" ? data.conectado_em : null,
  };

  let token: string;
  try {
    token = decifrarSegredoMeta(String(data.access_token_ciphertext ?? ""), cfg.tokenKey);
    if (!token) throw new Error("vazio");
  } catch {
    return { estado: "revogada", detalhe: "credencial_invalida", conexao, metricas: null, erroMetricas: false };
  }

  const contaId = typeof data.conta_ads_id === "string" ? data.conta_ads_id : "";
  if (!/^act_\d+$/.test(contaId)) {
    return { estado: "revogada", detalhe: "credencial_invalida", conexao, metricas: null, erroMetricas: false };
  }

  try {
    const [campanhas, insights] = await Promise.all([
      listarCampanhasMeta(contaId, token),
      listarInsightsMeta(contaId, token, META_PERIODO_PADRAO),
    ]);
    return {
      estado: "conectada",
      detalhe: "ok",
      conexao,
      metricas: {
        periodo: META_PERIODO_PADRAO,
        moeda: typeof data.moeda === "string" ? data.moeda : null,
        campanhas: mapearMetricas(campanhas, insights),
      },
      erroMetricas: false,
    };
  } catch (e) {
    if (e instanceof ErroMeta && e.codigo === "PERMISSAO") {
      // A Meta recusou a leitura: dependência de aprovação oficial
      // (Advanced Access/App Review) ou escopo revogado — nunca fingir dado.
      return { estado: "pendente_homologacao", detalhe: "conta_sem_permissao", conexao, metricas: null, erroMetricas: false };
    }
    return { estado: "conectada", detalhe: "erro_leitura", conexao, metricas: null, erroMetricas: true };
  }
}