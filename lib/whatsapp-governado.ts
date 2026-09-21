// ── WhatsApp Governado V1 ────────────────────────────────────────────────
// Domínio puro (sem DB/HTTP). Fecha o elo que faltava entre o que já
// existe (Cobrador Digital V1 e Follow-up Comercial V1, ambos param no
// modo "preparatorio" — preparam a mensagem, nunca enviam) e o envio real
// via POST /api/whatsapp (adaptador Z-API já em produção, reaproveitado
// sem nenhuma duplicação).
//
// Modelo de governança: SUGERIR (já existe — .../tentativa) -> APROVAR
// (este arquivo + as novas rotas .../aprovar-envio, sempre acionadas por
// um humano autenticado) -> ENVIAR (POST /api/whatsapp, inalterado).
// AUTOMÁTICO não é construído nesta missão — nenhuma rota de aprovação
// aceita o segredo de serviço interno, só autorizarUsuarioNaClinica (um
// humano real), então não existe caminho para automação chamar isto.
//
// ── Consentimento/opt-out sem migration ──────────────────────────────
// Não existe nenhuma coluna ou tabela de consentimento hoje (auditado:
// nenhum campo optout/bloqueado/consentimento em nenhuma tabela de
// produção). eventos_dominio.entidade_id é uuid NOT NULL — não aceita um
// telefone bruto como chave. entidadeIdDeterministico deriva um uuid
// ESTÁVEL (sha256 truncado, formatado 8-4-4-4-12) a partir de campos reais
// (clinica_id + telefone), sem fabricar nenhum dado novo: é só uma forma
// de indexar um telefone dentro de uma coluna uuid, sempre reproduzível a
// partir dos mesmos dados de entrada, nunca armazenada nem exposta como
// "o telefone" em si (o texto real do telefone continua no payload).
//
// O mesmo mecanismo corrige, para o consumo desta missão, uma
// inconsistência já existente em app/api/follow-up/tentativa/route.ts:
// os casos "oportunidade_parada" e "recompra_possivel" usam telefone
// normalizado como entidade_id (ver lib/follow-up-comercial.ts, comentário
// da linha 58) e gravam esse texto bruto diretamente em eventos_dominio —
// o insert falharia contra o schema real (uuid NOT NULL). Corrigido nas
// dias novas inserções desta missão; ver rota .../tentativa para a
// correção pontual aplicada nos dois call sites afetados.

import { createHash } from "node:crypto";

// ─── Telefone ────────────────────────────────────────────────────────────
// Mesmo algoritmo já usado (duplicado) em app/api/whatsapp/route.ts e
// app/api/webhook/zapi/route.ts — replicado aqui (não exportado de lá)
// para que a chave derivada bata com o telefone que o webhook realmente
// processa, sem depender de importar uma rota Next.js num motor puro.
export function normalizarTelefone(telefone: string): string {
  const soNumeros = telefone.replace(/\D/g, "");
  if (soNumeros.startsWith("55") && soNumeros.length >= 12) return soNumeros;
  return "55" + soNumeros;
}

// ─── Entidade determinística (telefone/mensagem -> uuid estável) ────────

export function entidadeIdDeterministico(...partes: string[]): string {
  const hash = createHash("sha256").update(partes.join(":")).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function entidadeIdDeTelefone(clinicaId: string, telefone: string): string {
  return entidadeIdDeterministico(clinicaId, normalizarTelefone(telefone));
}

// ─── Consentimento / opt-out ─────────────────────────────────────────────
// Representa pelo menos 3 estados, como exigido: permitido, bloqueado,
// desconhecido. Sem nenhum registro prévio, o estado é "desconhecido" —
// nunca tratado como bloqueio automático (isso desligaria silenciosamente
// todo envio de todo contato existente, sem nenhuma base real para tanto;
// não inventamos uma obrigação jurídica específica). "desconhecido" só é
// TRATADO como permitido pela função de decisão abaixo — nunca pelo tipo
// em si, que preserva a distinção.

export type EstadoConsentimento = "permitido" | "bloqueado" | "desconhecido";

export type EventoConsentimento = { criadoEm: string; estado: "permitido" | "bloqueado" };

/**
 * O estado vigente é sempre o evento mais recente (mesmo princípio de
 * "fato vigente" de lib/memoria-proveniencia.ts) — nunca uma soma ou
 * maioria de eventos antigos. Sem nenhum evento, "desconhecido".
 */
export function estadoConsentimentoAtual(eventos: EventoConsentimento[]): EstadoConsentimento {
  if (eventos.length === 0) return "desconhecido";
  const maisRecente = [...eventos].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0))[0];
  return maisRecente.estado;
}

