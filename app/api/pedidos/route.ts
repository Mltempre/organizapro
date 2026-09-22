// Pedidos — E-commerce IA V1. Camada fina de API sobre lib/motor-pedidos.ts.
// Só valida entrada, autentica, autoriza, chama o domínio e devolve
// resposta — nenhuma regra de negócio mora aqui.
//
// public.pedidos, public.pedido_itens e public.clinica_servicos.
// preco_centavos/disponivel JÁ EXISTEM só depois da migration
// 20260920000001_pedidos_ecommerce_ia_v1.sql — PREPARADA, NÃO EXECUTADA.
// public.eventos_dominio já existe em Production (idempotência, mesmo
// padrão de orcamentos/tratamentos/cobrancas).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { logOperacao } from "../../../lib/log-estruturado";
import { capturarValorItem, type ItemCatalogo } from "../../../lib/motor-pedidos";
import { registrarResultadoSeHouveDecisao } from "../../../lib/auditoria-resultado-persistencia";
import { entidadeIdDeTelefone } from "../../../lib/whatsapp-governado";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ItemEntrada = {
  servico_id?: string;      // presente = preço vem SEMPRE do catálogo real, nunca do cliente
  descricao?: string;       // obrigatório quando servico_id ausente (item avulso, digitado pelo staff)
  valor_unitario_centavos?: number; // só usado quando servico_id ausente (mesmo nível de confiança de orcamentos.valor — ação de staff autenticado, nunca de cliente público)
  quantidade: number;
};

