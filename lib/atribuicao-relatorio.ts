// Relatório canônico de atribuição. Reutiliza pagamentos/trilhas da Linha Econômica.
// Capturas e vínculos provam rastreabilidade, nunca causalidade ou validação da API Ads.
import { calcularCAC, calcularROAS, type TipoOrigem } from "./atribuicao-origem";
import { classificarOrigem, origemTemConflito, type OrigemCaptada } from './atribuicao-origem';
import { gerarLinhaEconomica, type EntradaLinhaEconomica } from './linha-economica';
import type { IdentificadoresAds } from './ads-contratos';

export const TIPOS_VINCULO_ATRIBUICAO = ['cliente', 'oportunidade', 'agendamento', 'orcamento', 'pedido', 'cobranca'] as const;
export type TipoVinculoAtribuicao = typeof TIPOS_VINCULO_ATRIBUICAO[number];
export type CaptacaoAtribuicao = OrigemCaptada & {
  id: string; pacienteId: string | null; identificadores: IdentificadoresAds | null;
};
export type VinculoAtribuicao = {
  origemId: string; entidadeTipo: TipoVinculoAtribuicao; entidadeId: string;
  evidencia: string; metodo: 'codigo_site' | 'declaracao_operador';
};
export type EntidadeAtribuicao = { tipo: TipoVinculoAtribuicao; id: string; nome: string };
export type EntradaRelatorioCampanhas = {
  origens: CaptacaoAtribuicao[]; vinculos: VinculoAtribuicao[];
  economica: EntradaLinhaEconomica;
  entidades: EntidadeAtribuicao[];
  oportunidades: { id: string; pacienteId: string | null; agendamentoId: string | null }[];
};
export type LinhaCampanha = {
  chave: string; plataforma: TipoOrigem; fonte: string | null; campanha: string | null;
  anuncio: string | null; capturas: number; leads: number; clientes: number;
  oportunidades: number; orcamentos: number; pedidos: number; agendamentos: number;
  conversoes: number; receitaCentavos: number; cac: null; roas: null;
};

/** Enriquece a Linha Econômica com evidências de origem. Não detecta venda,
 * não usa receita vitalícia do cliente e não escolhe first/last touch por palpite. */