// ─── Detecção de pedido de opt-out (palavra-chave exata) ─────────────────
// Mesmo padrão já auditado em app/api/webhook/zapi/route.ts (CONFIRMAR_
// EXATO/REAGENDAR_EXATO): casamento EXATO após normalização, nunca por
// substring — "não vou parar de indicar vocês" nunca deve disparar
// opt-out só por conter "parar". Lista curta e conservadora; ampliar só
// com evidência real de frases que clientes de fato usam.

function normalizar(t: string): string {
  return t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const OPTOUT_EXATO = new Set([
  "parar", "pare", "sair", "stop",
  "cancelar inscricao", "descadastrar",
  "nao quero mais receber", "remover meu numero", "remover meu contato",
]);

export function detectarPedidoOptOut(mensagem: string): boolean {
  return OPTOUT_EXATO.has(normalizar(mensagem));
}

// ─── Idempotência ─────────────────────────────────────────────────────
// Mesmo padrão de chave usada em todo o sistema (GBP, orçamentos,
// cobranças, follow-up): "<entidade>:<tipo.evento>:<chave>". O idempotency_
// key é gerado pelo CLIENTE (crypto.randomUUID por tentativa de clique,
// mesmo padrão de app/cobrancas/page.tsx) — protege contra duplo-clique/
// retry na aprovação; um novo clique deliberado (nova idempotency_key)
// depois de uma falha real continua permitido.

export function chaveIdempotenciaEnvioAprovado(tipoEvento: string, entidadeId: string, idempotencyKey: string): string {
  return `${entidadeId}:${tipoEvento}:${idempotencyKey}`;
}

export function chaveIdempotenciaConsentimento(entidadeId: string, idempotencyKey: string): string {
  return `${entidadeId}:whatsapp.consentimento:${idempotencyKey}`;
}

// Dedup de webhook — só usada quando o provider manda um identificador
// real de mensagem (messageId). Sem esse campo, a chamada simplesmente
// não é feita (ver rota) — nunca inventa uma chave a partir de conteúdo,
// o que rejeitaria por engano duas mensagens iguais legítimas ("sim"
// enviado duas vezes por engano vs. um clique duplo do provider são
// coisas diferentes, e só o messageId real distingue os dois casos).
export function chaveIdempotenciaWebhookRecebido(instanceId: string, messageId: string): string {
  return `${instanceId}:${messageId}`;
}

// ─── Decisão de envio (gate final, fail-closed) ─────────────────────────

export type MotivoBloqueioEnvio =
  | "sem_telefone"
  | "nao_preparado"
  | "ja_enviado"
  | "consentimento_bloqueado";

export type DecisaoEnvio = { pode: true } | { pode: false; motivo: MotivoBloqueioEnvio };

const MOTIVO_MENSAGEM_ENVIO: Record<MotivoBloqueioEnvio, string> = {
  sem_telefone: "Contato sem telefone cadastrado — impossível enviar.",
  nao_preparado: "Nenhuma tentativa preparada encontrada para este caso — prepare antes de aprovar o envio.",
  ja_enviado: "Este caso já teve um envio aprovado — evita duplicidade.",
  consentimento_bloqueado: "Este contato pediu para não receber mais mensagens — envio bloqueado.",
};

export function mensagemMotivoBloqueioEnvio(motivo: MotivoBloqueioEnvio): string {
  return MOTIVO_MENSAGEM_ENVIO[motivo];
}

/**
 * Fail-closed: só permite aprovar o envio quando TUDO é real e permitido.
 * statusTentativa vem sempre relido do eventos_dominio no momento da
 * chamada (nunca do que a tela mandou) — "preparada" é o único estado que
 * autoriza um envio novo; "enviada"/"falhou" não autorizam repetir (uma
 * nova tentativa exige preparar de novo, reabrindo a elegibilidade real
 * pelo motor de origem). consentimento "bloqueado" sempre vence, mesmo
 * que a tentativa esteja preparada.
 */
export function podeAprovarEnvio(input: {
  telefone: string | null;
  statusTentativa: "preparada" | "enviada" | "falhou" | null;
  consentimento: EstadoConsentimento;
}): DecisaoEnvio {
  if (!input.telefone || !input.telefone.trim()) return { pode: false, motivo: "sem_telefone" };
  if (input.statusTentativa === null) return { pode: false, motivo: "nao_preparado" };
  if (input.statusTentativa !== "preparada") return { pode: false, motivo: "ja_enviado" };
  if (input.consentimento === "bloqueado") return { pode: false, motivo: "consentimento_bloqueado" };
  return { pode: true };
}
