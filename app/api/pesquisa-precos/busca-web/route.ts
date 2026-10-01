// POST /api/pesquisa-precos/busca-web — referências REAIS de preço na web.
// Tenant sempre da sessão (resolverTenantPesquisaPrecos, igual às demais
// rotas da Pesquisa de Preços). Cota durável por usuário e por negócio antes
// de qualquer chamada paga. Não grava referência nem altera preço: devolve
// o resultado para o dono conferir; registrar no histórico usa as rotas
// existentes (itens/fontes/observacoes).

import { NextRequest, NextResponse } from "next/server";
import { adminPesquisaPrecos, resolverTenantPesquisaPrecos } from "../../../../lib/pesquisa-precos-servidor";
import { consumirCotaIa } from "../../../../lib/seguranca-operacoes";
import { executarBuscaWeb, resumirReferencias, type TipoConsultaPreco } from "../../../../lib/pesquisa-precos-web";
import { imagensDasReferencias } from "../../../../lib/pesquisa-precos-imagem";

const COTA_USUARIO_HORA = 10;
const COTA_NEGOCIO_HORA = 40;

export async function POST(req: NextRequest) {
  const tenant = await resolverTenantPesquisaPrecos(req);
  if (!tenant.ok) return NextResponse.json({ sucesso: false, error: tenant.error }, { status: tenant.status });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ sucesso: false, error: "Body inválido" }, { status: 400 });
  const termo = typeof body.termo === "string" ? body.termo.trim() : "";
  const tipo = body.tipo === "produto" || body.tipo === "servico" ? body.tipo as TipoConsultaPreco : null;
  const localidade = typeof body.localidade === "string" ? body.localidade.trim() : "";
  const servicoId = typeof body.servico_id === "string" && body.servico_id ? body.servico_id : null;
  if (termo.length < 2 || termo.length > 160) return NextResponse.json({ sucesso: false, error: "Informe o que pesquisar (2 a 160 caracteres)" }, { status: 400 });
  if (!tipo) return NextResponse.json({ sucesso: false, error: "Escolha produto ou serviço" }, { status: 400 });
  if (localidade.length > 80) return NextResponse.json({ sucesso: false, error: "Cidade deve ter até 80 caracteres" }, { status: 400 });

  // "Seu preço" vem SÓ do catálogo do próprio negócio (nunca do body).
  let seuPrecoCentavos: number | null = null;
  let itemCatalogo: { id: string; nome: string } | null = null;
  if (servicoId) {
    const { data, error } = await adminPesquisaPrecos.from("clinica_servicos")
      .select("id, nome, preco_centavos").eq("id", servicoId).eq("clinica_id", tenant.clinicaId).maybeSingle();
    if (error) return NextResponse.json({ sucesso: false, error: "Não foi possível ler o item do catálogo" }, { status: 500 });
    if (!data) return NextResponse.json({ sucesso: false, error: "Item não pertence a este negócio" }, { status: 400 });
    itemCatalogo = { id: data.id as string, nome: data.nome as string };
    seuPrecoCentavos = typeof data.preco_centavos === "number" && data.preco_centavos > 0 ? data.preco_centavos : null;
  }

  if (!await consumirCotaIa(adminPesquisaPrecos, tenant.clinicaId, `pesquisa-web:${tenant.userId}`, COTA_USUARIO_HORA)
    || !await consumirCotaIa(adminPesquisaPrecos, tenant.clinicaId, "pesquisa-web:negocio", COTA_NEGOCIO_HORA)) {
    return NextResponse.json({ sucesso: false, error: "Limite de pesquisas na web desta hora atingido. Tente mais tarde ou registre preços manualmente." }, { status: 429 });
  }

  const pesquisadoEm = new Date().toISOString();
  const busca = await executarBuscaWeb({ apiKey: process.env.OPENAI_API_KEY, termo, tipo, localidade: localidade || null });
  if (!busca.ok) {
    console.warn("[pesquisa-precos/busca-web] falha do provedor", { status: busca.status });
    return NextResponse.json({ sucesso: false, error: `${busca.erro} Você ainda pode registrar preços manualmente.` }, { status: busca.status });
  }
  const resumo = resumirReferencias(busca.extracao.referencias, { tipo, localidade: localidade || null, seuPrecoCentavos });
  // Produto: imagem declarada pela própria página da loja de cada referência
  // (sem busca extra nem custo de API). Falha/ausência → sem imagem.
  const imagens = tipo === "produto" ? await imagensDasReferencias(busca.extracao.referencias) : new Map<string, string>();
  return NextResponse.json({
    sucesso: true,
    consulta: { termo, tipo, localidade: localidade || null, pesquisadoEm },
    itemCatalogo,
    referencias: busca.extracao.referencias.map(r => ({ ...r, imagemUrl: imagens.get(r.url) ?? null })),
    descartadas: busca.extracao.descartadas,
    fontesConsultadas: busca.extracao.fontesConsultadas,
    respostaInterpretavel: busca.extracao.respostaInterpretavel,
    resumo,
    provedor: { nome: "OpenAI (busca na web)", modelo: busca.modelo },
  });
}
