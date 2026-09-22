import { NextRequest, NextResponse } from "next/server";
import { unidadePesquisaValida } from "../../../../lib/pesquisa-precos";
import { adminPesquisaPrecos, resolverTenantPesquisaPrecos } from "../../../../lib/pesquisa-precos-servidor";

export async function GET(req: NextRequest) {
  const tenant = await resolverTenantPesquisaPrecos(req);
  if (!tenant.ok) return NextResponse.json({ sucesso: false, error: tenant.error }, { status: tenant.status });

  const [itensRes, catalogoRes] = await Promise.all([
    adminPesquisaPrecos
      .from("pesquisa_preco_itens")
      .select("id, nome, especificacao, unidade_canonica, servico_id, ativo, criado_em")
      .eq("clinica_id", tenant.clinicaId)
      .eq("ativo", true)
      .order("nome"),
    adminPesquisaPrecos
      .from("clinica_servicos")
      .select("id, nome")
      .eq("clinica_id", tenant.clinicaId)
      .order("nome"),
  ]);
  if (itensRes.error || catalogoRes.error) return NextResponse.json({ sucesso: false, error: "Não foi possível carregar os itens" }, { status: 500 });
  return NextResponse.json({ sucesso: true, itens: itensRes.data ?? [], catalogo: catalogoRes.data ?? [] });
}

export async function POST(req: NextRequest) {
  const tenant = await resolverTenantPesquisaPrecos(req);
  if (!tenant.ok) return NextResponse.json({ sucesso: false, error: tenant.error }, { status: tenant.status });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ sucesso: false, error: "Body inválido" }, { status: 400 });
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const especificacao = typeof body.especificacao === "string" ? body.especificacao.trim() : "";
  const servicoId = typeof body.servico_id === "string" && body.servico_id ? body.servico_id : null;
  if (!nome || nome.length > 160) return NextResponse.json({ sucesso: false, error: "Nome do item é obrigatório" }, { status: 400 });
  if (especificacao.length > 1000) return NextResponse.json({ sucesso: false, error: "Especificação deve ter até 1000 caracteres" }, { status: 400 });
  if (!unidadePesquisaValida(body.unidade_canonica)) {
    return NextResponse.json({ sucesso: false, error: "Unidade canônica inválida" }, { status: 400 });
  }

  if (servicoId) {
    const { data: servico } = await adminPesquisaPrecos
      .from("clinica_servicos")
      .select("id")
      .eq("id", servicoId)
      .eq("clinica_id", tenant.clinicaId)
      .maybeSingle();
    if (!servico) return NextResponse.json({ sucesso: false, error: "Serviço não pertence a este negócio" }, { status: 400 });
  }

  const { data, error } = await adminPesquisaPrecos
    .from("pesquisa_preco_itens")
    .insert({
      clinica_id: tenant.clinicaId,
      servico_id: servicoId,
      nome,
      especificacao: especificacao || null,
      unidade_canonica: body.unidade_canonica,
      criado_por: tenant.userId,
    })
    .select("id, nome, especificacao, unidade_canonica, servico_id, ativo, criado_em")
    .single();
  if (error) return NextResponse.json({ sucesso: false, error: "Não foi possível criar o item" }, { status: 500 });
  return NextResponse.json({ sucesso: true, item: data }, { status: 201 });
}
