// POST /api/pedidos/[id]/transicao — aplica um evento ao pedido (avança a
// máquina de estados). Rota autenticada de staff. Nenhuma automação chama
// esta rota — só ação humana explícita.
//
// Diferente de /api/orcamentos|tratamentos|cobrancas/[id]/transicao (que
// recebem um novo_status direto): pedidos usa EVENTOS
// (lib/motor-pedidos.ts, aplicarEvento) porque "cliente informou
// pagamento" e "pagamento confirmado" precisam continuar semanticamente
// distintos — deixar o chamador escolher um novo_status arbitrário
// permitiria pular esse degrau de segurança sem querer.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import { aplicarEvento, type EventoPedido, type Pedido, type PedidoStatus } from "../../../../../lib/motor-pedidos";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EVENTOS_VALIDOS = ["confirmar_pedido", "cliente_informou_pagamento", "confirmacao_rejeitada", "pagamento_confirmado", "cancelar_pedido"] as const;
type NomeEvento = (typeof EVENTOS_VALIDOS)[number];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { clinica_id?: string; evento?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  const { clinica_id, evento } = body;

  if (!clinica_id || !evento) {
    return NextResponse.json({ sucesso: false, error: "clinica_id e evento são obrigatórios" }, { status: 400 });
  }
  if (!EVENTOS_VALIDOS.includes(evento as NomeEvento)) {
    return NextResponse.json(
      { sucesso: false, error: `evento deve ser um de: ${EVENTOS_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "pedido.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: pedido, error: erroBusca } = await admin
    .from("pedidos")
    .select("*")
    .eq("id", id)
    .eq("clinica_id", clinica_id) // nunca confia no id sozinho — precisa pertencer à clínica autorizada
    .maybeSingle<Pedido & { status: PedidoStatus }>();

  if (erroBusca || !pedido) {
    logOperacao({ operacao: "pedido.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "pedido nao encontrado nesta clinica" });
    return NextResponse.json({ sucesso: false, error: "Pedido não encontrado" }, { status: 404 });
  }

  const agora = new Date().toISOString();
  const eventoPedido = { tipo: evento as NomeEvento } as EventoPedido;
  const resultado = aplicarEvento(pedido, eventoPedido);

  if (!resultado.transicionou) {
    logOperacao({ operacao: "pedido.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: resultado.motivo });
    return NextResponse.json({ sucesso: false, error: resultado.motivo }, { status: 409 });
  }

  const atualizacao: Record<string, unknown> = { status: resultado.novoStatus };
  if (evento === "cliente_informou_pagamento") atualizacao.pagamento_informado_em = agora;
  if (evento === "pagamento_confirmado") atualizacao.pagamento_confirmado_em = agora;

  const { data: atualizado, error: erroUpdate } = await admin
    .from("pedidos")
    .update(atualizacao)
    .eq("id", id)
    .eq("clinica_id", clinica_id) // defesa em profundidade — nenhuma escrita fica sem filtro de tenant
    .eq("status", pedido.status) // guarda otimista contra concorrência
    .select()
    .maybeSingle();

  if (erroUpdate) {
    logOperacao({ operacao: "pedido.transicao", clinica_id, entidade_id: id, resultado: "erro", motivo: erroUpdate.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível processar a transição" }, { status: 400 });
  }
  if (!atualizado) {
    logOperacao({ operacao: "pedido.transicao", clinica_id, entidade_id: id, resultado: "rejeitado", motivo: "estado mudou entre leitura e escrita (concorrência)" });
    return NextResponse.json({ sucesso: false, error: "O pedido foi alterado por outra requisição — tente novamente" }, { status: 409 });
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id,
    tipo: `pedido.${resultado.novoStatus}`,
    entidade_tipo: "pedido",
    entidade_id: id,
    chave_idempotencia: `${id}:pedido.${resultado.novoStatus}:${evento}`,
    payload: { status_anterior: pedido.status, status_novo: resultado.novoStatus, evento },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "pedido.transicao", clinica_id, entidade_id: id, resultado: "erro", motivo: `evento nao gravado: ${erroEvento.message}` });
  }

  logOperacao({ operacao: "pedido.transicao", clinica_id, entidade_id: id, resultado: "sucesso", motivo: `${pedido.status} -> ${resultado.novoStatus}` });
  return NextResponse.json({ sucesso: true, pedido: atualizado });
}
