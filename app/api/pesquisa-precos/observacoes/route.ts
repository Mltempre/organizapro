import { NextRequest, NextResponse } from "next/server";
import {
  compararObservacoes,
  normalizarPrecoObservado,
  unidadePesquisaValida,
  type UnidadePesquisa,
} from "../../../../lib/pesquisa-precos";
import { adminPesquisaPrecos, resolverTenantPesquisaPrecos } from "../../../../lib/pesquisa-precos-servidor";

type ItemDb = { id: string; nome: string; unidade_canonica: UnidadePesquisa };
type FonteDb = { id: string; nome: string; tipo: string; referencia: string | null };
type ObservacaoDb = {
  id: string;
  item_id: string;
  fonte_id: string;
  preco_centavos: number;
  moeda: string;
  quantidade: number;
  unidade_observada: string;
  observado_em: string;
  evidencia_referencia: string | null;
  comparavel: boolean;
  preco_normalizado_centavos: number | null;
  motivo_nao_comparavel: string | null;
  corrige_observacao_id: string | null;
  chave_idempotencia: string;
  criado_em: string;
};

export async function GET(req: NextRequest) {
  const tenant = await resolverTenantPesquisaPrecos(req);
  if (!tenant.ok) return NextResponse.json({ sucesso: false, error: tenant.error }, { status: tenant.status });
  const itemId = new URL(req.url).searchParams.get("item_id");

  let observacoesQuery = adminPesquisaPrecos
    .from("pesquisa_preco_observacoes")
    .select("id, item_id, fonte_id, preco_centavos, moeda, quantidade, unidade_observada, observado_em, evidencia_referencia, comparavel, preco_normalizado_centavos, motivo_nao_comparavel, corrige_observacao_id, chave_idempotencia, criado_em")
    .eq("clinica_id", tenant.clinicaId)
    .order("observado_em", { ascending: false });
  if (itemId) observacoesQuery = observacoesQuery.eq("item_id", itemId);

  const [observacoesRes, itensRes, fontesRes] = await Promise.all([
    observacoesQuery,
    adminPesquisaPrecos.from("pesquisa_preco_itens").select("id, nome, unidade_canonica").eq("clinica_id", tenant.clinicaId),
    adminPesquisaPrecos.from("pesquisa_preco_fontes").select("id, nome, tipo, referencia").eq("clinica_id", tenant.clinicaId),
  ]);
  if (observacoesRes.error || itensRes.error || fontesRes.error) {
    return NextResponse.json({ sucesso: false, error: "Não foi possível carregar o histórico" }, { status: 500 });
  }

  const observacoes = (observacoesRes.data ?? []) as ObservacaoDb[];
  const itens = (itensRes.data ?? []) as ItemDb[];
  const fontes = (fontesRes.data ?? []) as FonteDb[];
  const itensPorId = new Map(itens.map((item) => [item.id, item]));
  const fontesPorId = new Map(fontes.map((fonte) => [fonte.id, fonte]));
  const historico = observacoes.map((observacao) => ({
    ...observacao,
    item: itensPorId.get(observacao.item_id) ?? null,
    fonte: fontesPorId.get(observacao.fonte_id) ?? null,
  }));

  let comparacao = null;
  if (itemId) {
    const item = itensPorId.get(itemId);
    if (!item) return NextResponse.json({ sucesso: false, error: "Item não encontrado" }, { status: 404 });
    comparacao = compararObservacoes(observacoes.map((observacao) => ({
      id: observacao.id,
      fonteId: observacao.fonte_id,
      fonteNome: fontesPorId.get(observacao.fonte_id)?.nome ?? "Fonte indisponível",
      precoCentavos: observacao.preco_centavos,
      quantidade: Number(observacao.quantidade),
      unidadeObservada: observacao.unidade_observada,
      unidadeCanonica: item.unidade_canonica,
      moeda: observacao.moeda,
      observadoEm: observacao.observado_em,
    })));
  }

  return NextResponse.json({ sucesso: true, historico, comparacao });
}

