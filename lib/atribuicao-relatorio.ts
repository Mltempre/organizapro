// ── Relatório de Atribuição V1 (P1.3) ────────────────────────────────────
// Fecha o restante da cadeia que lib/atribuicao-origem.ts (captura +
// classificação) e lib/origem-persistencia.ts (I/O) já resolvem:
// ORIGEM/CAMPANHA → LEAD/OPORTUNIDADE → CONTATO/WHATSAPP já existem e já
// rodam em produção (ver sql/atribuicao-origem-fase1.sql para o porquê a
// tabela ainda não persiste nada). Este arquivo é só a agregação PURA
// (sem DB/HTTP) de ORÇAMENTO/PEDIDO → CONVERSÃO → RECEITA COMPROVADA →
// CAC/ROAS, para o motor já existir pronto no dia em que a migration
// rodar — sem precisar de nenhuma mudança de código depois.
//
// Regras de honestidade (mesma filosofia de lib/atribuicao-origem.ts):
// 1. "Vinculado" (paciente_id não nulo) é sempre atribuição COMPROVADA —
//    o vínculo só existe porque o código de rastreio exato (`ref:xxxxx`)
//    voltou na mensagem do WhatsApp (lib/origem-persistencia.ts,
//    vincularOrigemPorCodigo). Esta arquitetura NUNCA infere atribuição
//    por heurística (ex.: bater telefone/nome sem o código) — não existe
//    "atribuição inferida" aqui; se um dia existir, será um campo novo,
//    nunca confundido com este.
// 2. "Receita comprovada" é sempre a soma de cobranças efetivamente PAGAS
//    (mesmo fato que o Bloco Dinheiro/DinheiroCard já trata como
//    "recebido") — nunca orçamento apresentado, nunca pedido criado.
// 3. custoCentavos é sempre `null` nesta versão: nenhuma integração real
//    com a API de gasto do Google Ads/Meta Ads existe (ver Missão 2,
//    item 9 — BLOQUEADO sem OAuth/credenciais). CAC/ROAS nunca são
//    calculados sobre um custo fabricado — ficam `null` até um custo real
//    existir (API oficial ou lançamento manual confirmado, nenhum dos
//    dois construído nesta versão).

import { calcularCAC, calcularROAS, type TipoOrigem } from "./atribuicao-origem";

export type OrigemCaptacaoResumo = {
  classificacao: TipoOrigem;
  pacienteId:    string | null; // não nulo == atribuição comprovada (ver regra 1)
};

export type LinhaRelatorioAtribuicao = {
  classificacao:             TipoOrigem;
  totalCapturas:             number;
  totalVinculados:           number; // atribuição comprovada — nunca inferida
  totalComReceitaComprovada: number;
  receitaComprovadaCentavos: number; // soma real de cobrancas pagas dos pacientes vinculados
  custoCentavos:             null;   // sempre null — sem fonte real de gasto de mídia (Missão 2, item 3/9)
  cac:                       number | null;
  roas:                      number | null;
};

const ORDEM_CLASSIFICACAO: TipoOrigem[] = ["google_ads", "meta_ads", "campanha_utm", "busca_organica", "referencia", "direto"];

/**
 * Agrega capturas de origem já persistidas + receita já comprovada por
 * paciente (soma de cobrancas.valor_pago, calculada por quem chama —
 * nunca recalculada aqui, para nunca duplicar a regra de "o que é
 * recebido de verdade"). CAC/ROAS sempre null nesta versão (custoCentavos
 * é sempre null — ver regra 3 acima); calcularCAC/calcularROAS já
 * existem prontos e são reaproveitados aqui sem alteração, para o dia em
 * que um custo real (API de Ads ou lançamento manual) existir.
 */
export function agregarAtribuicao(
  origens: OrigemCaptacaoResumo[],
  receitaComprovadaPorPacienteCentavos: Record<string, number>
): LinhaRelatorioAtribuicao[] {
  const porClassificacao = new Map<TipoOrigem, OrigemCaptacaoResumo[]>();
  for (const o of origens) {
    const lista = porClassificacao.get(o.classificacao) ?? [];
    lista.push(o);
    porClassificacao.set(o.classificacao, lista);
  }

  const linhas: LinhaRelatorioAtribuicao[] = [];
  for (const classificacao of ORDEM_CLASSIFICACAO) {
    const lista = porClassificacao.get(classificacao);
    if (!lista || lista.length === 0) continue;

    const vinculados = lista.filter((o) => o.pacienteId !== null);
    let receitaComprovadaCentavos = 0;
    let totalComReceitaComprovada = 0;
    for (const v of vinculados) {
      const receita = receitaComprovadaPorPacienteCentavos[v.pacienteId!] ?? 0;
      if (receita > 0) {
        receitaComprovadaCentavos += receita;
        totalComReceitaComprovada += 1;
      }
    }

    const custoCentavos = null; // regra 3 — nunca fabricado
    linhas.push({
      classificacao,
      totalCapturas: lista.length,
      totalVinculados: vinculados.length,
      totalComReceitaComprovada,
      receitaComprovadaCentavos,
      custoCentavos,
      cac: calcularCAC(custoCentavos, totalComReceitaComprovada),
      roas: calcularROAS(custoCentavos, receitaComprovadaCentavos),
    });
  }
  return linhas;
}
