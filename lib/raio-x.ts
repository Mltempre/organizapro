// Fonte única para o Índice ClínicaFlow.
// Importado pela API (/api/raio-x), pelo cron (/api/cron/raio-x) e pela página (/raio-x).

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type IndiceInput = {
  agsSemana:           { status: string }[];
  agsHistorico:        number;
  totalPacientes:      number;
  notaGoogle:          number | null;
  numAvaliacoes:       number | null;
  hasSlug:             boolean;
  hasLogo:             boolean;
  hasHero:             boolean;
  hasNome:             boolean;
  hasZapi:             boolean;
  hasMsgLembrete:      boolean;
  nGaleria:            number;
  nEquipe:             number;
  nSrv:                number;
  tendenciaConfirmacao: number | null;
};

export type IndiceResult = {
  gestao:    number; // 0-25
  site:      number; // 0-25
  reputacao: number; // 0-20
  automacao: number; // 0-15
  atividade: number; // 0-15
  total:     number; // 0-100
};

export type Nivel = {
  emoji: string;
  label: string;
  color: string;
  min:   number;
};

export type ProximoObjetivo = {
  nivel:            Nivel;
  pontosRestantes:  number;
} | null;

// ─── Níveis (ordem decrescente de pontuação) ──────────────────────────────────

export const NIVEIS: Nivel[] = [
  { emoji: "🏆", label: "Clínica Premium", color: "#f59e0b", min: 95 },
  { emoji: "🟢", label: "Excelente",       color: "#22c55e", min: 80 },
  { emoji: "🔵", label: "Em Evolução",     color: "#3b82f6", min: 65 },
  { emoji: "🟡", label: "Atenção",         color: "#eab308", min: 45 },
  { emoji: "🔴", label: "Crítico",         color: "#ef4444", min: 0  },
];

export function nivelAtual(indice: number): Nivel {
  return NIVEIS.find(n => indice >= n.min) ?? NIVEIS[NIVEIS.length - 1];
}

export function proximoObjetivo(indice: number): ProximoObjetivo {
  if (indice >= 95) return null;
  const proximo = [...NIVEIS]
    .reverse()
    .find(n => n.min > indice);
  if (!proximo) return null;
  return { nivel: proximo, pontosRestantes: proximo.min - indice };
}

// ─── Taxa de confirmação ──────────────────────────────────────────────────────

export function taxaConfirmacao(ags: { status: string }[]): number | null {
  if (ags.length === 0) return null;
  const ok = ags.filter(a => a.status === "confirmado" || a.status === "concluido").length;
  return Math.round((ok / ags.length) * 100);
}

// ─── Cálculo do Índice ────────────────────────────────────────────────────────

export function calcularIndice(inp: IndiceInput): IndiceResult {
  const taxa = taxaConfirmacao(inp.agsSemana);

  // Gestão (0-25): taxa de confirmação da semana atual
  const gestao = inp.agsSemana.length === 0
    ? 12
    : Math.floor(Math.min((taxa ?? 0) / 100, 1) * 25);

  // Site (0-25): completude dos módulos do site
  const site = Math.min(
    (inp.hasSlug  ? 4 : 0) +
    (inp.hasLogo  ? 4 : 0) +
    (inp.hasHero  ? 4 : 0) +
    (inp.hasNome  ? 5 : 0) +
    (inp.nGaleria > 0 ? 3 : 0) +
    (inp.nEquipe  > 0 ? 3 : 0) +
    (inp.nSrv     > 0 ? 2 : 0),
    25
  );

  // Reputação (0-20): nota Google + número de avaliações
  let reputacao = 0;
  if (inp.notaGoogle !== null) {
    reputacao += 8;
    if      (inp.notaGoogle >= 4.5) reputacao += 7;
    else if (inp.notaGoogle >= 4.0) reputacao += 4;
    else if (inp.notaGoogle >= 3.5) reputacao += 2;
  }
  if (inp.numAvaliacoes !== null) {
    if      (inp.numAvaliacoes >= 20) reputacao += 5;
    else if (inp.numAvaliacoes >= 10) reputacao += 3;
    else if (inp.numAvaliacoes >= 5)  reputacao += 1;
  }
  reputacao = Math.min(reputacao, 20);

  // Automação (0-15): WhatsApp configurado + mensagem personalizada
  const automacao = Math.min(
    (inp.hasZapi         ? 10 : 0) +
    (inp.hasMsgLembrete  ?  5 : 0),
    15
  );

  // Atividade (0-15): volume de pacientes + histórico + tendência positiva
  let atividade = 0;
  if      (inp.totalPacientes >= 50) atividade += 8;
  else if (inp.totalPacientes >= 20) atividade += 5;
  else if (inp.totalPacientes >= 5)  atividade += 3;
  else if (inp.totalPacientes >= 1)  atividade += 1;
  if (inp.agsHistorico > 0) atividade += 4;
  if (inp.tendenciaConfirmacao !== null && inp.tendenciaConfirmacao > 0) atividade += 3;
  atividade = Math.min(atividade, 15);

  return {
    gestao,
    site,
    reputacao,
    automacao,
    atividade,
    total: Math.min(gestao + site + reputacao + automacao + atividade, 100),
  };
}

