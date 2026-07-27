"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";
import PageLoader from "../components/PageLoader";
import OnboardingCard from "../components/onboarding/OnboardingCard";
import WelcomeModal from "../components/onboarding/WelcomeModal";
import { gerarCentralOportunidades, type Recomendacao } from "../../lib/recomendacoes";
import { obterHorariosVagos } from "../../lib/horarios";
import { gerarOportunidadesClientes, gerarResumoRadar, type OportunidadeCliente } from "../../lib/oportunidades-clientes";

type AgItem = {
  id: string;
  hora: string;
  paciente_nome: string;
  telefone?: string;
  tipo_consulta?: string;
  status: string;
  data: string;
};

type ClienteSemProximoRow = {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  proxima_consulta: string | null;
};

type CancelamentoSemReagendamentoRow = {
  id: string;
  nome: string;
  telefone: string | null;
  data: string;
};

type DashData = {
  compromissosHoje: number;
  pendentes:        number;
  atrasados:        number;
  agendaHoje:       AgItem[];
  proximos:         AgItem[];
  atrasadosList:    AgItem[];
  totalPacientes:   number;
  clientesParaReativar: number;
  totalAgendamentos: number;
  cancelamentosHoje: number;
  horariosVagosHoje: number;
  avaliacoesPendentes: number;
  nomeNegocio:      string;
  temLogo:          boolean;
  temEmail:         boolean;
  temTelefone:      boolean;
  temEndereco:      boolean;
  temWhatsapp:      boolean;
  clientesSemProximoRows: ClienteSemProximoRow[];
  cancelamentosSemReagendamentoRows: CancelamentoSemReagendamentoRow[];
};

type IdeiaDodia = {
  texto:          string;
  icone:          string;
  porQueImporta:  string;
  impactoEsperado?: string;
  tempoEstimado?: string;
  destino?:       string;
  destino_label?: string;
};

function gerarIdeia(ctx: {
  totalPacientes: number;
  atrasados:      number;
  pendentes:      number;
  proximosSemana: number;
  temLogo:        boolean;
  temEmail:       boolean;
  temTelefone:    boolean;
  temEndereco:    boolean;
  hoje:           string;
}): IdeiaDodia {
  if (ctx.totalPacientes === 0) return {
    texto: "Sua base de clientes ainda está vazia. Cada cadastro é uma oportunidade de retorno recorrente — comece agora.",
    icone: "👥",
    porQueImporta: "Uma base de clientes organizada facilita o relacionamento, revela oportunidades de venda e mostra a evolução do seu negócio.",
    impactoEsperado: "Uma operação mais completa, com o crescimento do negócio mais fácil de acompanhar.",
    tempoEstimado: "≈ 10 minutos",
    destino: "/clientes", destino_label: "Cadastrar clientes",
  };
  if (!ctx.temLogo) return {
    texto: "Sua empresa ainda não tem um logotipo cadastrado. Uma identidade visual forte transmite mais confiança à primeira vista.",
    icone: "🖼️",
    porQueImporta: "Marcas com identidade visual definida ganham mais credibilidade e se destacam diante da concorrência.",
    impactoEsperado: "Uma imagem mais profissional e atrativa diante dos seus clientes.",
    tempoEstimado: "≈ 2 minutos",
    destino: "/configuracoes", destino_label: "Acessar configurações",
  };
  if (!ctx.temEmail || !ctx.temTelefone || !ctx.temEndereco) return {
    texto: "Seu perfil está incompleto. Dados de contato completos aumentam a credibilidade e facilitam que clientes te encontrem.",
    icone: "📋",
    porQueImporta: "Um cadastro completo organiza a operação e prepara sua empresa para crescer com mais consistência.",
    impactoEsperado: "Uma empresa mais preparada para crescer e oferecer uma experiência melhor aos clientes.",
    tempoEstimado: "≈ 5 minutos",
    destino: "/configuracoes", destino_label: "Completar perfil",
  };
  if (ctx.atrasados > 0) return {
    texto: `Você tem ${ctx.atrasados} compromisso${ctx.atrasados > 1 ? "s" : ""} em atraso. Resolver agora mantém sua operação organizada e transmite profissionalismo.`,
    icone: "⏰",
    porQueImporta: "Resolver pendências evita esquecimentos e mantém o atendimento sob controle.",
    impactoEsperado: "Menos imprevistos, melhor organização e mais tranquilidade no dia a dia.",
    tempoEstimado: "≈ 10 minutos",
    destino: "/agendamentos", destino_label: "Ver agenda",
  };
  if (ctx.proximosSemana === 0) return {
    texto: "Sua agenda para os próximos dias está livre — um bom momento para prospectar e preencher novos horários.",
    icone: "📅",
    porQueImporta: "Reabastecer a agenda cria mais oportunidades, mantém o fluxo de atendimento e fortalece a receita.",
    impactoEsperado: "Mais oportunidades de atendimento e um fluxo de trabalho mais constante.",
    tempoEstimado: "≈ 5 minutos",
    destino: "/agendamentos", destino_label: "Agendar compromisso",
  };
  if (ctx.pendentes > 0) return {
    texto: `Você tem ${ctx.pendentes} compromisso${ctx.pendentes > 1 ? "s" : ""} aguardando confirmação hoje. Confirme agora para evitar ausências.`,
    icone: "✅",
    porQueImporta: "Confirmar compromissos reduz faltas, melhora a rotina e mantém o atendimento mais previsível.",
    impactoEsperado: "Menos ausências e uma rotina mais tranquila para a equipe.",
    tempoEstimado: "≈ 5 minutos",
    destino: "/agendamentos", destino_label: "Confirmar agora",
  };
  const gerais: IdeiaDodia[] = [
    { texto: "Reative clientes que você não atende há mais de 30 dias — reconquistar custa menos do que conquistar um cliente novo.", icone: "📞", porQueImporta: "Reativar clientes antigos é uma forma simples de recuperar receita e fortalecer o relacionamento.", impactoEsperado: "Mais vendas recuperadas e um relacionamento mais forte com clientes antigos.", tempoEstimado: "≈ 5 minutos", destino: "/clientes", destino_label: "Ver clientes" },
    { texto: "Revise sua base de clientes e complete os dados faltantes — ela é um dos ativos mais valiosos do seu negócio.", icone: "🗂️", porQueImporta: "Uma base bem organizada ajuda a vender melhor e a tomar decisões com mais confiança.", impactoEsperado: "Mais organização para o time e decisões mais acertadas.", tempoEstimado: "≈ 10 minutos", destino: "/clientes", destino_label: "Ver clientes" },
    { texto: "Peça avaliações aos clientes mais recentes — a reputação online cresce uma avaliação de cada vez.", icone: "⭐", porQueImporta: "Boas avaliações aumentam a confiança do cliente e ajudam a atrair novos negócios.", impactoEsperado: "Sua reputação fica mais forte e atrai mais clientes.", tempoEstimado: "≈ 3 minutos", },
    { texto: "Revise os compromissos da próxima semana com antecedência — empresas organizadas surpreendem positivamente seus clientes.", icone: "📆", porQueImporta: "Planejar com antecedência reduz imprevistos e melhora a experiência do cliente.", impactoEsperado: "Você evita atrasos e entrega um atendimento mais previsível.", tempoEstimado: "≈ 5 minutos", destino: "/agendamentos", destino_label: "Ver agenda" },
    { texto: "Faça backup dos seus documentos e registros importantes — empresas bem documentadas crescem com mais segurança.", icone: "💾", porQueImporta: "Manter documentos em ordem protege o negócio e facilita a operação no dia a dia.", impactoEsperado: "Seu negócio fica mais seguro e a rotina fica mais tranquila.", tempoEstimado: "≈ 15 minutos", },
    { texto: "Revise os serviços que você mais oferece — clareza sobre o que você entrega facilita a venda e fortalece o relacionamento com clientes.", icone: "📌", porQueImporta: "Mostrar com clareza o que sua empresa entrega facilita a venda e fortalece a percepção de valor.", impactoEsperado: "Seus clientes entendem melhor o que você oferece e compram com mais facilidade.", tempoEstimado: "≈ 10 minutos", },
    { texto: "Envie uma mensagem para um cliente antigo hoje — um contato simples pode reativar o relacionamento e gerar nova receita.", icone: "💬", porQueImporta: "Um contato bem feito pode reabrir oportunidades e trazer nova receita sem grandes esforços.", impactoEsperado: "Você pode reacender oportunidades e gerar mais negócios.", tempoEstimado: "≈ 3 minutos", destino: "/clientes", destino_label: "Ver clientes" },
    { texto: "Mantenha o horário de funcionamento sempre atualizado — clientes que sabem quando te encontrar chegam mais preparados.", icone: "🕐", porQueImporta: "Informações claras ajudam a atrair clientes certos e evitam frustrações.", impactoEsperado: "Clientes chegam mais preparados e sua comunicação fica mais eficiente.", tempoEstimado: "≈ 3 minutos", destino: "/configuracoes", destino_label: "Configurações" },
    { texto: "Planeje os compromissos da próxima semana com antecedência — uma agenda organizada reduz imprevistos e transmite profissionalismo.", icone: "🗓️", porQueImporta: "Uma agenda planejada reduz imprevistos e ajuda a empresa a entregar mais com menos estresse.", impactoEsperado: "Você ganha mais controle do tempo e melhora sua produtividade.", tempoEstimado: "≈ 5 minutos", destino: "/agendamentos", destino_label: "Agendar" },
    { texto: "Clientes sem telefone cadastrado ficam fora do alcance dos lembretes automáticos — vale a pena completar esses dados.", icone: "📱", porQueImporta: "Dados completos melhoram o atendimento e aumentam as chances de gerar retorno recorrente.", impactoEsperado: "Você melhora o alcance dos contatos e fortalece a relação com os clientes.", tempoEstimado: "≈ 5 minutos", destino: "/clientes", destino_label: "Ver clientes" },
  ];
  const [y, m, d] = ctx.hoje.split("-").map(Number);
  return gerais[(y * 366 + m * 31 + d) % gerais.length];
}