export function gerarRelatorioCampanhas(input: EntradaRelatorioCampanhas) {
  const plataformaCaptada = (o: CaptacaoAtribuicao): TipoOrigem => {
    const tipo = classificarOrigem(o);
    return tipo === 'direto' && o.identificadores?.campaign_id ? 'campanha_utm' : tipo;
  };
  const origens = new Map(input.origens.map(o => [o.id, o]));
  const entidades = new Map(input.entidades.map(e => [`${e.tipo}:${e.id}`, e]));
  const porEntidade = new Map<string, Set<string>>();
  const adicionar = (tipo: string, id: string | null, origemId: string) => {
    if (!id || !origens.has(origemId) || !entidades.has(`${tipo}:${id}`)) return;
    const key = `${tipo}:${id}`;
    const conjunto = porEntidade.get(key) || new Set<string>();
    conjunto.add(origemId); porEntidade.set(key, conjunto);
  };
  for (const v of input.vinculos) {
    if (v.evidencia?.trim()) adicionar(v.entidadeTipo, v.entidadeId, v.origemId);
  }
  for (const o of origens.values()) adicionar('cliente', o.pacienteId, o.id);
  // Somente FKs reais. Cliente em comum nunca transmite atribuição a vendas.
  for (const op of input.economica.oportunidades) {
    for (const origemId of porEntidade.get(`oportunidade:${op.id}`) || []) {
      adicionar('orcamento', op.orcamentoVinculadoId, origemId);
      const detalhe = input.oportunidades.find(o => o.id === op.id);
      adicionar('cliente', detalhe?.pacienteId || null, origemId);
      adicionar('agendamento', detalhe?.agendamentoId || null, origemId);
    }
  }
  const linhas = new Map<string, LinhaCampanha>();
  const chaveOrigem = new Map<string, string>();
  for (const o of origens.values()) {
    const plataforma = plataformaCaptada(o); // reclassifica registros legados conservadoramente
    const campanha = o.identificadores?.campaign_id || o.utmCampaign;
    const anuncio = o.identificadores?.ad_id || o.utmContent;
    const chave = JSON.stringify([plataforma, o.utmSource, campanha, anuncio]);
    chaveOrigem.set(o.id, chave);
    const linha = linhas.get(chave) || { chave, plataforma, fonte: o.utmSource, campanha, anuncio, capturas: 0, leads: 0, clientes: 0, oportunidades: 0, orcamentos: 0, pedidos: 0, agendamentos: 0, conversoes: 0, receitaCentavos: 0, cac: null, roas: null };
    linha.capturas++; linhas.set(chave, linha);
  }
  const conjuntos = new Map<string, Set<string>>();
  const contar = (chave: string, campo: 'leads' | 'clientes' | 'oportunidades' | 'orcamentos' | 'pedidos' | 'agendamentos', id: string) => {
    const key = `${chave}:${campo}`; const set = conjuntos.get(key) || new Set<string>();
    if (!set.has(id)) { linhas.get(chave)![campo]++; set.add(id); conjuntos.set(key, set); }
  };
  const mapaCampo = { cliente: 'clientes', oportunidade: 'oportunidades', agendamento: 'agendamentos', orcamento: 'orcamentos', pedido: 'pedidos' } as const;
  const trilhas = input.entidades.map(e => {
    const ids = [...(porEntidade.get(`${e.tipo}:${e.id}`) || [])];
    if (ids.length === 1) {
      const chave = chaveOrigem.get(ids[0])!;
      if (e.tipo !== 'cobranca') contar(chave, mapaCampo[e.tipo], e.id);
      // Lead = captura com contato/manifestação vinculada, não uma visita.
      if (['cliente', 'oportunidade', 'pedido'].includes(e.tipo)) contar(chave, 'leads', ids[0]);
    }
    return { ...e, origens: ids, estado: ids.length === 1 ? 'vinculado' : ids.length > 1 ? 'incerto' : 'nao_atribuido' };
  });
  const economia = gerarLinhaEconomica(input.economica);
  const vistos = new Set<string>();
  const pagamentos = economia.itens.filter(item => {
    const key = `${item.origem}:${item.id}`;
    if (vistos.has(key)) return false;
    vistos.add(key); return true;
  }).map(item => {
    const dataPagamento = item.origem === 'pedido'
      ? input.economica.pedidos.find(p => p.id === item.id)?.pagamentoConfirmadoEm
      : input.economica.cobrancas.find(c => c.id === item.id)?.pagoEm;
    const candidatos = new Set<string>();
    for (const etapa of item.trilha) {
      for (const id of porEntidade.get(`${etapa.etapa}:${etapa.id}`) || []) candidatos.add(id);
    }
    // A Linha Econômica mantém um orçamento->oportunidade; se houver
    // duplicidade de FK legada, inclui todas as origens para detectar conflito.
    for (const etapa of item.trilha.filter(t => t.etapa === 'orcamento')) {
      for (const op of input.economica.oportunidades.filter(o => o.orcamentoVinculadoId === etapa.id)) {
        for (const id of porEntidade.get(`oportunidade:${op.id}`) || []) candidatos.add(id);
      }
    }
    const ids = [...candidatos];
    const origem = ids.length === 1 ? origens.get(ids[0]) : undefined;
    const valorCentavos = Math.round(item.valor * 100);
    const valorValido = Number.isSafeInteger(valorCentavos) && valorCentavos >= 0;
    const temporal = origem && dataPagamento && Number.isFinite(Date.parse(origem.capturadoEm)) && Date.parse(origem.capturadoEm) <= Date.parse(dataPagamento);
    const origemIdentificada = origem && plataformaCaptada(origem) !== 'direto';
    const conflitoPlataforma = origem && origemTemConflito(origem);
    const atribuida = !!origem && !!temporal && valorValido && !!origemIdentificada && !conflitoPlataforma;
    if (atribuida) {
      const linha = linhas.get(chaveOrigem.get(origem.id)!)!;
      linha.receitaCentavos += valorCentavos; linha.conversoes++;
    }
    return { tipo: item.origem, id: item.id, nome: item.pacienteNome, valorCentavos: valorValido ? valorCentavos : null,
      origemId: atribuida ? origem!.id : null, trilha: item.trilha, ocorridoEm: dataPagamento,
      motivo: atribuida ? 'Vínculo rastreável; não prova causalidade do anúncio' : ids.length > 1 ? 'Origens conflitantes' : conflitoPlataforma ? 'Identificadores de plataforma conflitantes' : origem && !temporal ? 'Captura posterior ao pagamento ou data inválida' : !valorValido ? 'Valor inválido' : origem && !origemIdentificada ? 'Captura sem evidência de origem' : 'Sem vínculo de origem com o pagamento' };
  });
  return {
    linhas: [...linhas.values()], trilhas, pagamentos,
    receitaAtribuidaCentavos: pagamentos.filter(p => p.origemId).reduce((s, p) => s + (p.valorCentavos || 0), 0),
    receitaNaoAtribuidaCentavos: pagamentos.filter(p => !p.origemId).reduce((s, p) => s + (p.valorCentavos || 0), 0),
    capturasSemVinculo: input.origens.filter(o => ![...porEntidade.values()].some(ids => ids.has(o.id))).length,
  };
}
export type RelatorioCampanhas = ReturnType<typeof gerarRelatorioCampanhas>;

export type OrigemCaptacaoResumo = {
  classificacao: TipoOrigem;
  pacienteId:    string | null; // contato vinculado, não prova de receita da campanha
};

export type LinhaRelatorioAtribuicao = {
  classificacao:             TipoOrigem;
  totalCapturas:             number;
  totalVinculados:           number; // atribuição comprovada — nunca inferida
  totalComReceitaComprovada: number;
  receitaComprovadaCentavos: number; // legado: zero; use o relatório por pagamento
  custoCentavos:             null;   // sempre null — sem fonte real de gasto de mídia (Missão 2, item 3/9)
  cac:                       number | null;
  roas:                      number | null;
};

const ORDEM_CLASSIFICACAO: TipoOrigem[] = ["google_ads", "meta_ads", "campanha_utm", "busca_organica", "referencia", "direto"];

/** @deprecated Contagens legadas apenas. Receita requer gerarRelatorioCampanhas,
 * pois paciente em comum não prova vínculo entre uma campanha e um pagamento. */
export function agregarAtribuicao(
  origens: OrigemCaptacaoResumo[],
  _receitaComprovadaPorPacienteCentavos: Record<string, number>
): LinhaRelatorioAtribuicao[] {
  void _receitaComprovadaPorPacienteCentavos;
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

    const vinculados = [...new Set(lista.map(o => o.pacienteId).filter(Boolean))];
    // Compatibilidade de contagens apenas: a assinatura legada não contém
    // vínculo por pagamento/data, portanto não pode provar receita atribuída.
    const receitaComprovadaCentavos = 0;
    const totalComReceitaComprovada = 0;
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