// ─── Missão fallback (sem OpenAI) ────────────────────────────────────────────

export function missaoFallback(bd: IndiceResult): string {
  const areas = [
    { score: bd.site      / 25, msg: "Complete o perfil do seu site com logo, fotos e galeria de imagens." },
    { score: bd.reputacao / 20, msg: "Peça avaliações Google para os próximos 5 pacientes atendidos." },
    { score: bd.automacao / 15, msg: "Configure o WhatsApp automático para enviar lembretes de consulta." },
    { score: bd.gestao    / 25, msg: "Confirme os agendamentos pendentes e reduza as faltas desta semana." },
    { score: bd.atividade / 15, msg: "Cadastre seus pacientes para acompanhar a evolução da clínica." },
  ].sort((a, b) => a.score - b.score);
  return areas[0].msg;
}

// ─── Biblioteca de fallbacks inteligentes ─────────────────────────────────────

export type FallbackContext = {
  bd:                   IndiceResult;
  nivel:                Nivel;
  agsSemana:            number;
  taxaSemana:           number | null;
  totalPacientes:       number;
  notaGoogle:           number | null;
  numAvaliacoes:        number | null;
  hasZapi:              boolean;
  nGaleria:             number;
  nEquipe:              number;
  nSrv:                 number;
  tendenciaConfirmacao: number | null;
};