// ── Insights do Dia ──────────────────────────────────────────────────────
// Motor de regras de negócio (V1). Nenhuma chamada a LLM: os textos abaixo
// são gerados por lógica determinística a partir dos dados já carregados
// no dashboard. A interface (renderização) não depende de como o texto foi
// gerado — trocar estas regras por uma chamada de IA generativa no futuro
// não exige nenhuma mudança no JSX que consome `InsightsDoDia`.
type InsightTile = {
  numero:         number;
  label:          string;
  tom:            "critico" | "positivo" | "neutro";
  destino?:       string;
  destino_label?: string;
};

type SituacaoDia = {
  emoji: string;
  texto: string;
  tom:   "critico" | "atencao" | "positivo";
};

type InsightsDoDia = {
  temDados:      boolean;
  prioridades:   InsightTile;
  agenda:        InsightTile;
  oportunidades: InsightTile;
  situacao:      SituacaoDia;
};

function gerarInsights(ctx: {
  totalPacientes:       number;
  pendentes:            number;
  atrasados:            number;
  compromissosHoje:     number;
  clientesParaReativar: number;
}): InsightsDoDia {
  if (ctx.totalPacientes === 0) {
    return {
      temDados: false,
      prioridades:   { numero: 0, label: "", tom: "neutro" },
      agenda:        { numero: 0, label: "", tom: "neutro" },
      oportunidades: { numero: 0, label: "", tom: "neutro" },
      situacao:      { emoji: "🟢", texto: "Tudo funcionando normalmente", tom: "positivo" },
    };
  }

  const aguardandoRetorno = ctx.pendentes + ctx.atrasados;
  const prioridades: InsightTile = aguardandoRetorno > 0
    ? {
        numero: aguardandoRetorno,
        label: `cliente${aguardandoRetorno > 1 ? "s" : ""} aguardando retorno.`,
        tom: "critico",
        destino: "/agendamentos", destino_label: "Ver Clientes",
      }
    : { numero: 0, label: "Nenhuma prioridade crítica.", tom: "positivo" };

  const agenda: InsightTile = ctx.compromissosHoje > 0
    ? {
        numero: ctx.compromissosHoje,
        label: `compromisso${ctx.compromissosHoje > 1 ? "s" : ""} agendado${ctx.compromissosHoje > 1 ? "s" : ""}.`,
        tom: "neutro",
        destino: "/agendamentos", destino_label: "Abrir Agenda",
      }
    : { numero: 0, label: "Sua agenda está livre hoje.", tom: "neutro", destino: "/agendamentos", destino_label: "Abrir Agenda" };

  const oportunidades: InsightTile = ctx.clientesParaReativar > 0
    ? {
        numero: ctx.clientesParaReativar,
        label: `cliente${ctx.clientesParaReativar > 1 ? "s" : ""} podem voltar a fazer negócio.`,
        tom: "positivo",
        destino: "/clientes", destino_label: "Ver Clientes",
      }
    : { numero: 0, label: "Nenhuma oportunidade no momento.", tom: "neutro" };

  const situacao: SituacaoDia = ctx.atrasados > 0
    ? { emoji: "🔴", texto: "Prioridade Alta", tom: "critico" }
    : ctx.pendentes > 0
      ? { emoji: "🟡", texto: "Atenção", tom: "atencao" }
      : { emoji: "🟢", texto: "Tudo funcionando normalmente", tom: "positivo" };

  return { temDados: true, prioridades, agenda, oportunidades, situacao };
}

