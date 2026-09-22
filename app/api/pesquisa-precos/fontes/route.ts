import { NextRequest, NextResponse } from "next/server";
import { tipoFontePrecoValido } from "../../../../lib/pesquisa-precos";
import { adminPesquisaPrecos, resolverTenantPesquisaPrecos } from "../../../../lib/pesquisa-precos-servidor";

const TIPOS_QUE_EXIGEM_REFERENCIA = new Set(["documento", "cotacao", "url_verificada", "importacao", "api_autorizada"]);

export async function GET(req: NextRequest) {
  const tenant = await resolverTenantPesquisaPrecos(req);
  if (!tenant.ok) return NextResponse.json({ sucesso: false, error: tenant.error }, { status: tenant.status });
  const { data, error } = await adminPesquisaPrecos
    .from("pesquisa_preco_fontes")
    .select("id, nome, tipo, referencia, criado_em")
    .eq("clinica_id", tenant.clinicaId)
    .order("nome");
  if (error) return NextResponse.json({ sucesso: false, error: "Não foi possível carregar as fontes" }, { status: 500 });
  return NextResponse.json({ sucesso: true, fontes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const tenant = await resolverTenantPesquisaPrecos(req);
  if (!tenant.ok) return NextResponse.json({ sucesso: false, error: tenant.error }, { status: tenant.status });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ sucesso: false, error: "Body inválido" }, { status: 400 });
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const referencia = typeof body.referencia === "string" ? body.referencia.trim() : "";
  if (!nome || nome.length > 160) return NextResponse.json({ sucesso: false, error: "Nome da fonte é obrigatório" }, { status: 400 });
  if (!tipoFontePrecoValido(body.tipo)) return NextResponse.json({ sucesso: false, error: "Tipo da fonte inválido" }, { status: 400 });
  if (referencia.length > 2000) return NextResponse.json({ sucesso: false, error: "Referência deve ter até 2000 caracteres" }, { status: 400 });
  if (TIPOS_QUE_EXIGEM_REFERENCIA.has(body.tipo) && !referencia) {
    return NextResponse.json({ sucesso: false, error: "Esta fonte exige uma referência rastreável" }, { status: 400 });
  }
  if (body.tipo === "url_verificada") {
    try {
      const url = new URL(referencia);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocolo inválido");
    } catch {
      return NextResponse.json({ sucesso: false, error: "Informe uma URL http(s) válida" }, { status: 400 });
    }
  }

  const { data, error } = await adminPesquisaPrecos
    .from("pesquisa_preco_fontes")
    .insert({
      clinica_id: tenant.clinicaId,
      nome,
      tipo: body.tipo,
      referencia: referencia || null,
      criado_por: tenant.userId,
    })
    .select("id, nome, tipo, referencia, criado_em")
    .single();
  if (error) return NextResponse.json({ sucesso: false, error: "Não foi possível criar a fonte" }, { status: 500 });
  return NextResponse.json({ sucesso: true, fonte: data }, { status: 201 });
}