export type FallbackResult = {
  diagnostico:   string;
  pontos_fortes: string;
  oportunidade:  string;
  missao:        string;
  motivacional:  string;
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function gerarFallbacks(ctx: FallbackContext): FallbackResult {
  const { bd, nivel, agsSemana, taxaSemana, totalPacientes, notaGoogle, numAvaliacoes, hasZapi, nGaleria, nEquipe, tendenciaConfirmacao } = ctx;

  type NivelKey = "premium" | "excelente" | "evolucao" | "atencao" | "critico";
  const nivelKey: NivelKey =
    nivel.min >= 95 ? "premium" :
    nivel.min >= 80 ? "excelente" :
    nivel.min >= 65 ? "evolucao" :
    nivel.min >= 45 ? "atencao" : "critico";

  // ── Diagnóstico ──────────────────────────────────────────────────────────────
  const diagnosticos: Record<NivelKey, string[]> = {
    premium: [
      "Sua clínica demonstra excelência operacional consolidada. Os indicadores desta semana confirmam uma gestão de alta performance, com processos bem estruturados e resultados consistentes.",
      "Os indicadores desta semana confirmam um padrão operacional de referência. Sua clínica atingiu o mais alto nível da plataforma, com gestão eficiente e presença digital fortalecida.",
    ],
    excelente: [
      `Sua clínica apresenta uma operação sólida e bem estruturada.${agsSemana > 0 ? ` Com ${agsSemana} agendamento(s) nesta semana,` : ""} os resultados estão acima da média e a trajetória é positiva.`,
      "Os dados desta semana confirmam que sua clínica está operando em alto nível. A gestão está organizada e os indicadores refletem uma operação consistente e em crescimento.",
    ],
    evolucao: [
      `Sua clínica está em uma trajetória de crescimento consistente.${taxaSemana !== null ? ` A taxa de confirmação de ${taxaSemana}% demonstra uma operação ativa.` : ""} A análise identificou oportunidades claras para acelerar sua evolução ao próximo nível.`,
      "Os indicadores mostram que sua clínica está avançando de forma positiva. Com ajustes estratégicos nas próximas semanas, é possível impulsionar significativamente os resultados.",
      "Com base nos indicadores atuais, sua clínica demonstra potencial concreto para alcançar um nível superior com melhorias em áreas específicas. A evolução é constante e mensurável.",
      "A análise desta semana mostra uma operação estável com boas oportunidades para fortalecer a experiência dos pacientes e a presença digital.",
    ],
    atencao: [
      `Sua clínica já possui uma base operacional ativa${totalPacientes > 0 ? ` com ${totalPacientes} paciente(s) cadastrado(s)` : ""} e potencial claro de crescimento. A análise identificou ações prioritárias que podem gerar impacto expressivo nos próximos indicadores.`,
      "A análise desta semana mostra que sua clínica está construindo uma base sólida. Existem oportunidades estratégicas importantes para fortalecer os indicadores e ampliar os resultados.",
    ],
    critico: [
      "Sua clínica está dando passos importantes na organização da sua gestão digital. Com o ClínicaFlow, existem oportunidades claras e objetivas para evoluir os indicadores rapidamente nas próximas semanas.",
      `Os dados mostram que sua clínica possui grande potencial de evolução.${totalPacientes > 0 ? ` Com ${totalPacientes} paciente(s) cadastrado(s), a base já existe.` : ""} Com ações consistentes, os resultados vão aparecer progressivamente.`,
    ],
  };

  const diagnostico = pick(diagnosticos[nivelKey]);

  // ── Pontos Fortes (baseado em dados reais) ───────────────────────────────────
  const pontosCandidatos: string[] = [];

  if (taxaSemana !== null && taxaSemana >= 70)
    pontosCandidatos.push(`A taxa de confirmação de ${taxaSemana}% demonstra uma operação bem organizada e pacientes comprometidos com seus agendamentos.`);
  if (notaGoogle !== null && notaGoogle >= 4.0)
    pontosCandidatos.push(`A nota ${notaGoogle.toFixed(1)} no Google é um diferencial competitivo que fortalece a credibilidade e atrai novos pacientes de forma orgânica.`);
  if (numAvaliacoes !== null && numAvaliacoes >= 10)
    pontosCandidatos.push(`O volume de ${numAvaliacoes} avaliações no Google demonstra uma base sólida de pacientes satisfeitos e dispostos a recomendar a clínica.`);
  if (hasZapi)
    pontosCandidatos.push("O WhatsApp automático está configurado, representando uma vantagem operacional importante para manter a comunicação e reduzir faltas.");
  if (nGaleria > 0)
    pontosCandidatos.push(`A galeria do site com ${nGaleria} foto(s) fortalece a presença digital e transmite profissionalismo para novos visitantes.`);
  if (nEquipe > 0)
    pontosCandidatos.push(`A apresentação de ${nEquipe} profissional(is) no site aumenta a confiança e personaliza a experiência antes mesmo da primeira consulta.`);
  if (totalPacientes >= 20)
    pontosCandidatos.push(`A base de ${totalPacientes} pacientes cadastrados é um ativo estratégico sólido para análises cada vez mais precisas e personalizadas.`);
  if (tendenciaConfirmacao !== null && tendenciaConfirmacao > 0)
    pontosCandidatos.push(`O crescimento de ${tendenciaConfirmacao}% na taxa de confirmação em relação à semana anterior indica evolução positiva na gestão dos agendamentos.`);

  if (pontosCandidatos.length === 0) {
    pontosCandidatos.push(
      totalPacientes > 0
        ? `Sua base de ${totalPacientes} paciente(s) cadastrado(s) é um ativo estratégico sólido. A adoção de gestão digital demonstra comprometimento com a evolução do negócio.`
        : "A decisão de estruturar a gestão digital da clínica é um passo estratégico importante. Você está construindo a base para um crescimento consistente e sustentável."
    );
  }

  const pontos_fortes = pick(pontosCandidatos);

  // ── Oportunidade (coerente com os dados reais) ───────────────────────────────
  const oportunidadesCandidatas: string[] = [];

  if (!hasZapi)
    oportunidadesCandidatas.push("A principal oportunidade é automatizar a comunicação via WhatsApp. Lembretes automáticos de confirmação reduzem faltas, otimizam a agenda e liberam a equipe para focar no atendimento.");
  if (nGaleria === 0 && bd.site < 20)
    oportunidadesCandidatas.push("A principal oportunidade é fortalecer a presença digital com fotos profissionais na galeria do site. Clínicas com galeria completa geram significativamente mais confiança em novos pacientes.");
  if (notaGoogle === null || (numAvaliacoes !== null && numAvaliacoes < 10))
    oportunidadesCandidatas.push("A principal oportunidade é ampliar a reputação no Google. Avaliações positivas são o principal fator de decisão de novos pacientes e têm impacto direto na captação orgânica.");
  if (nEquipe === 0)
    oportunidadesCandidatas.push("A principal oportunidade é apresentar a equipe no site da clínica. Pacientes que conhecem os profissionais antes da consulta chegam com mais confiança e têm maior fidelização.");
  if (taxaSemana !== null && taxaSemana < 70 && agsSemana > 0)
    oportunidadesCandidatas.push("A principal oportunidade é elevar a taxa de confirmação de agendamentos. Uma agenda bem confirmada reduz perdas financeiras e melhora o planejamento operacional.");

  const oportunidade = oportunidadesCandidatas.length > 0
    ? pick(oportunidadesCandidatas)
    : "A principal oportunidade é continuar enriquecendo o conteúdo do site com depoimentos e casos de antes e depois. Esses elementos constroem autoridade digital e aumentam a conversão de visitantes em novos pacientes.";

  // ── Missão ───────────────────────────────────────────────────────────────────
  const missao = missaoFallback(bd);

  // ── Motivacional (por nível) ──────────────────────────────────────────────────
  const motivacionais: Record<NivelKey, string[]> = {
    premium: [
      "Sua clínica atingiu o nível máximo do Índice ClínicaFlow. Esse resultado é o reflexo de uma gestão comprometida com a excelência e serve de referência para o setor.",
      "Excelência alcançada e mantida. Continue utilizando os dados semanais para inspirar sua equipe e consolidar sua posição de referência.",
    ],
    excelente: [
      "Sua clínica está no nível Excelente. Com refinamentos consistentes nas áreas estratégicas, a conquista do nível Clínica Premium está ao alcance nas próximas semanas.",
      "Pequenos ajustes nas dimensões estratégicas podem ser o diferencial que posicionará sua clínica entre as melhores da região. A evolução é contínua e acompanhada semanalmente.",
    ],
    evolucao: [
      "Sua clínica está em evolução constante. Com as ações indicadas, é totalmente possível alcançar o nível Excelente nas próximas semanas e consolidar sua posição de destaque.",
      "Pequenos ajustes realizados de forma consistente podem gerar resultados expressivos ao longo das próximas semanas. Sua evolução é acompanhada semanalmente pelo ClínicaFlow.",
    ],
    atencao: [
      "Sua clínica possui todas as condições para evoluir de forma consistente. Com foco nas ações prioritárias indicadas, os resultados aparecerão rapidamente nos próximos indicadores.",
      "Cada melhoria realizada será registrada e acompanhada semanalmente. Sua evolução é mensurável e o ClínicaFlow estará ao seu lado em cada etapa desse crescimento.",
    ],
    critico: [
      "Cada passo dado na direção certa conta. Com ações consistentes, os indicadores vão refletir o crescimento da sua clínica progressivamente nas próximas semanas.",
      "O potencial de evolução é expressivo. Com as ações objetivas indicadas, sua clínica pode avançar significativamente no Índice ClínicaFlow nas próximas semanas.",
    ],
  };

  const motivacional = pick(motivacionais[nivelKey]);

  return { diagnostico, pontos_fortes, oportunidade, missao, motivacional };
}