function saudacao(): string {
  const h = parseInt(
    new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" })
  );
  if (h >= 6 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

// Saudação do card "Seu Plano para Hoje". Padrão institucional (V1): sempre
// genérico, sem citar o segmento do cliente — o OrganizaPro atende qualquer
// tipo de negócio, então a demonstração nunca deve sugerir um nicho (ex.:
// clínica, consultório, odontologia).
// Preparação para V2: quando `ambienteProducao` vier de um sinal real (ex.:
// conta paga vs. conta de demonstração) e houver nome de empresa cadastrado,
// a saudação passa a ser personalizada automaticamente — sem exigir nenhuma
// mudança no JSX que consome `SaudacaoCard`.
type SaudacaoCard = { linha1: string; linha2?: string; subtitulo: string };

function gerarSaudacaoCard(ctx: { nomeNegocio: string; ambienteProducao: boolean }): SaudacaoCard {
  const subtitulo = "Acompanhe suas prioridades e mantenha sua empresa organizada durante todo o dia.";
  if (ctx.ambienteProducao && ctx.nomeNegocio) {
    return { linha1: `Bem-vindo de volta, ${ctx.nomeNegocio}.`, subtitulo };
  }
  return { linha1: `👋 ${saudacao()}!`, linha2: "Bem-vindo ao OrganizaPro.", subtitulo };
}

function formatarDataBR(d: string): string {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function labelDia(d: string, hoje: string, amanha: string): string {
  if (d === hoje)   return "Hoje";
  if (d === amanha) return "Amanhã";
  const [y, m, dd] = d.split("-");
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(dd));
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `${dias[dt.getDay()]}, ${dd}/${m}`;
}

const stStatus: Record<string, { bg: string; color: string; label: string }> = {
  confirmado: { bg: "#00FF8722", color: "#00FF87", label: "Confirmado" },
  agendado:   { bg: "#00C6FF22", color: "#00C6FF", label: "Agendado"   },
  concluido:  { bg: "#1F4E5F22", color: "#4a9bb0", label: "Concluído"  },
  faltou:     { bg: "#FF444422", color: "#f87171", label: "Faltou"     },
  cancelado:  { bg: "#64748b22", color: "#94a3b8", label: "Cancelado"  },
  reagendar:  { bg: "#ea580c22", color: "#fb923c", label: "Reagendar"  },
};

const stTom: Record<"critico" | "positivo" | "neutro" | "atencao", { bg: string; border: string; color: string }> = {
  critico:  { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)",  color: "#f87171" },
  atencao:  { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",   color: "#fbbf24" },
  positivo: { bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)",   color: "#4ade80" },
  neutro:   { bg: "rgba(74,155,176,0.12)",  border: "rgba(74,155,176,0.3)",   color: "#4a9bb0" },
};

// Lapidação comercial — reforço visual de que o OrganizaPro já entrega uma
// plataforma completa (nenhuma dessas ferramentas é nova: todas já existem
// e estão navegáveis pelo menu lateral). Puramente decorativo.
const RECURSOS_INCLUIDOS = [
  { icon: "👥", label: "Clientes"           },
  { icon: "📅", label: "Agenda"             },
  { icon: "🌐", label: "Site"               },
  { icon: "✍️", label: "Conteúdo IA"        },
  { icon: "💬", label: "Chatbot"            },
  { icon: "🤖", label: "Automação"          },
  { icon: "⭐", label: "Reputação"          },
  { icon: "📈", label: "Métricas"           },
  { icon: "📊", label: "Raio-X Inteligente" },
];

// ── Pulso do Negócio ─────────────────────────────────────────────────────
// Reaproveita 100% a mesma condição já calculada em `gerarInsights`
// (insights.situacao) — nenhuma lógica nova, só uma frase executiva em vez
// do rótulo curto usado no antigo badge "Status Operacional".
const FRASE_PULSO: Record<"critico" | "atencao" | "positivo", string> = {
  critico:  "Há prioridades críticas que precisam ser resolvidas imediatamente.",
  atencao:  "Existem algumas pendências que merecem atenção hoje.",
  positivo: "Seu negócio está operando normalmente.",
};

// ── "O que fazer agora" ──────────────────────────────────────────────────
// Mescla, só para apresentação, os dois motores que já existem — nenhuma
// regra de priorização nova. Prioridade primeiro; dentro da mesma
// prioridade, clientes nomeados (mais acionáveis agora) antes de
// recomendações agregadas por contagem. Nunca completa com item inventado:
// se houver menos de 5 sinais reais, mostra só os que existem.
type AcaoPrioritaria = {
  id:           string;
  titulo:       string;
  prioridade:   "alta" | "media" | "baixa";
  destino?:     string;
  destinoLabel?: string;
};

function gerarProximasAcoes(
  recomendacoesAcionaveis: Recomendacao[],
  oportunidadesClientes: OportunidadeCliente[],
): AcaoPrioritaria[] {
  const doClientes: AcaoPrioritaria[] = oportunidadesClientes.map(op => ({
    id: `cliente-${op.chave}`,
    titulo: `${op.nome} — ${op.acaoSugerida}`,
    prioridade: op.prioridade,
    destino: "/clientes",
    destinoLabel: "Ver cliente",
  }));
  const dasRecomendacoes: AcaoPrioritaria[] = recomendacoesAcionaveis.map(r => ({
    id: `rec-${r.id}`,
    titulo: r.titulo,
    prioridade: r.prioridade,
    destino: r.destino,
    destinoLabel: r.destinoLabel,
  }));
  const peso: Record<"alta" | "media" | "baixa", number> = { alta: 0, media: 1, baixa: 2 };
  return [...doClientes, ...dasRecomendacoes]
    .sort((a, b) => peso[a.prioridade] - peso[b.prioridade])
    .slice(0, 5);
}

// ── Resumo da IA ─────────────────────────────────────────────────────────
// Texto curto, determinístico, sobre dados já calculados no Dashboard —
// nenhum valor financeiro (ver docs/dashboard-executivo-ia-v1-diagnostico-
// proposta.md, seção 2: honestidade absoluta sobre ticket médio/receita).
function gerarResumoIA(ctx: { ocupacaoPct: number | null; horariosVagosHoje: number; pendentes: number }): string {
  if (ctx.ocupacaoPct === null) {
    return "Ainda não há agenda suficiente hoje para gerar um resumo.";
  }
  const partes: string[] = [
    ctx.ocupacaoPct >= 70
      ? `Hoje sua agenda está com boa ocupação (${ctx.ocupacaoPct}%).`
      : `Hoje sua agenda está com ${ctx.ocupacaoPct}% de ocupação.`,
  ];
  if (ctx.horariosVagosHoje > 0) {
    partes.push(
      ctx.horariosVagosHoje === 1
        ? "Existe 1 horário livre."
        : `Existem ${ctx.horariosVagosHoje} horários livres.`
    );
  }
  if (ctx.pendentes > 0) {
    partes.push(
      ctx.pendentes === 1
        ? "1 cliente ainda não confirmou presença."
        : `${ctx.pendentes} clientes ainda não confirmaram presença.`
    );
  }
  return partes.join(" ");
}

// Central de Oportunidades e "O que fazer agora" (mesma paleta) — os
// emojis 🔴🟡🟢 usados para agrupar visualmente os cartões por urgência.
// Paleta unificada em todo o Dashboard (2026-07-27): "baixa" deixou de usar
// azul (🔵/neutro) para usar verde (🟢/positivo) — um único vocabulário de
// cor em toda a tela, em vez de dois esquemas parecidos.
const stTierOportunidade: Record<"alta" | "media" | "baixa", { emoji: string; label: string; tom: keyof typeof stTom }> = {
  alta:  { emoji: "🔴", label: "Alta prioridade",  tom: "critico"  },
  media: { emoji: "🟡", label: "Média prioridade", tom: "atencao"  },
  baixa: { emoji: "🟢", label: "Baixa prioridade", tom: "positivo" },
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clinicaId, setClinicaId] = useState("");
  const [dash, setDash] = useState<DashData>({
    compromissosHoje: 0, pendentes: 0, atrasados: 0,
    agendaHoje: [], proximos: [], atrasadosList: [],
    totalPacientes: 0, clientesParaReativar: 0, totalAgendamentos: 0,
    cancelamentosHoje: 0, horariosVagosHoje: 0, avaliacoesPendentes: 0, nomeNegocio: "",
    temLogo: false, temEmail: false, temTelefone: false, temEndereco: false, temWhatsapp: false,
    clientesSemProximoRows: [], cancelamentosSemReagendamentoRows: [],
  });

  const carregarDados = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: cu } = await supabase
        .from("clinica_usuarios").select("clinica_id")
        .eq("usuario_id", user.id).maybeSingle();
      const cid = cu?.clinica_id;
      if (!cid) { setLoading(false); return; }
      setClinicaId(cid);

      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const [ano, mes, dia] = hoje.split("-").map(Number);
      const amanha  = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().split("T")[0];
      const fimSete = new Date(Date.UTC(ano, mes - 1, dia + 6)).toISOString().split("T")[0];
      const trintaDiasAtras = new Date(Date.UTC(ano, mes - 1, dia - 30)).toISOString().split("T")[0];

      const [
        { data: agHoje },
        { data: prox },
        { data: atrasados },
        { count: pacCount },
        { count: reativarCount },
        { count: agTotalCount },
        { count: avaliacoesPendentesCount },
        { data: cfg },
        { data: semProximoData },
        { data: canceladosRecentes },
      ] = await Promise.all([
        supabase.from("agendamentos")
          .select("id, hora, paciente_nome, telefone, tipo_consulta, status, data")
          .eq("clinica_id", cid).eq("data", hoje)
          .order("hora"),
        supabase.from("agendamentos")
          .select("id, hora, paciente_nome, tipo_consulta, status, data")
          .eq("clinica_id", cid)
          .gte("data", amanha).lte("data", fimSete)
          .not("status", "in", '("cancelado","faltou")')
          .order("data").order("hora"),
        supabase.from("agendamentos")
          .select("id, hora, paciente_nome, tipo_consulta, status, data")
          .eq("clinica_id", cid)
          .lt("data", hoje).eq("status", "agendado")
          .order("data", { ascending: false }).order("hora")
          .limit(20),
        supabase.from("pacientes")
          .select("*", { count: "exact", head: true })
          .eq("clinica_id", cid),
        // Insights do Dia · Oportunidades: clientes sem próxima consulta agendada (candidatos a reativação)
        supabase.from("pacientes")
          .select("id", { count: "exact", head: true })
          .eq("clinica_id", cid)
          .or(`proxima_consulta.is.null,proxima_consulta.lt.${hoje}`),
        // Onboarding: já existe algum compromisso cadastrado (qualquer status/data)?
        supabase.from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("clinica_id", cid),
        // Central de Oportunidades: avaliações do Google já solicitadas e ainda sem resposta do cliente
        supabase.from("avaliacoes")
          .select("id", { count: "exact", head: true })
          .eq("clinica_id", cid)
          .eq("respondeu", false),
        supabase.from("clinica_config")
          .select("logo_url, email, telefone, endereco, nome_clinica, zapi_instance, zapi_token, horario_funcionamento")
          .eq("clinica_id", cid)
          .maybeSingle(),
        // Agenda Autônoma de Receita · sinal "sem próximo compromisso"
        supabase.from("pacientes")
          .select("id, nome, telefone, whatsapp, proxima_consulta")
          .eq("clinica_id", cid).eq("status", "ativo")
          .or(`proxima_consulta.is.null,proxima_consulta.lt.${hoje}`)
          .order("nome").limit(20),
        // Agenda Autônoma de Receita · candidatos ao sinal "cancelamento sem reagendamento"
        supabase.from("agendamentos")
          .select("id, paciente_nome, telefone, data")
          .eq("clinica_id", cid).eq("status", "cancelado")
          .gte("data", trintaDiasAtras)
          .order("data", { ascending: false }).limit(50),
      ]);

      // Agenda Autônoma de Receita · um cancelamento só é oportunidade se o
      // mesmo telefone não tiver nenhum compromisso futuro já remarcado.
      const canceladosComTelefone = (canceladosRecentes || []).filter(a => a.telefone) as
        { id: string; paciente_nome: string; telefone: string; data: string }[];
      const telefonesCancelados = Array.from(new Set(canceladosComTelefone.map(a => a.telefone)));
      let telefonesComReagendamento = new Set<string>();
      if (telefonesCancelados.length > 0) {
        const { data: futuros } = await supabase
          .from("agendamentos")
          .select("telefone")
          .eq("clinica_id", cid)
          .in("telefone", telefonesCancelados)
          .gte("data", hoje)
          .not("status", "in", '("cancelado","faltou")');
        telefonesComReagendamento = new Set((futuros || []).map(f => f.telefone));
      }
      // Um cliente pode ter cancelado mais de uma vez em 30 dias — mantém só o cancelamento mais recente.
      const cancelamentosSemReagendamentoRows: CancelamentoSemReagendamentoRow[] = [];
      const telefonesJaIncluidos = new Set<string>();
      for (const a of canceladosComTelefone) {
        if (telefonesComReagendamento.has(a.telefone) || telefonesJaIncluidos.has(a.telefone)) continue;
        telefonesJaIncluidos.add(a.telefone);
        cancelamentosSemReagendamentoRows.push({ id: a.id, nome: a.paciente_nome, telefone: a.telefone, data: a.data });
      }

      const lista         = (agHoje       || []) as AgItem[];
      const ativos        = lista.filter(a => !["cancelado", "faltou"].includes(a.status));
      const pendentesHoje = lista.filter(a => a.status === "agendado");
      const atrasadosList = (atrasados    || []) as AgItem[];
      const cancelamentosHoje = lista.filter(a => a.status === "cancelado").length;
      const horariosVagosHoje = obterHorariosVagos(lista, cfg?.horario_funcionamento).length;

      setDash({
        compromissosHoje: ativos.length,
        pendentes:        pendentesHoje.length,
        atrasados:        atrasadosList.length,
        agendaHoje:       lista,
        proximos:         (prox || []) as AgItem[],
        atrasadosList,
        totalPacientes:   pacCount ?? 0,
        clientesParaReativar: reativarCount ?? 0,
        totalAgendamentos: agTotalCount ?? 0,
        cancelamentosHoje,
        horariosVagosHoje,
        avaliacoesPendentes: avaliacoesPendentesCount ?? 0,
        nomeNegocio:      cfg?.nome_clinica || "",
        temLogo:          !!cfg?.logo_url,
        temEmail:         !!cfg?.email,
        temTelefone:      !!cfg?.telefone,
        temEndereco:      !!cfg?.endereco,
        temWhatsapp:      !!cfg?.zapi_instance && !!cfg?.zapi_token,
        clientesSemProximoRows: (semProximoData || []) as ClienteSemProximoRow[],
        cancelamentosSemReagendamentoRows,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // Date helpers
  const hojeStr    = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [ano, mes, dia] = hojeStr.split("-").map(Number);
  const amanhaStr  = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().split("T")[0];
  const hojeDate   = new Date();
  const diasSemana = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
  const mesesArr   = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr    = `${diasSemana[hojeDate.getDay()]}, ${hojeDate.getDate()} de ${mesesArr[hojeDate.getMonth()]}`;

  // Próximo compromisso de hoje ainda não concluído/cancelado
  const focoDoDia = dash.agendaHoje.find(
    a => !["concluido", "cancelado", "faltou"].includes(a.status)
  ) ?? null;

  // Agrupar agenda (hoje + próximos) por data para os 7 dias
  const gruposDias: Record<string, AgItem[]> = {};
  dash.agendaHoje
    .filter(a => !["cancelado", "faltou"].includes(a.status))
    .forEach(a => {
      if (!gruposDias[a.data]) gruposDias[a.data] = [];
      gruposDias[a.data].push(a);
    });
  dash.proximos.forEach(a => {
    if (!gruposDias[a.data]) gruposDias[a.data] = [];
    gruposDias[a.data].push(a);
  });
  const diasOrdenados = Object.keys(gruposDias).sort();

  // Lembretes = atrasados + pendentes de hoje
  const lembretes: AgItem[] = [
    ...dash.atrasadosList,
    ...dash.agendaHoje.filter(a => a.status === "agendado"),
  ];

  // Botões Rápidos (v2, 2026-07-27): WhatsApp e Relatórios ainda não têm uma
  // página própria com esse nome — direcionam para /chatbot e /metricas, as
  // páginas reais mais próximas hoje. Quando módulos dedicados existirem,
  // só o destino muda, sem alterar a interface.
  const botoesRapidos = [
    { icon: "➕", label: "Novo Cliente",     action: () => router.push("/clientes")     },
    { icon: "📅", label: "Novo Agendamento", action: () => router.push("/agendamentos") },
    { icon: "💬", label: "WhatsApp",         action: () => router.push("/chatbot")      },
    { icon: "📊", label: "Relatórios",       action: () => router.push("/metricas")     },
  ];

  const ideia = gerarIdeia({
    totalPacientes: dash.totalPacientes,
    atrasados:      dash.atrasados,
    pendentes:      dash.pendentes,
    proximosSemana: dash.proximos.length,
    temLogo:        dash.temLogo,
    temEmail:       dash.temEmail,
    temTelefone:    dash.temTelefone,
    temEndereco:    dash.temEndereco,
    hoje:           hojeStr,
  });

  const insights = gerarInsights({
    totalPacientes:       dash.totalPacientes,
    pendentes:            dash.pendentes,
    atrasados:            dash.atrasados,
    compromissosHoje:     dash.compromissosHoje,
    clientesParaReativar: dash.clientesParaReativar,
  });

  // Intelligence 2.0 — o Diretor Digital não só percebe, decide: escolhe UMA
  // prioridade principal para o dia (docs/organizapro-intelligence-engine-
  // v1.html). Regras determinísticas, sem IA generativa; usa só dados já
  // carregados acima. O mesmo contexto alimenta a Central de Oportunidades
  // (Intelligence 2.2) logo abaixo — uma única fonte de verdade.
  const ctxNegocio = {
    totalPacientes:       dash.totalPacientes,
    totalAgendamentos:    dash.totalAgendamentos,
    compromissosHoje:     dash.compromissosHoje,
    pendentesHoje:        dash.pendentes,
    atrasados:            dash.atrasados,
    proximosSemana:       dash.proximos.length,
    clientesParaReativar: dash.clientesParaReativar,
    cancelamentosHoje:    dash.cancelamentosHoje,
    horariosVagosHoje:    dash.horariosVagosHoje,
    avaliacoesPendentes:  dash.avaliacoesPendentes,
    temEmail:             dash.temEmail,
    temTelefone:          dash.temTelefone,
    temEndereco:          dash.temEndereco,
    temWhatsapp:          dash.temWhatsapp,
  };

  const centralOportunidades = insights.temDados
    ? gerarCentralOportunidades(ctxNegocio)
    : { alta: [], media: [], baixa: [] };

  // Agenda Autônoma de Receita — diferente da Central de Oportunidades (que
  // conta), aqui cada card é UM cliente nomeado, com o motivo real que o
  // trouxe até aqui. Mesmos dados já carregados acima; zero consulta nova.
  const oportunidadesClientes: OportunidadeCliente[] = insights.temDados
    ? gerarOportunidadesClientes({
        hoje: hojeStr,
        clientesSemProximoCompromisso: dash.clientesSemProximoRows.map(c => ({
          id: c.id, nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, proximaConsulta: c.proxima_consulta,
        })),
        cancelamentosSemReagendamento: dash.cancelamentosSemReagendamentoRows.map(a => ({
          id: a.id, nome: a.nome, telefone: a.telefone, data: a.data,
        })),
        confirmacoesPendentes: dash.agendaHoje
          .filter(a => a.status === "agendado")
          .map(a => ({ id: a.id, nome: a.paciente_nome, telefone: a.telefone || null, data: a.data })),
      })
    : [];

  // Radar de Oportunidades — frase de abertura na voz do Diretor Digital.
  const resumoRadar = gerarResumoRadar(oportunidadesClientes.length);

  // V2: ambienteProducao virá de um sinal real de conta/ambiente. Mantido
  // desligado em V1 para nunca personalizar em contas de demonstração.
  const saudacaoCard = gerarSaudacaoCard({
    nomeNegocio:      dash.nomeNegocio,
    ambienteProducao: false,
  });

  // ── Dashboard Executivo IA v1 (2026-07-27) ───────────────────────────────
  // Ocupação da agenda — só um cálculo sobre dados já carregados, nenhuma
  // consulta nova. null quando não há base para calcular (evita 0/0).
  const totalSlotsHoje = dash.compromissosHoje + dash.horariosVagosHoje;
  const ocupacaoPct = insights.temDados && totalSlotsHoje > 0
    ? Math.round((dash.compromissosHoje / totalSlotsHoje) * 100)
    : null;

  // "O que fazer agora" — mescla de Central de Oportunidades + Radar,
  // nenhuma regra de negócio nova (ver gerarProximasAcoes acima).
  const todasRecomendacoesAcionaveis = [
    ...centralOportunidades.alta, ...centralOportunidades.media, ...centralOportunidades.baixa,
  ];
  const proximasAcoes = insights.temDados
    ? gerarProximasAcoes(todasRecomendacoesAcionaveis, oportunidadesClientes)
    : [];

  const resumoIA = gerarResumoIA({
    ocupacaoPct,
    horariosVagosHoje: dash.horariosVagosHoje,
    pendentes: dash.pendentes,
  });

  // Oportunidades encontradas — contagem por categoria, sem valor em R$
  // (ver docs/dashboard-executivo-ia-v1-diagnostico-proposta.md, seção 2).
  const oportunidadesResumo = [
    dash.clientesParaReativar > 0 ? `${dash.clientesParaReativar} cliente${dash.clientesParaReativar > 1 ? "s" : ""} sem retorno` : null,
    dash.horariosVagosHoje    > 0 ? `${dash.horariosVagosHoje} horário${dash.horariosVagosHoje > 1 ? "s" : ""} livre${dash.horariosVagosHoje > 1 ? "s" : ""}` : null,
    dash.avaliacoesPendentes > 0 ? `${dash.avaliacoesPendentes} avaliaç${dash.avaliacoesPendentes > 1 ? "ões" : "ão"} pendente${dash.avaliacoesPendentes > 1 ? "s" : ""}` : null,
  ].filter((s): s is string => s !== null);

  // Objetivos do Dia — checklist real, derivado de dados já calculados.
  const objetivosDoDia = [
    { label: "Confirmar todos os atendimentos", feito: dash.pendentes === 0 && dash.atrasados === 0 },
    { label: "Preencher horários livres",       feito: dash.horariosVagosHoje === 0 },
    { label: "Solicitar avaliações",            feito: dash.avaliacoesPendentes === 0 },
    { label: "Encerrar o dia sem pendências",   feito: lembretes.length === 0 },
  ];

  // Conta nova vs. madura — mesma condição já usada pelo OnboardingCard
  // (temEmpresa/temWhatsapp/temCliente/temCompromisso), decide só a
  // POSIÇÃO de Onboarding/Recursos/Consultoria (topo vs. rodapé), sem
  // nenhuma consulta nova.
  const contaMadura = dash.temEmail && dash.temTelefone && dash.temEndereco
    && dash.temWhatsapp && dash.totalPacientes > 0 && dash.totalAgendamentos > 0;

  if (loading) return (
    <AdminShell title="Painel Executivo">
      <PageLoader title="Preparando seu painel..." />
    </AdminShell>
  );

  // Onboarding + Recursos Incluídos + Consultoria do Dia — mesmo grupo,
  // uma única posição por vez: topo para conta nova, rodapé para conta
  // madura (Homologação do Diretor, 2026-07-27).
  const blocoOnboardingRecursosConsultoria = (
    <>
      <OnboardingCard
        clinicaId={clinicaId}
        temEmpresa={dash.temEmail && dash.temTelefone && dash.temEndereco}
        temWhatsapp={dash.temWhatsapp}
        temCliente={dash.totalPacientes > 0}
        temCompromisso={dash.totalAgendamentos > 0}
        onNavigate={(path) => router.push(path)}
      />

      <div className="dc" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        {RECURSOS_INCLUIDOS.map(r => (
          <span key={r.label} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 999,
            background: "rgba(74,155,176,0.07)", border: "1px solid rgba(74,155,176,0.18)",
            color: "#cbd5e1", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
          }}>
            <span style={{ color: "#4ade80" }}>✔</span> {r.icon} {r.label}
          </span>
        ))}
      </div>

      <div className="dc" style={{
        background: "linear-gradient(135deg, rgba(74,155,176,0.07), rgba(31,78,95,0.12))",
        border: "1px solid rgba(74,155,176,0.2)",
        borderRadius: 14, padding: "20px 22px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(74,155,176,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>
            {ideia.icone}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              💡 Consultoria do Dia
            </div>
            <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.75, margin: "0 0 12px" }}>
              {ideia.texto}
            </p>
            <div style={{
              marginBottom: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(74,155,176,0.14)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                🧭 Por que isso importa
              </div>
              <div style={{
                fontSize: 13,
                color: "#cbd5e1",
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {ideia.porQueImporta}
              </div>
            </div>
            {ideia.impactoEsperado && (
              <div style={{
                marginBottom: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(74,155,176,0.06)",
                border: "1px solid rgba(74,155,176,0.12)",
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                  📈 Impacto esperado
                </div>
                <div style={{
                  fontSize: 13,
                  color: "#cbd5e1",
                  lineHeight: 1.45,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {ideia.impactoEsperado}
                </div>
              </div>
            )}
            {ideia.tempoEstimado && (
              <div style={{
                marginBottom: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 999,
                background: "rgba(74,155,176,0.1)",
                border: "1px solid rgba(74,155,176,0.18)",
                color: "#4a9bb0",
                fontSize: 12,
                fontWeight: 700,
              }}>
                <span>⏱</span>
                <span>Tempo estimado</span>
                <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{ideia.tempoEstimado}</span>
              </div>
            )}
            {ideia.destino && (
              <button
                onClick={() => router.push(ideia.destino!)}
                style={{
                  padding: "7px 16px", borderRadius: 8,
                  border: "1px solid rgba(74,155,176,0.3)",
                  background: "rgba(74,155,176,0.1)",
                  color: "#4a9bb0", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                {ideia.destino_label} →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <AdminShell title="Painel Executivo">
      {clinicaId && <WelcomeModal clinicaId={clinicaId} />}
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .dc  { animation: fadeUp 0.35s ease both; }
        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 700px) { .dash-grid { grid-template-columns: 1fr; } }
        .indicadores-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 860px) { .indicadores-grid { grid-template-columns: repeat(2, 1fr); } }
        .btn-rapido:hover { background: rgba(31,78,95,0.25) !important; border-color: rgba(31,78,95,0.55) !important; }
        .indicador-tile:hover { border-color: rgba(74,155,176,0.4) !important; }
      `}</style>

      {/* ── 1. CABEÇALHO INTELIGENTE ───────────────────────────────────────────
          Funde as duas saudações que existiam antes ("Seu Plano para Hoje" +
          "Card Principal") numa só, e acrescenta o Pulso do Negócio — mesma
          condição já calculada em insights.situacao (gerarInsights), só em
          frase completa (FRASE_PULSO acima), sem lógica nova. */}
      <div className="dc" style={{
        background: "linear-gradient(135deg, rgba(74,155,176,0.12), rgba(31,78,95,0.22))",
        border: "1px solid rgba(74,155,176,0.3)",
        borderRadius: 16, padding: "22px 24px", marginBottom: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          {dataStr}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>
          {saudacaoCard.linha1}
          {saudacaoCard.linha2 && <><br />{saudacaoCard.linha2}</>}
        </div>

        {insights.temDados ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontSize: 15 }}>{insights.situacao.emoji}</span>
            <span style={{ fontSize: 14, color: "#cbd5e1", fontWeight: 600 }}>
              {FRASE_PULSO[insights.situacao.tom]}
            </span>
            {ocupacaoPct !== null && (
              <span style={{
                marginLeft: "auto", padding: "4px 12px", borderRadius: 999,
                background: "rgba(74,155,176,0.12)", border: "1px solid rgba(74,155,176,0.3)",
                color: "#4a9bb0", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
              }}>
                Agenda: {ocupacaoPct}%
              </span>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: "8px 0 0" }}>
            {saudacaoCard.subtitulo}
          </p>
        )}
      </div>

      {/* ── 2. BOTÕES RÁPIDOS ─────────────────────────────────────────────── */}
      <div className="dc" style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {botoesRapidos.map(b => (
          <button key={b.label} className="btn-rapido" onClick={b.action} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 10,
            border: "1px solid rgba(31,78,95,0.35)",
            background: "rgba(31,78,95,0.12)",
            color: "#4a9bb0", fontSize: 13, fontWeight: 600,
            cursor: "pointer", whiteSpace: "nowrap",
          }}>
            <span>{b.icon}</span>
            {b.label}
          </button>
        ))}
      </div>

      {/* ── ONBOARDING / RECURSOS / CONSULTORIA — topo (só contas novas) ──── */}
      {!contaMadura && blocoOnboardingRecursosConsultoria}

      {/* ── 3. O QUE FAZER AGORA ───────────────────────────────────────────
          Mescla visual de Central de Oportunidades + Radar de Oportunidades
          (gerarProximasAcoes acima) — nenhuma regra de negócio nova. Nunca
          completa com item inventado: menos de 5 sinais reais = menos de 5
          itens na tela. */}
      {insights.temDados && (
        <div className="dc" style={{
          background: "#12151f", border: "1px solid rgba(245,158,11,0.22)",
          borderRadius: 16, padding: "22px 24px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(245,158,11,0.16)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
            }}>
              🧭
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
              O que fazer agora
            </div>
          </div>

          {proximasAcoes.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Nenhuma ação urgente identificada agora. Continue acompanhando sua agenda.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {proximasAcoes.map(acao => {
                const meta = stTierOportunidade[acao.prioridade];
                const cor = stTom[meta.tom];
                return (
                  <div key={acao.id} style={{
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${cor.border}`,
                    borderRadius: 12, padding: "12px 16px",
                  }}>
                    <span style={{ fontSize: 15 }}>{meta.emoji}</span>
                    <span style={{ fontSize: 13.5, color: "#f1f5f9", fontWeight: 600, flex: 1, minWidth: 160 }}>
                      {acao.titulo}
                    </span>
                    {acao.destino && (
                      <button
                        onClick={() => router.push(acao.destino!)}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: cor.color, color: "#0a0d14", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {acao.destinoLabel || "Ver"} →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 4. INDICADORES EXECUTIVOS ───────────────────────────────────────
          Cada indicador leva a uma ação (regra de UX do Diretor, 2026-07-27)
          — nunca some quando o valor é zero, só mostra "0". */}
      <div className="dc indicadores-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "Clientes hoje",         valor: dash.compromissosHoje,          destino: "/agendamentos" },
          { label: "Horários vagos",        valor: dash.horariosVagosHoje,         destino: "/agendamentos" },
          { label: "Pendências",            valor: dash.pendentes + dash.atrasados, destino: "/agendamentos" },
          { label: "Avaliações aguardando", valor: dash.avaliacoesPendentes,       destino: "/reputacao"    },
        ].map(ind => (
          <button
            key={ind.label}
            className="indicador-tile"
            onClick={() => router.push(ind.destino)}
            style={{
              textAlign: "left", cursor: "pointer",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "16px", transition: "border-color 0.15s",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 900, color: "#f1f5f9", lineHeight: 1, marginBottom: 6 }}>
              {ind.valor}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{ind.label}</div>
          </button>
        ))}
      </div>

      {/* ── 5. RESUMO DA IA ─────────────────────────────────────────────── */}
      <div className="dc" style={{
        background: "rgba(74,155,176,0.06)", border: "1px solid rgba(74,155,176,0.18)",
        borderRadius: 14, padding: "18px 20px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          💬 Resumo da IA
        </div>
        <p style={{ fontSize: 13.5, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
          {resumoIA}
        </p>
      </div>

      {/* ── 6. AGENDA / PRÓXIMOS COMPROMISSOS ──────────────────────────────── */}
      <div className="dash-grid dc" style={{ marginBottom: 20 }}>

        {/* FOCO DO DIA */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "20px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
            🎯 Foco do Dia
          </div>
          {focoDoDia ? (
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#4a9bb0", lineHeight: 1, marginBottom: 10 }}>
                {focoDoDia.hora}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
                {focoDoDia.paciente_nome}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                {focoDoDia.tipo_consulta || "Compromisso"}
              </div>
              <span style={{
                display: "inline-flex",
                fontSize: 11, padding: "3px 10px", borderRadius: 10,
                background: stStatus[focoDoDia.status]?.bg || "#1a1a2e",
                color:      stStatus[focoDoDia.status]?.color || "#64748b",
                fontWeight: 600,
              }}>
                {stStatus[focoDoDia.status]?.label || focoDoDia.status}
              </span>
            </div>
          ) : (
            <div style={{ color: "#475569", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📅</div>
              Sua agenda está livre hoje.{" "}
              <span
                style={{ color: "#4a9bb0", cursor: "pointer", fontWeight: 600 }}
                onClick={() => router.push("/agendamentos")}
              >
                Agendar um compromisso →
              </span>
            </div>
          )}
        </div>

        {/* PRÓXIMOS 7 DIAS */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "20px",
          maxHeight: 340, overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: 2, textTransform: "uppercase" }}>
              📆 Próximos 7 Dias
            </div>
            <button
              onClick={() => router.push("/agendamentos")}
              style={{ fontSize: 11, color: "#4a9bb0", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Ver agenda →
            </button>
          </div>

          {diasOrdenados.length === 0 ? (
            <div style={{ color: "#475569", fontSize: 13, textAlign: "center", paddingTop: 16 }}>
              Nenhum compromisso agendado para os próximos 7 dias.<br />
              Bom momento para planejar a semana.
            </div>
          ) : diasOrdenados.map((d, di) => (
            <div key={d}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: d === hojeStr ? "#4a9bb0" : "#64748b",
                textTransform: "uppercase", letterSpacing: "0.06em",
                marginTop: di > 0 ? 14 : 0, marginBottom: 6,
                paddingBottom: 4,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                {labelDia(d, hojeStr, amanhaStr)}
              </div>
              {gruposDias[d].map((a, ai) => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  paddingTop: ai === 0 ? 2 : 6,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4a9bb0", minWidth: 44 }}>{a.hora}</span>
                  <span style={{ fontSize: 13, color: "#cbd5e1", flex: 1 }}>{a.paciente_nome}</span>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 8,
                    background: stStatus[a.status]?.bg || "#1a1a2e",
                    color:      stStatus[a.status]?.color || "#64748b",
                    fontWeight: 600, whiteSpace: "nowrap",
                  }}>
                    {stStatus[a.status]?.label || a.status}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>

      {lembretes.length > 0 && (
        <div className="dc" style={{
          background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)",
          borderRadius: 14, padding: "20px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
            ⚠️ Lembretes
          </div>
          {lembretes.map((a, i) => (
            <div key={`${a.id}-${i}`} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
              borderBottom: i < lembretes.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700, whiteSpace: "nowrap",
                background: a.data < hojeStr ? "rgba(248,113,113,0.15)" : "rgba(245,158,11,0.15)",
                color:      a.data < hojeStr ? "#f87171" : "#fbbf24",
              }}>
                {a.data < hojeStr ? "ATRASADO" : "PENDENTE"}
              </span>
              <span style={{ fontSize: 12, color: "#64748b", minWidth: 60 }}>
                {a.data < hojeStr ? formatarDataBR(a.data) : a.hora}
              </span>
              <span style={{ fontSize: 13, color: "#f1f5f9", flex: 1, fontWeight: 500 }}>{a.paciente_nome}</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>{a.tipo_consulta || ""}</span>
            </div>
          ))}
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => router.push("/agendamentos")}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: "1px solid rgba(245,158,11,0.3)",
                background: "rgba(245,158,11,0.08)",
                color: "#f59e0b", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Gerenciar na agenda →
            </button>
          </div>
        </div>
      )}

      {/* ── 7. OPORTUNIDADES ENCONTRADAS ─────────────────────────────────────
          Contagem por categoria, nunca valor em R$ (Honestidade Absoluta —
          ver docs/dashboard-executivo-ia-v1-diagnostico-proposta.md, §2). */}
      {insights.temDados && (
        <div className="dc" style={{
          background: "#12151f", border: "1px solid rgba(124,58,237,0.22)",
          borderRadius: 16, padding: "20px 24px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(124,58,237,0.16)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
            }}>
              💡
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
              Oportunidades encontradas
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: "10px 0 0", lineHeight: 1.6 }}>
            {oportunidadesResumo.length > 0
              ? oportunidadesResumo.join(" · ")
              : "Oportunidades serão exibidas conforme o uso do sistema."}
          </p>
        </div>
      )}

      {/* ── 8. OBJETIVOS DO DIA ──────────────────────────────────────────── */}
      {insights.temDados && (
        <div className="dc" style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "20px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
            ✅ Objetivos do Dia
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {objetivosDoDia.map(o => (
              <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, color: o.feito ? "#4ade80" : "#475569" }}>{o.feito ? "✔" : "○"}</span>
                <span style={{ fontSize: 13.5, color: o.feito ? "#94a3b8" : "#f1f5f9", textDecoration: o.feito ? "line-through" : "none" }}>
                  {o.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 9. RADAR DE OPORTUNIDADES (detalhe completo, por cliente) ────────
          V1 se chamava "Agenda Autônoma de Receita" — mesma base, mesmos
          dados já carregados acima, nenhum envio automático. Diferente da
          Central de Oportunidades (mostra o panorama em contadores), aqui
          cada card é UM cliente nomeado: quem merece atenção primeiro, por
          quê, e há quanto tempo. Ordem: cancelamento > confirmação pendente
          > sem retorno — dentro do mesmo tipo, quem espera há mais tempo
          aparece primeiro. */}
      {insights.temDados && (
        <div className="dc" style={{
          background: "#12151f", border: "1px solid rgba(124,58,237,0.22)",
          borderRadius: 16, padding: "22px 24px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(124,58,237,0.16)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
            }}>
              🎯
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
                Radar de Oportunidades
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {oportunidadesClientes.length > 0
                  ? resumoRadar
                  : "Nenhuma oportunidade urgente encontrada hoje. Continue acompanhando seus clientes e compromissos."}
              </div>
            </div>
          </div>

          {oportunidadesClientes.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12, marginTop: 16 }}>
              {oportunidadesClientes.map(op => {
                const meta = stTierOportunidade[op.prioridade];
                const cor = stTom[meta.tom];
                const numeroWpp = op.telefone ? (op.telefone.length > 11 ? op.telefone : `55${op.telefone}`) : null;
                return (
                  <div key={op.chave} style={{
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${cor.border}`,
                    borderRadius: 12, padding: "16px 18px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                        {op.nome}
                      </div>
                      <span style={{
                        padding: "3px 9px", borderRadius: 999, flexShrink: 0,
                        background: cor.bg, border: `1px solid ${cor.border}`,
                        color: cor.color, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
                      }}>
                        {meta.emoji} {meta.label}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 6px", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5 }}>
                      {op.motivoPrincipal}
                    </p>

                    {(op.tempoDecorrido || op.sinaisAdicionais > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {op.tempoDecorrido && (
                          <span style={{
                            padding: "2px 8px", borderRadius: 999,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "#94a3b8", fontSize: 10.5, fontWeight: 600,
                          }}>
                            ⏱ {op.tempoDecorrido}
                          </span>
                        )}
                        {op.sinaisAdicionais > 0 && (
                          <span style={{
                            padding: "2px 8px", borderRadius: 999,
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "#94a3b8", fontSize: 10.5, fontWeight: 600,
                          }}>
                            +{op.sinaisAdicionais} outro{op.sinaisAdicionais > 1 ? "s" : ""} sinal{op.sinaisAdicionais > 1 ? "is" : ""}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600, marginBottom: 12 }}>
                      ✓ {op.acaoSugerida}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => router.push("/clientes")}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(74,155,176,0.35)", background: "rgba(74,155,176,0.1)", color: "#4a9bb0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        Abrir cliente
                      </button>
                      {numeroWpp ? (
                        <a
                          href={`https://wa.me/${numeroWpp}?text=${encodeURIComponent(`Olá, ${op.nome}! Tudo bem?`)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: cor.color, color: "#0a0d14", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}
                        >
                          💬 Entrar em contato
                        </a>
                      ) : (
                        <span style={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>
                          Sem telefone cadastrado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 10. CENTRAL DE OPORTUNIDADES (detalhe completo, por urgência) ────
          Intelligence 2.2. Diferente do Radar (um cartão por cliente), aqui
          mostramos TODAS as ações disponíveis agrupadas por urgência — o
          quadro completo. Mesmo motor, mesmos dados já carregados acima. */}
      {insights.temDados && (centralOportunidades.alta.length + centralOportunidades.media.length + centralOportunidades.baixa.length > 0) && (
        <div className="dc" style={{
          background: "#12151f", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: "22px 24px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(74,222,128,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
            }}>
              💰
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
                Central de Oportunidades
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                Ações que podem melhorar seu negócio hoje
              </div>
            </div>
          </div>

          {(["alta", "media", "baixa"] as const).map(tier => {
            const itens = centralOportunidades[tier];
            if (itens.length === 0) return null;
            const meta = stTierOportunidade[tier];
            const cor = stTom[meta.tom];
            return (
              <div key={tier} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 13 }}>{meta.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: cor.color }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                  {itens.map(op => (
                    <div key={op.id} style={{
                      background: "rgba(255,255,255,0.03)", border: `1px solid ${cor.border}`,
                      borderRadius: 12, padding: "16px 18px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                          {op.titulo}
                        </div>
                        <span style={{
                          flexShrink: 0, minWidth: 22, height: 22, padding: "0 6px",
                          borderRadius: 999, background: cor.bg, border: `1px solid ${cor.border}`,
                          color: cor.color, fontSize: 11, fontWeight: 800,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {op.quantidade}
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 8px" }}>
                        {op.explicacao}
                      </p>
                      <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, margin: "0 0 10px", fontStyle: "italic" }}>
                        Por quê: {op.motivo}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        <span style={{
                          padding: "3px 9px", borderRadius: 999,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          color: "#cbd5e1", fontSize: 10.5, fontWeight: 600,
                        }}>
                          💡 {op.impacto}
                        </span>
                        <span style={{
                          padding: "3px 9px", borderRadius: 999,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          color: "#cbd5e1", fontSize: 10.5, fontWeight: 600,
                        }}>
                          ⏱ {op.tempoEstimado}
                        </span>
                      </div>
                      {op.destino ? (
                        <button
                          onClick={() => router.push(op.destino!)}
                          style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: cor.color, color: "#0a0d14", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                        >
                          Resolver agora →
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: cor.color }}>
                          ✓ {op.acao}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ONBOARDING / RECURSOS / CONSULTORIA — rodapé (contas maduras) ─── */}
      {contaMadura && blocoOnboardingRecursosConsultoria}

    </AdminShell>
  );
}