export async function POST(req: NextRequest) {
  const tenant = await resolverTenantPesquisaPrecos(req);
  if (!tenant.ok) return NextResponse.json({ sucesso: false, error: tenant.error }, { status: tenant.status });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ sucesso: false, error: "Body inválido" }, { status: 400 });

  const itemId = typeof body.item_id === "string" ? body.item_id : "";
  const fonteId = typeof body.fonte_id === "string" ? body.fonte_id : "";
  const precoCentavos = typeof body.preco_centavos === "number" ? body.preco_centavos : Number.NaN;
  const quantidade = typeof body.quantidade === "number" ? body.quantidade : Number.NaN;
  const moeda = typeof body.moeda === "string" ? body.moeda.trim().toUpperCase() : "BRL";
  const observadoEm = typeof body.observado_em === "string" ? body.observado_em : "";
  const evidencia = typeof body.evidencia_referencia === "string" ? body.evidencia_referencia.trim() : "";
  const chave = typeof body.chave_idempotencia === "string" ? body.chave_idempotencia.trim() : "";
  const corrigeId = typeof body.corrige_observacao_id === "string" && body.corrige_observacao_id ? body.corrige_observacao_id : null;

  if (!itemId || !fonteId) return NextResponse.json({ sucesso: false, error: "Item e fonte são obrigatórios" }, { status: 400 });
  if (!Number.isInteger(precoCentavos) || precoCentavos <= 0) return NextResponse.json({ sucesso: false, error: "Preço deve ser positivo e informado em centavos" }, { status: 400 });
  if (!Number.isFinite(quantidade) || quantidade <= 0) return NextResponse.json({ sucesso: false, error: "Quantidade deve ser positiva" }, { status: 400 });
  if (!unidadePesquisaValida(body.unidade_observada)) return NextResponse.json({ sucesso: false, error: "Unidade observada inválida" }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(moeda)) return NextResponse.json({ sucesso: false, error: "Moeda inválida" }, { status: 400 });
  const observadoMs = new Date(observadoEm).getTime();
  if (!Number.isFinite(observadoMs) || observadoMs > Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ sucesso: false, error: "Data da observação inválida" }, { status: 400 });
  }
  if (!chave || chave.length > 200) return NextResponse.json({ sucesso: false, error: "Chave de idempotência obrigatória" }, { status: 400 });
  if (evidencia.length > 2000) return NextResponse.json({ sucesso: false, error: "Evidência deve ter até 2000 caracteres" }, { status: 400 });

  const [itemRes, fonteRes, existenteRes] = await Promise.all([
    adminPesquisaPrecos.from("pesquisa_preco_itens").select("id, nome, unidade_canonica").eq("id", itemId).eq("clinica_id", tenant.clinicaId).eq("ativo", true).maybeSingle(),
    adminPesquisaPrecos.from("pesquisa_preco_fontes").select("id, nome, tipo, referencia").eq("id", fonteId).eq("clinica_id", tenant.clinicaId).maybeSingle(),
    adminPesquisaPrecos.from("pesquisa_preco_observacoes").select("*").eq("clinica_id", tenant.clinicaId).eq("chave_idempotencia", chave).maybeSingle(),
  ]);
  const item = itemRes.data as ItemDb | null;
  const fonte = fonteRes.data as FonteDb | null;
  if (!item || !fonte) return NextResponse.json({ sucesso: false, error: "Item ou fonte não pertence a este negócio" }, { status: 400 });
  if (existenteRes.data) {
    const existente = existenteRes.data as ObservacaoDb;
    const mesmoConteudo = existente.item_id === itemId
      && existente.fonte_id === fonteId
      && existente.preco_centavos === precoCentavos
      && Number(existente.quantidade) === quantidade
      && existente.unidade_observada === body.unidade_observada
      && existente.moeda === moeda
      && new Date(existente.observado_em).getTime() === observadoMs
      && existente.corrige_observacao_id === corrigeId
      && (existente.evidencia_referencia ?? "") === evidencia;
    if (!mesmoConteudo) {
      return NextResponse.json({ sucesso: false, error: "Chave de idempotência já usada com conteúdo diferente" }, { status: 409 });
    }
    return NextResponse.json({ sucesso: true, idempotente: true, observacao: existente });
  }
  if (fonte.tipo !== "manual" && !evidencia && !fonte.referencia) {
    return NextResponse.json({ sucesso: false, error: "Esta fonte exige uma evidência rastreável" }, { status: 400 });
  }

  if (corrigeId) {
    const { data: anterior } = await adminPesquisaPrecos
      .from("pesquisa_preco_observacoes")
      .select("id")
      .eq("id", corrigeId)
      .eq("item_id", itemId)
      .eq("clinica_id", tenant.clinicaId)
      .maybeSingle();
    if (!anterior) return NextResponse.json({ sucesso: false, error: "Observação corrigida não pertence ao mesmo item" }, { status: 400 });
  }

  const normalizacao = normalizarPrecoObservado({
    precoCentavos,
    quantidade,
    unidadeObservada: body.unidade_observada,
    unidadeCanonica: item.unidade_canonica,
    moeda,
  });
  const payload = {
    clinica_id: tenant.clinicaId,
    item_id: itemId,
    fonte_id: fonteId,
    preco_centavos: precoCentavos,
    moeda,
    quantidade,
    unidade_observada: body.unidade_observada,
    observado_em: new Date(observadoMs).toISOString(),
    evidencia_referencia: evidencia || null,
    comparavel: normalizacao.comparavel,
    preco_normalizado_centavos: normalizacao.precoNormalizadoCentavos,
    motivo_nao_comparavel: normalizacao.comparavel === false ? normalizacao.motivo : null,
    corrige_observacao_id: corrigeId,
    chave_idempotencia: chave,
    criado_por: tenant.userId,
  };

  const { data, error } = await adminPesquisaPrecos
    .from("pesquisa_preco_observacoes")
    .insert(payload)
    .select("*")
    .single();
  if (error?.code === "23505") {
    const { data: vencedor } = await adminPesquisaPrecos
      .from("pesquisa_preco_observacoes")
      .select("*")
      .eq("clinica_id", tenant.clinicaId)
      .eq("chave_idempotencia", chave)
      .maybeSingle();
    if (vencedor) return NextResponse.json({ sucesso: true, idempotente: true, observacao: vencedor });
  }
  if (error) return NextResponse.json({ sucesso: false, error: "Não foi possível registrar a observação" }, { status: 500 });
  return NextResponse.json({ sucesso: true, idempotente: false, observacao: data }, { status: 201 });
}