// ─── POST /api/pedidos — registrar pedido (venda de catálogo) ────────────
export async function POST(req: NextRequest) {
  let body: {
    clinica_id?: string;
    paciente_id?: string;
    nome_cliente?: string;
    telefone?: string;
    observacao?: string;
    origem?: "manual" | "site_publico";
    itens?: ItemEntrada[];
    idempotency_key?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, paciente_id, nome_cliente, telefone, observacao, itens, idempotency_key } = body;
  const origem = body.origem === "site_publico" ? "site_publico" : "manual";

  if (!clinica_id || !nome_cliente?.trim() || !idempotency_key) {
    return NextResponse.json(
      { sucesso: false, error: "clinica_id, nome_cliente e idempotency_key são obrigatórios" },
      { status: 400 }
    );
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ sucesso: false, error: "pedido precisa de pelo menos 1 item" }, { status: 400 });
  }
  for (const it of itens) {
    if (!Number.isInteger(it.quantidade) || it.quantidade <= 0) {
      return NextResponse.json({ sucesso: false, error: "quantidade de cada item deve ser um inteiro positivo" }, { status: 400 });
    }
    if (!it.servico_id && (!it.descricao?.trim() || !it.valor_unitario_centavos || it.valor_unitario_centavos <= 0)) {
      return NextResponse.json(
        { sucesso: false, error: "item sem servico_id precisa de descricao e valor_unitario_centavos positivo" },
        { status: 400 }
      );
    }
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "pedido.criar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  // Idempotência via eventos_dominio (constraint real UNIQUE(clinica_id,
  // chave_idempotencia)) — mesmo padrão já homologado nos outros 3 motores.
  const chaveIdempotencia = `criar-pedido:${idempotency_key}`;
  const { data: eventoExistente } = await admin
    .from("eventos_dominio")
    .select("entidade_id")
    .eq("clinica_id", clinica_id)
    .eq("chave_idempotencia", chaveIdempotencia)
    .maybeSingle();

  if (eventoExistente) {
    const { data: pedidoExistente } = await admin
      .from("pedidos")
      .select("*, pedido_itens(*)")
      .eq("id", eventoExistente.entidade_id)
      .maybeSingle();
    if (pedidoExistente) {
      logOperacao({ operacao: "pedido.criar", clinica_id, entidade_id: pedidoExistente.id, resultado: "sucesso", motivo: "replay idempotente" });
      return NextResponse.json({ sucesso: true, idempotente: true, pedido: pedidoExistente });
    }
  }

  // Resolve o preço real de cada item que referencia o catálogo — NUNCA
  // aceita valor do cliente para item com servico_id. Busca todos de uma
  // vez, sempre filtrado por clinica_id (nunca confia no id sozinho).
  const idsCatalogo = itens.map((it) => it.servico_id).filter((id): id is string => !!id);
  let catalogoPorId = new Map<string, ItemCatalogo>();
  if (idsCatalogo.length > 0) {
    const { data: catalogo, error: erroCatalogo } = await admin
      .from("clinica_servicos")
      .select("id, clinica_id, preco_centavos, disponivel")
      .eq("clinica_id", clinica_id)
      .in("id", idsCatalogo);
    if (erroCatalogo) {
      logOperacao({ operacao: "pedido.criar", clinica_id, resultado: "erro", motivo: erroCatalogo.message });
      return NextResponse.json({ sucesso: false, error: "Não foi possível validar os itens do catálogo" }, { status: 500 });
    }
    catalogoPorId = new Map((catalogo ?? []).map((c) => [c.id as string, {
      id: c.id as string, clinicaId: c.clinica_id as string,
      precoCentavos: c.preco_centavos as number | null, disponivel: c.disponivel as boolean,
    }]));
  }

  const itensResolvidos: { servico_id: string | null; descricao: string; quantidade: number; valor_unitario_centavos: number; valor_total_centavos: number }[] = [];
  for (const it of itens) {
    if (it.servico_id) {
      const itemCatalogo = catalogoPorId.get(it.servico_id);
      if (!itemCatalogo) {
        logOperacao({ operacao: "pedido.criar", clinica_id, resultado: "rejeitado", motivo: `servico_id ${it.servico_id} nao encontrado nesta clinica` });
        return NextResponse.json({ sucesso: false, error: `Item de catálogo não encontrado nesta clínica: ${it.servico_id}` }, { status: 400 });
      }
      const valorTotal = capturarValorItem(itemCatalogo, it.quantidade);
      if (valorTotal === null) {
        logOperacao({ operacao: "pedido.criar", clinica_id, resultado: "rejeitado", motivo: `item ${it.servico_id} sem preco ou indisponivel` });
        return NextResponse.json({ sucesso: false, error: "Item sem preço definido ou indisponível não pode originar pedido" }, { status: 400 });
      }
      itensResolvidos.push({
        servico_id: it.servico_id,
        descricao: it.descricao?.trim() || "Item de catálogo",
        quantidade: it.quantidade,
        valor_unitario_centavos: itemCatalogo.precoCentavos!,
        valor_total_centavos: valorTotal,
      });
    } else {
      // Item avulso — mesmo nível de confiança de orcamentos.valor: ação
      // de staff autenticado (nunca alcançável por um cliente público sem
      // sessão), nunca originado de origem='site_publico'.
      if (origem === "site_publico") {
        return NextResponse.json({ sucesso: false, error: "pedido de origem site_publico só aceita itens de catálogo (servico_id)" }, { status: 400 });
      }
      itensResolvidos.push({
        servico_id: null,
        descricao: it.descricao!.trim(),
        quantidade: it.quantidade,
        valor_unitario_centavos: it.valor_unitario_centavos!,
        valor_total_centavos: it.valor_unitario_centavos! * it.quantidade,
      });
    }
  }

  const valorTotalPedido = itensResolvidos.reduce((soma, it) => soma + it.valor_total_centavos, 0);
  const agora = new Date().toISOString();

  const { data: novoPedido, error: erroInsertPedido } = await admin
    .from("pedidos")
    .insert({
      clinica_id,
      paciente_id: paciente_id || null,
      nome_cliente: nome_cliente.trim(),
      telefone: telefone?.trim() || null,
      valor_centavos: valorTotalPedido,
      status: "criado",
      origem,
      observacao: observacao?.trim() || null,
      criado_por: autorizacao.userId,
      criado_em: agora,
    })
    .select()
    .single();

  if (erroInsertPedido) {
    logOperacao({ operacao: "pedido.criar", clinica_id, resultado: "erro", motivo: erroInsertPedido.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível criar o pedido" }, { status: 500 });
  }

  const { data: itensGravados, error: erroItens } = await admin
    .from("pedido_itens")
    .insert(itensResolvidos.map((it) => ({ ...it, pedido_id: novoPedido.id, clinica_id })))
    .select();

  if (erroItens) {
    // Corrida ou item inválido pego só na escrita (trigger de tenant) —
    // desfaz o pedido órfão, nunca deixa um pedido sem itens.
    await admin.from("pedidos").delete().eq("id", novoPedido.id);
    logOperacao({ operacao: "pedido.criar", clinica_id, entidade_id: novoPedido.id, resultado: "erro", motivo: `itens nao gravados: ${erroItens.message}` });
    return NextResponse.json({ sucesso: false, error: "Não foi possível registrar os itens do pedido" }, { status: 500 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: "pedido.criado",
    entidade_tipo: "pedido",
    entidade_id: novoPedido.id,
    chave_idempotencia: chaveIdempotencia,
    payload: { status_anterior: null, status_novo: "criado", quantidade_itens: itensResolvidos.length },
    criado_em: agora,
  });

  if (erroEvento) {
    // Corrida real (duas requisições com a mesma idempotency_key quase
    // simultâneas) — mesmo tratamento já homologado nos outros 3 motores:
    // desfaz o órfão (itens + pedido) e devolve quem realmente venceu.
    await admin.from("pedido_itens").delete().eq("pedido_id", novoPedido.id);
    await admin.from("pedidos").delete().eq("id", novoPedido.id);
    const { data: vencedor } = await admin
      .from("eventos_dominio")
      .select("entidade_id")
      .eq("clinica_id", clinica_id)
      .eq("chave_idempotencia", chaveIdempotencia)
      .maybeSingle();
    const { data: pedidoVencedor } = vencedor
      ? await admin.from("pedidos").select("*, pedido_itens(*)").eq("id", vencedor.entidade_id).maybeSingle()
      : { data: null };

    logOperacao({ operacao: "pedido.criar", clinica_id, entidade_id: novoPedido.id, resultado: "rejeitado", motivo: "corrida de idempotência — outra requisição venceu" });

    if (pedidoVencedor) {
      return NextResponse.json({ sucesso: true, idempotente: true, pedido: pedidoVencedor });
    }
    return NextResponse.json({ sucesso: false, error: "Erro de concorrência ao registrar auditoria — tente novamente" }, { status: 409 });
  }

  // Auditoria IA — decisão → ação → resultado: fecha o gap documentado em
  // P1.3 para "recompra" (nunca existiu uma rota de "transição" para
  // recompra_possivel — o resultado real é o cliente fazer um pedido
  // NOVO). auditoria.decisao de recompra_possivel usa entidade_id
  // derivado do telefone, entidadeTipo "cliente" (mesmo padrão de
  // oportunidade_parada — ver app/api/follow-up/tentativa/route.ts).
  // Fail-safe/best-effort: só grava quando existe uma decisão real prévia
  // para ESTE telefone (nunca infere, nunca bloqueia a criação do pedido).
  if (telefone?.trim()) {
    await registrarResultadoSeHouveDecisao(admin, {
      clinicaId: clinica_id,
      entidadeTipo: "cliente",
      entidadeId: entidadeIdDeTelefone(clinica_id, telefone),
      fatoObservado: "pedido_criado",
      observadoEm: agora,
    });
  }

  logOperacao({ operacao: "pedido.criar", clinica_id, entidade_id: novoPedido.id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true, idempotente: false, pedido: { ...novoPedido, pedido_itens: itensGravados } });
}

// ─── GET /api/pedidos?clinica_id=...&status=... — listar ─────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  const status = searchParams.get("status");

  if (!clinica_id) {
    return NextResponse.json({ sucesso: false, error: "clinica_id é obrigatório" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "pedido.listar", clinica_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  let query = admin.from("pedidos").select("*, pedido_itens(*)").eq("clinica_id", clinica_id).order("criado_em", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    logOperacao({ operacao: "pedido.listar", clinica_id, resultado: "erro", motivo: error.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível listar pedidos" }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, pedidos: data ?? [] });
}
