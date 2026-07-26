// ── IA Universal · Camada 1 (Núcleo Universal) ──────────────────────────────
//
// Ver docs/ia-universal-organizapro-v1-arquitetura.md, seção 3. Determinístico,
// sem IA generativa, sem vocabulário de nenhum segmento específico aqui —
// "convênio", "procedimento" etc. NÃO pertencem a este arquivo, só aos
// módulos em modulos-segmento.ts.
//
// Fase 1: roda em PARALELO ao classificarTopico/montarResposta existentes em
// app/api/chatbot/message/route.ts. Nunca os substitui nesta fase — quando
// esta camada não resolve (retorna null), quem chama cai no sistema atual.
//
// Regra de segurança mais importante desta fase (decisão do Diretor,
// 2026-07-25): frases genéricas como "quanto custa" NUNCA podem ser
// respondidas com preço/plano do próprio OrganizaPro — só com o contexto da
// empresa autenticada. Por construção, `montarRespostaUniversal` só lê
// `DadosEmpresaUniversal` (nunca um texto fixo de venda do OrganizaPro), e
// `respeitaRegrasDeSeguranca` é uma segunda barreira que barra qualquer
// resposta que ainda assim citasse os termos comerciais do OrganizaPro.

import type { DadosEmpresaUniversal, IntencaoUniversal, ModuloSegmento, ResultadoCamadaUniversal } from "./tipos";

