// GET /api/estoque?clinica_id=…  — itens do catálogo com configuração e saldo.
// PUT /api/estoque                — configuração de estoque de UM item
//                                   (tipo, SKU, código de barras, controle, mínimo).
// Estoque Comercial Básico V1: operacional/comercial apenas. Autorização por
// negócio (autorizarUsuarioNaClinica) e toda consulta filtrada por clinica_id;
// estoque_saldos só é acessível via service role (RLS sem policy). Antes da
// migration ser aplicada, GET responde estoqueAtivo: false (nunca finge saldo).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { estoqueBaixo, estoqueIndisponivelNoBanco, validarConfigEstoque } from "../../../lib/motor-estoque";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type ItemRow = {
  id: string; nome: string; preco_centavos: number | null; disponivel: boolean | null;
  tipo_item: "produto" | "servico"; sku: string | null; codigo_barras: string | null;
  controla_estoque: boolean; estoque_minimo: number | null;
};

export async function GET(req: NextRequest) {
  const clinicaId = new URL(req.url).searchParams.get("clinica_id");
  if (!clinicaId) return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  const auth = await autorizarUsuarioNaClinica(req, clinicaId);
  if (!auth.ok) return NextResponse.json({ sucesso: false, error: auth.error }, { status: auth.status });

  const { data: itens, error } = await admin.from("clinica_servicos")
    .select("id, nome, preco_centavos, disponivel, tipo_item, sku, codigo_barras, controla_estoque, estoque_minimo")
    .eq("clinica_id", clinicaId).order("nome");
  if (estoqueIndisponivelNoBanco(error)) return NextResponse.json({ sucesso: true, estoqueAtivo: false, itens: [], estoqueBaixo: 0 });
  if (error || !Array.isArray(itens)) return NextResponse.json({ sucesso: false, error: "Não foi possível carregar o estoque" }, { status: 503 });

  const { data: saldos, error: erroSaldos } = await admin.from("estoque_saldos").select("servico_id, saldo").eq("clinica_id", clinicaId);
  if (estoqueIndisponivelNoBanco(erroSaldos)) return NextResponse.json({ sucesso: true, estoqueAtivo: false, itens: [], estoqueBaixo: 0 });
  if (erroSaldos || !Array.isArray(saldos)) return NextResponse.json({ sucesso: false, error: "Não foi possível carregar o estoque" }, { status: 503 });

  const saldoPorItem = new Map(saldos.map(s => [s.servico_id as string, s.saldo as number]));
  const lista = (itens as ItemRow[]).map(i => {
    const saldo = i.controla_estoque ? saldoPorItem.get(i.id) ?? 0 : null;
    return { ...i, saldo, baixo: saldo !== null && estoqueBaixo(saldo, i.estoque_minimo) };
  });
  return NextResponse.json({ sucesso: true, estoqueAtivo: true, itens: lista, estoqueBaixo: lista.filter(i => i.baixo).length });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.clinica_id !== "string" || typeof body.servico_id !== "string") {
    return NextResponse.json({ sucesso: false, error: "clinica_id e servico_id são obrigatórios" }, { status: 400 });
  }
  const auth = await autorizarUsuarioNaClinica(req, body.clinica_id);
  if (!auth.ok) return NextResponse.json({ sucesso: false, error: auth.error }, { status: auth.status });
  const v = validarConfigEstoque(body);
  if (!v.ok) return NextResponse.json({ sucesso: false, error: v.erro }, { status: 400 });

  const { data, error } = await admin.from("clinica_servicos").update(v.config)
    .eq("id", body.servico_id).eq("clinica_id", body.clinica_id).select("id").maybeSingle();
  if (estoqueIndisponivelNoBanco(error)) return NextResponse.json({ sucesso: false, error: "O controle de estoque ainda não foi ativado." }, { status: 503 });
  if (error?.code === "23505") return NextResponse.json({ sucesso: false, error: "SKU ou código de barras já usado em outro item deste negócio." }, { status: 409 });
  if (error) return NextResponse.json({ sucesso: false, error: "Não foi possível salvar a configuração de estoque" }, { status: 503 });
  if (!data) return NextResponse.json({ sucesso: false, error: "Item não encontrado neste negócio" }, { status: 404 });
  return NextResponse.json({ sucesso: true, config: v.config });
}
