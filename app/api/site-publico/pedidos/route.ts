import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { capturarValorItem, type ItemCatalogo } from "../../../../lib/motor-pedidos";
import { logOperacao } from "../../../../lib/log-estruturado";
import { vincularOrigemPublica } from '../../../../lib/atribuicao-vinculos';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ItemEntrada = { servico_id?: unknown; quantidade?: unknown };
type DadosPublicos = { clinica_id: string };

function texto(valor: unknown, maximo: number): string | null {
  if (typeof valor !== "string") return null;
  const normalizado = valor.trim();
  return normalizado && normalizado.length <= maximo ? normalizado : null;
}

export async function POST(req: NextRequest) {
  let body: {
    slug?: unknown;
    nome_cliente?: unknown;
    telefone?: unknown;
    observacao?: unknown;
    itens?: unknown;
    idempotency_key?: unknown;
    codigo_rastreio?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ sucesso: false, error: "Body inválido" }, { status: 400 });
  }

  const slug = texto(body.slug, 120);
  const nomeCliente = texto(body.nome_cliente, 160);
  const telefone = texto(body.telefone, 40);
  const observacao = body.observacao === undefined ? null : texto(body.observacao, 500);
  const idempotencyKey = texto(body.idempotency_key, 120);

  if (!slug || !nomeCliente || !telefone || !idempotencyKey) {
    return NextResponse.json({ sucesso: false, error: "slug, nome_cliente, telefone e idempotency_key são obrigatórios" }, { status: 400 });
  }
  if (body.observacao !== undefined && body.observacao !== null && observacao === null) {
    return NextResponse.json({ sucesso: false, error: "observação inválida" }, { status: 400 });
  }
  if (!Array.isArray(body.itens) || body.itens.length === 0 || body.itens.length > 50) {
    return NextResponse.json({ sucesso: false, error: "pedido precisa ter entre 1 e 50 itens" }, { status: 400 });
  }

  if (body.itens.some(item => !item || typeof item !== "object" || Array.isArray(item))) {
    return NextResponse.json({ sucesso: false, error: "Item inválido" }, { status: 400 });
  }
  const itensEntrada = body.itens as ItemEntrada[];
  const ids = itensEntrada.map((item) => item.servico_id);
  if (ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids as string[]).size !== ids.length) {
    return NextResponse.json({ sucesso: false, error: "cada item deve ter um serviço de catálogo único" }, { status: 400 });
  }
  if (itensEntrada.some((item) => !Number.isInteger(item.quantidade) || Number(item.quantidade) <= 0 || Number(item.quantidade) > 99)) {
    return NextResponse.json({ sucesso: false, error: "quantidade deve ser um inteiro entre 1 e 99" }, { status: 400 });
  }

  // O slug é a única entrada pública de tenant. O produto é literal e o
  // clinica_id nunca vem do navegador.
  const { data: empresa, error: erroEmpresa } = await admin
    .rpc("site_publico_por_slug_v2", { p_slug: slug, p_produto: "organizapro" })
    .maybeSingle<DadosPublicos>();
  if (erroEmpresa || !empresa?.clinica_id) {
    return NextResponse.json({ sucesso: false, error: "Empresa não encontrada" }, { status: 404 });
  }
  const clinicaId = empresa.clinica_id;
  const chaveIdempotencia = `criar-pedido-publico:${idempotencyKey}`;

  const { data: eventoExistente, error: erroIdempotencia } = await admin
    .from("eventos_dominio")
    .select("entidade_id")
    .eq("clinica_id", clinicaId)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();
  if (erroIdempotencia) return NextResponse.json({ sucesso: false, error: "Não foi possível verificar a tentativa anterior" }, { status: 503 });
  if (eventoExistente?.entidade_id) {
    const { data: pedidoExistente } = await admin
      .from("pedidos")
      .select("*, pedido_itens(*)")
      .eq("id", eventoExistente.entidade_id)
      .eq("clinica_id", clinicaId)
      .maybeSingle();
    if (pedidoExistente) {
      await vincularOrigemPublica(admin, clinicaId, body.codigo_rastreio, 'pedido', pedidoExistente.id);
      return NextResponse.json({ sucesso: true, idempotente: true, pedido: pedidoExistente });
    }
  }

  if (eventoExistente) return NextResponse.json({ sucesso: false, error: "Registro anterior indisponível; não foi criado outro pedido" }, { status: 409 });

  const { data: catalogo, error: erroCatalogo } = await admin
    .from("clinica_servicos")
    .select("id, clinica_id, nome, preco_centavos, disponivel")
    .eq("clinica_id", clinicaId)
    .in("id", ids as string[]);
  if (erroCatalogo) return NextResponse.json({ sucesso: false, error: "Não foi possível validar o catálogo" }, { status: 500 });

  const catalogoPorId = new Map((catalogo ?? []).map((item) => [item.id as string, item]));
  const itensResolvidos: { servico_id: string; descricao: string; quantidade: number; valor_unitario_centavos: number; valor_total_centavos: number }[] = [];
  for (const item of itensEntrada) {
    const servicoId = item.servico_id as string;
    const servico = catalogoPorId.get(servicoId);
    if (!servico) return NextResponse.json({ sucesso: false, error: "Um item não pertence a esta empresa" }, { status: 400 });
    const quantidade = item.quantidade as number;
    const valorTotal = capturarValorItem({
      id: servico.id as string,
      clinicaId: servico.clinica_id as string,
      precoCentavos: servico.preco_centavos as number | null,
      disponivel: servico.disponivel as boolean,
    } satisfies ItemCatalogo, quantidade);
    if (valorTotal === null) return NextResponse.json({ sucesso: false, error: "Um item está indisponível ou sem preço público" }, { status: 400 });
    itensResolvidos.push({
      servico_id: servicoId,
      descricao: servico.nome as string,
      quantidade,
      valor_unitario_centavos: servico.preco_centavos as number,
      valor_total_centavos: valorTotal,
    });
  }

  const valorTotal = itensResolvidos.reduce((total, item) => total + item.valor_total_centavos, 0);
  if (!Number.isSafeInteger(valorTotal) || valorTotal <= 0 || valorTotal > 2147483647) {
    return NextResponse.json({ sucesso: false, error: "Total do pedido inválido ou acima do limite suportado" }, { status: 400 });
  }
  const agora = new Date().toISOString();
  const { data: pedido, error: erroPedido } = await admin.from("pedidos").insert({
    clinica_id: clinicaId,
    nome_cliente: nomeCliente,
    telefone,
    valor_centavos: valorTotal,
    status: "criado",
    origem: "site_publico",
    observacao,
    criado_em: agora,
  }).select().single();
  if (erroPedido || !pedido) return NextResponse.json({ sucesso: false, error: "Não foi possível registrar o pedido" }, { status: 500 });

  const { data: itensGravados, error: erroItens } = await admin.from("pedido_itens")
    .insert(itensResolvidos.map((item) => ({ ...item, pedido_id: pedido.id, clinica_id: clinicaId }))).select();
  if (erroItens) {
    await admin.from("pedidos").delete().eq("id", pedido.id).eq("clinica_id", clinicaId);
    return NextResponse.json({ sucesso: false, error: "Não foi possível registrar os itens do pedido" }, { status: 500 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id: clinicaId,
    tipo: "pedido.criado",
    entidade_tipo: "pedido",
    entidade_id: pedido.id,
    chave_idempotencia: chaveIdempotencia,
    payload: { origem: "site_publico", quantidade_itens: itensResolvidos.length },
    criado_em: agora,
  });
  if (erroEvento) {
    await admin.from("pedido_itens").delete().eq("pedido_id", pedido.id).eq("clinica_id", clinicaId);
    await admin.from("pedidos").delete().eq("id", pedido.id).eq("clinica_id", clinicaId);
    return NextResponse.json({ sucesso: false, error: "Não foi possível confirmar o registro do pedido" }, { status: 409 });
  }

  logOperacao({ operacao: "pedido.publico.criar", clinica_id: clinicaId, entidade_id: pedido.id, resultado: "sucesso" });
  await vincularOrigemPublica(admin, clinicaId, body.codigo_rastreio, 'pedido', pedido.id);
  return NextResponse.json({ sucesso: true, idempotente: false, pedido: { ...pedido, pedido_itens: itensGravados } }, { status: 201 });
}