export function normalizarUniversal(t: string): string {
  return t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ─── Classificador de intenção (só universal — nada de segmento aqui) ───────

export function classificarIntencaoUniversal(
  mensagem: string,
  vocabularioSegmento: string[] = [],
): IntencaoUniversal {
  const t = normalizarUniversal(mensagem);
  const palavras = t.split(/\s+/).filter(Boolean);
  const mensagemCurta = palavras.length <= 6;

  // Ordem importa: os padrões mais específicos vêm antes dos mais genéricos,
  // porque um substring genérico ("marcar" dentro de "remarcar", "horario"
  // dentro de "quero agendar um horario") pode aparecer dentro de uma frase
  // com intenção mais específica — quem casar primeiro decide.
  if (/^(oi|ola|bom dia|boa tarde|boa noite|hey|e ai|eae)\b/.test(t))                      return "saudacao";
  if (mensagemCurta && /\b(tchau|ate mais|ate logo|falou|flw|valeu|obrigad[oa])\b/.test(t)) return "despedida";
  if (/reagendar|remarcar|desmarcar|mudar (o |meu )?horario/.test(t))                      return "reagendar_cancelar";
  if (/\bcancelar\b/.test(t))                                                              return "reagendar_cancelar";
  if (/agendar|\bmarcar\b|reservar|encaixar|quero um horario|quero marcar/.test(t))         return "agendar";
  if (/confirm(o|ar|ado)\b|estarei la|estou indo|pode confirmar/.test(t))                   return "confirmar_presenca";
  if (/hor[a]rio|funciona|\babre\b|\bfecha\b|atende quando|que horas/.test(t))              return "horario_funcionamento";
  if (/endereco|localiz|onde fica|como cheg|fica onde/.test(t))                            return "endereco_localizacao";
  if (/quanto custa|\bpreco\b|\bvalor\b|quanto e |quanto fica|qual o valor/.test(t))        return "duvida_preco_generica";
  if (/humano|atendente|\bpessoa\b|recepcao|falar com|fale com/.test(t))                    return "falar_com_humano";
  if (/obrigad[oa] pelo atendimento|adorei|excelente atendimento|otimo atendimento|parabens|reclama|pessimo|horrivel|insatisfeit/.test(t)) return "elogio_reclamacao";
  if (vocabularioSegmento.some(termo => t.includes(normalizarUniversal(termo))))            return "intencao_especifica_segmento";
  return "fora_do_escopo";
}

// ─── Montagem de resposta (só a partir de DadosEmpresaUniversal) ────────────

export function montarRespostaUniversal(
  intencao: IntencaoUniversal,
  dados: DadosEmpresaUniversal,
): string | null {
  const link = dados.linkHumano ? `\n\nSe preferir, fale direto com nossa equipe: ${dados.linkHumano}` : "";

  switch (intencao) {
    case "saudacao":
      return `Olá! 👋 Bem-vindo(a) à ${dados.nome}. Como posso te ajudar hoje?`;
    case "despedida":
      return `Foi um prazer falar com você! Qualquer coisa, estou por aqui. 👋`;
    case "horario_funcionamento":
      return dados.horario ? `Nosso horário de atendimento:\n\n${dados.horario}` : null;
    case "endereco_localizacao":
      return dados.endereco ? `Estamos localizados em:\n\n${dados.endereco}` : null;
    case "agendar":
      return `Para agendar, me diga o melhor dia e horário — nossa equipe confirma com você.${link}`;
    case "reagendar_cancelar":
      return `Sem problemas. Me diga o que precisa reagendar ou cancelar que já encaminho para a equipe.${link}`;
    case "confirmar_presenca":
      return `Combinado, presença confirmada! Até lá. ✅`;
    case "duvida_preco_generica":
      // Nunca cita valor do OrganizaPro nem estima um número — só o que a
      // própria empresa (dados) informar. Como DadosEmpresaUniversal não tem
      // campo de preço nesta fase, a resposta é sempre este encaminhamento.
      return `No momento não tenho um valor fixo para te passar por aqui, mas nossa equipe confirma certinho pra você.${link}`;
    case "falar_com_humano":
      return dados.linkHumano
        ? `Claro! Para falar com nossa equipe:\n\n${dados.linkHumano}`
        : `Vou te conectar com nossa equipe em breve.`;
    case "elogio_reclamacao":
      return `Agradeço muito seu retorno — isso é muito importante para a gente.${link}`;
    case "fora_do_escopo":
    case "intencao_especifica_segmento":
      return null;
  }
}

// ─── Regras de segurança (segunda barreira, depois da resposta montada) ────
//
// Por construção, nada nesta camada tem acesso a texto de venda do
// OrganizaPro — mas esta função existe como rede de segurança explícita,
// testável isoladamente, para o caso de um módulo de segmento (ou uma
// evolução futura) introduzir por engano um termo comercial do OrganizaPro
// numa resposta que deveria falar só da empresa do tenant.

const TERMOS_PROIBIDOS_ORGANIZAPRO = [
  "r$99", "r$ 99", "r$997", "r$ 997",
  "mensalidade do organizapro", "assinar o organizapro", "contratar o organizapro",
  "plano agencia", "plano padrao do organizapro", "implantacao custa",
  "demonstracao gratuita do organizapro",
];

export function respeitaRegrasDeSeguranca(resposta: string): boolean {
  const t = normalizarUniversal(resposta);
  return !TERMOS_PROIBIDOS_ORGANIZAPRO.some(termo => t.includes(normalizarUniversal(termo)));
}

// ─── Orquestrador Camada 1 + Camada 2 (o que app/api/chatbot/message/route.ts chama) ──
//
// Contrato: devolve um resultado pronto para enviar, ou `null` quando não
// consegue resolver com segurança — nesse caso, quem chamou deve cair no
// comportamento atual (classificarTopico/montarResposta), sem exceção.

export function resolverComCamadaUniversal(
  mensagem: string,
  dados: DadosEmpresaUniversal,
  modulo: ModuloSegmento,
): ResultadoCamadaUniversal | null {
  const intencao = classificarIntencaoUniversal(mensagem, modulo.vocabularioReconhecido);

  if (intencao !== "intencao_especifica_segmento" && intencao !== "fora_do_escopo") {
    const resposta = montarRespostaUniversal(intencao, dados);
    if (resposta && respeitaRegrasDeSeguranca(resposta)) return { intencao, resposta };
    return null;
  }

  if (intencao === "intencao_especifica_segmento") {
    const msgNorm = normalizarUniversal(mensagem);
    for (const sinal of modulo.intencoesAdicionais) {
      const bate = sinal.exemplosDeFrase.some(frase => msgNorm.includes(normalizarUniversal(frase)));
      if (!bate) continue;
      const resposta = sinal.resolver(dados);
      if (resposta && respeitaRegrasDeSeguranca(resposta)) return { intencao, resposta, modulo: modulo.chave };
      return null;
    }
    return null; // vocabulário do segmento bateu, mas nenhuma intenção específica reconheceu a frase exata
  }

  return null; // fora_do_escopo → sistema atual decide, mantendo paridade com o comportamento de hoje
}
