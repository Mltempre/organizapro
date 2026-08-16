"use client";
// ── DashboardView ──────────────────────────────────────────────────────────
// Etapa 4 do roadmap de Modo Demonstração (docs/modo-demonstracao-v1-
// arquitetura.md, seção 9). Camada visual única, reutilizável por
// app/dashboard/page.tsx (dados reais) e app/dashboard-demo/page.tsx (dados
// sintéticos, lib/dados-demonstracao.ts). Nunca sabe qual rota a chamou nem
// de onde os dados vieram — só recebe tudo já calculado via props e um
// callback de navegação. Nenhuma consulta ao Supabase, nenhuma decisão de
// fonte de dado.
//
// Este arquivo também é o dono de algumas funções de derivação puramente
// apresentacionais (gerarIdeia, gerarInsights, gerarSaudacaoCard,
// gerarResumoIA e helpers de data) — motores pequenos que ambas as rotas
// precisam chamar da mesma forma, para nunca duplicar regra. Os motores
// "grandes" (Radar, Central de Oportunidades, Próxima Melhor Ação, Diretor
// Digital, Missão do Dia) continuam em lib/ e app/dashboard/page.tsx,
// intocados — este componente só os apresenta.
import AdminShell from "./AdminShell";
import WelcomeModal from "./onboarding/WelcomeModal";
import OnboardingCard from "./onboarding/OnboardingCard";
import MissaoDoDiaCard from "./MissaoDoDiaCard";
import ProximaMelhorAcao, { type AcaoPrioritaria } from "./ProximaMelhorAcao";
import IndicadoresExecutivos from "./IndicadoresExecutivos";
import DiretorDigitalCard from "./DiretorDigitalCard";
import RadarDeOportunidades from "./RadarDeOportunidades";
import CentralDeOportunidadesCard from "./CentralDeOportunidades";
import type { OportunidadeCliente } from "../../lib/oportunidades-clientes";
import type { CentralOportunidades, Recomendacao } from "../../lib/recomendacoes";
import { adaptarOportunidadesClientes, adaptarRecomendacoes, organizarSinaisCanonicos, type SinalCanonico } from "../../lib/nucleo-inteligente";
import type { RecomendacaoConsultiva } from "../../lib/ia-comercial";

// ── Tipos compartilhados (contrato entre fonte de dado e apresentação) ────

export type AgItem = {
  id: string;
  hora: string;
  paciente_nome: string;
  telefone?: string;
  tipo_consulta?: string;
  status: string;
  data: string;
};

export type IdeiaDodia = {
  texto:            string;
  icone:            string;
  porQueImporta:    string;
  impactoEsperado?: string;
  tempoEstimado?:   string;
  destino?:         string;
  destino_label?:   string;
};

export type SaudacaoCard = { linha1: string; linha2?: string; subtitulo: string };

// ── Consultoria do Dia — mesma regra determinística para as duas rotas ────
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

// ── Insights do Dia — mesma regra determinística para as duas rotas ──────
type SituacaoDia = { emoji: string; texto: string; tom: "critico" | "atencao" | "positivo" };
export type InsightsDoDia = { temDados: boolean; situacao: SituacaoDia };

function gerarInsights(ctx: { totalPacientes: number; pendentes: number; atrasados: number }): InsightsDoDia {
  if (ctx.totalPacientes === 0) {
    return { temDados: false, situacao: { emoji: "🟢", texto: "Tudo funcionando normalmente", tom: "positivo" } };
  }
  const situacao: SituacaoDia = ctx.atrasados > 0
    ? { emoji: "🔴", texto: "Prioridade Alta", tom: "critico" }
    : ctx.pendentes > 0
      ? { emoji: "🟡", texto: "Atenção", tom: "atencao" }
      : { emoji: "🟢", texto: "Tudo funcionando normalmente", tom: "positivo" };
  return { temDados: true, situacao };
}

// ── Saudação — padrão institucional (V1): sempre genérica, nunca cita
// segmento do cliente (o OrganizaPro atende qualquer tipo de negócio) ─────
function saudacao(): string {
  const h = parseInt(
    new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" })
  );
  if (h >= 6 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function gerarSaudacaoCard(ctx: { nomeNegocio: string; ambienteProducao: boolean }): SaudacaoCard {
  const subtitulo = "Acompanhe suas prioridades e mantenha sua empresa organizada durante todo o dia.";
  if (ctx.ambienteProducao && ctx.nomeNegocio) {
    return { linha1: `Bem-vindo de volta, ${ctx.nomeNegocio}.`, subtitulo };
  }
  return { linha1: `👋 ${saudacao()}!`, linha2: "Bem-vindo ao OrganizaPro.", subtitulo };
}

// ── Resumo da IA — texto curto, determinístico, nenhum valor financeiro ──
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
    partes.push(ctx.horariosVagosHoje === 1 ? "Existe 1 horário livre." : `Existem ${ctx.horariosVagosHoje} horários livres.`);
  }
  if (ctx.pendentes > 0) {
    partes.push(ctx.pendentes === 1 ? "1 cliente ainda não confirmou presença." : `${ctx.pendentes} clientes ainda não confirmaram presença.`);
  }
  return partes.join(" ");
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

// Reaproveita 100% a mesma condição já calculada em `gerarInsights`
// (insights.situacao) — nenhuma lógica nova, só uma frase executiva.
const FRASE_PULSO: Record<"critico" | "atencao" | "positivo", string> = {
  critico:  "Há prioridades críticas que precisam ser resolvidas imediatamente.",
  atencao:  "Existem algumas pendências que merecem atenção hoje.",
  positivo: "Seu negócio está operando normalmente.",
};

// ── "Próxima Melhor Ação" — mesmo motor de glue para as duas rotas ────────
// Mescla, só para apresentação, os dois motores que já existem (Radar +
// Central de Oportunidades) — nenhuma regra de priorização nova. Prioridade
// + desempate determinístico vivem em lib/nucleo-inteligente.ts
// (organizarSinaisCanonicos), a mesma função usada pela Missão do Dia.
function tempoEstimadoPorAcao(temWhatsapp: boolean, destinoLabel?: string): string {
  if (temWhatsapp || destinoLabel === "Confirmar") return "2 minutos";
  if (destinoLabel === "Ver cliente" || destinoLabel === "Ver clientes") return "3 minutos";
  return "5 minutos";
}

function sinalParaAcaoPrioritaria(sinal: SinalCanonico): AcaoPrioritaria {
  const telefone = sinal.contexto?.telefone ?? null;
  const numeroWpp = telefone ? (telefone.length > 11 ? telefone : `55${telefone}`) : null;
  const whatsapp = numeroWpp && sinal.contexto
    ? `https://wa.me/${numeroWpp}?text=${encodeURIComponent(`Olá, ${sinal.contexto.nome}! Tudo bem?`)}`
    : undefined;
  return {
    id: sinal.id,
    titulo: sinal.titulo,
    prioridade: sinal.prioridade,
    destino: sinal.destino,
    destinoLabel: sinal.destinoLabel,
    contexto: sinal.contexto?.nome,
    motivo: sinal.motivo,
    whatsapp,
    tempoEstimado: tempoEstimadoPorAcao(!!whatsapp, sinal.destinoLabel),
  };
}

function gerarProximasAcoes(
  recomendacoesAcionaveis: Recomendacao[],
  oportunidadesClientes: OportunidadeCliente[],
): AcaoPrioritaria[] {
  const sinais = organizarSinaisCanonicos([
    ...adaptarOportunidadesClientes(oportunidadesClientes),
    ...adaptarRecomendacoes(recomendacoesAcionaveis),
  ]);
  return sinais.slice(0, 5).map(sinalParaAcaoPrioritaria);
}

export { gerarIdeia, gerarInsights, gerarSaudacaoCard, gerarResumoIA, gerarProximasAcoes };

// ── Props ──────────────────────────────────────────────────────────────
export type DashboardViewProps = {
  clinicaId: string;
  dataStr: string;
  saudacaoCard: SaudacaoCard;
  temDados: boolean;
  situacaoEmoji: string;
  situacaoTom: "critico" | "atencao" | "positivo";
  ocupacaoPct: number | null;
  botoesRapidos: { icon: string; label: string; destino: string }[];
  contaMadura: boolean;
  onboarding: { temEmpresa: boolean; temWhatsapp: boolean; temCliente: boolean; temCompromisso: boolean };
  ideia: IdeiaDodia;
  missaoDoDia: SinalCanonico[];
  proximasAcoes: AcaoPrioritaria[];
  indicadores: { compromissosHoje: number; horariosVagosHoje: number; pendentes: number; atrasados: number; avaliacoesPendentes: number };
  resumoIA: string;
  narrativaDiretor: string;
  recomendacoesConsultivas: RecomendacaoConsultiva[];
  focoDoDia: AgItem | null;
  hojeStr: string;
  amanhaStr: string;
  diasOrdenados: string[];
  gruposDias: Record<string, AgItem[]>;
  lembretes: AgItem[];
  oportunidadesResumo: string[];
  objetivosDoDia: { label: string; feito: boolean }[];
  oportunidadesClientes: OportunidadeCliente[];
  resumoRadar: string;
  centralOportunidades: CentralOportunidades;
  onNavigate: (destino: string) => void;
  /** Padrão true (comportamento atual do Dashboard real). /dashboard-demo passa false: o
   * onboarding de "primeiro acesso" não é coerente numa página de vendas mostrando um
   * negócio já maduro, e criaria atrito antes do cliente ver o valor do produto. */
  exibirWelcomeModal?: boolean;
  /** Repassado ao banner "100% concluído" do OnboardingCard. Sem valor, mantém o texto
   * padrão (Dashboard real). /dashboard-demo passa uma narrativa de empresa já em
   * operação, para não terminar a página com um texto de primeiro acesso. */
  textoBemVindo?: { titulo: string; texto1: string; texto2: string };
};

export default function DashboardView(props: DashboardViewProps) {
  const {
    clinicaId, dataStr, saudacaoCard, temDados, situacaoEmoji, situacaoTom, ocupacaoPct,
    botoesRapidos, onboarding, ideia, missaoDoDia, proximasAcoes, indicadores,
    resumoIA, narrativaDiretor, recomendacoesConsultivas, focoDoDia, hojeStr, amanhaStr,
    diasOrdenados, gruposDias, lembretes, oportunidadesResumo, objetivosDoDia,
    oportunidadesClientes, resumoRadar, centralOportunidades, onNavigate,
    exibirWelcomeModal = true, textoBemVindo,
  } = props;

  // Onboarding + Recursos Incluídos + Consultoria do Dia — mesmo grupo, uma
  // única posição por vez: topo quando ainda não há inteligência para
  // mostrar (temDados = false), rodapé quando já há (Homologação do
  // Diretor, 2026-07-30 — "o onboarding nunca deve liderar quando já existe
  // inteligência"). Antes disso, a posição seguia `contaMadura` (cadastro
  // 100% completo), o que fazia uma conta com dados reais mas cadastro
  // incompleto ver o checklist antes de qualquer inteligência.
  const blocoOnboardingRecursosConsultoria = (
    <>
      <OnboardingCard
        clinicaId={clinicaId}
        temEmpresa={onboarding.temEmpresa}
        temWhatsapp={onboarding.temWhatsapp}
        temCliente={onboarding.temCliente}
        temCompromisso={onboarding.temCompromisso}
        onNavigate={onNavigate}
        textoConcluido={textoBemVindo}
        iniciarRecolhido={temDados}
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
              marginBottom: 10, padding: "10px 12px", borderRadius: 10,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(74,155,176,0.14)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                🧭 Por que isso importa
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {ideia.porQueImporta}
              </div>
            </div>
            {ideia.impactoEsperado && (
              <div style={{
                marginBottom: 10, padding: "10px 12px", borderRadius: 10,
                background: "rgba(74,155,176,0.06)", border: "1px solid rgba(74,155,176,0.12)",
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                  📈 Impacto esperado
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {ideia.impactoEsperado}
                </div>
              </div>
            )}
            {ideia.tempoEstimado && (
              <div style={{
                marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: 999,
                background: "rgba(74,155,176,0.1)", border: "1px solid rgba(74,155,176,0.18)",
                color: "#4a9bb0", fontSize: 12, fontWeight: 700,
              }}>
                <span>⏱</span>
                <span>Tempo estimado</span>
                <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{ideia.tempoEstimado}</span>
              </div>
            )}
            {ideia.destino && (
              <button
                onClick={() => onNavigate(ideia.destino!)}
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
      {exibirWelcomeModal && clinicaId && <WelcomeModal clinicaId={clinicaId} />}
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

      {/* ── 1. CABEÇALHO INTELIGENTE ─────────────────────────────────────── */}
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

        {temDados ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontSize: 15 }}>{situacaoEmoji}</span>
            <span style={{ fontSize: 14, color: "#cbd5e1", fontWeight: 600 }}>
              {FRASE_PULSO[situacaoTom]}
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
          <button key={b.label} className="btn-rapido" onClick={() => onNavigate(b.destino)} style={{
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

      {/* ── ONBOARDING / RECURSOS / CONSULTORIA — topo (só quando ainda não
          há inteligência para mostrar) ───────────────────────────────────── */}
      {!temDados && blocoOnboardingRecursosConsultoria}

      {/* ── 2a. CABEÇALHO DO BLOCO DE INTELIGÊNCIA — nomeia o conjunto abaixo
          como uma coisa só (Missão → PMA → Diretor Digital → Radar → Central),
          nunca 5 widgets soltos. Puramente apresentacional, nenhuma regra nova. */}
      {temDados && (
        <div className="dc" style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 14px" }}>
          <span style={{ fontSize: 20 }}>🧭</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.2 }}>
              Seu Diretor Digital hoje
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              A mesma inteligência olhando seu negócio de ângulos diferentes — prioridades, oportunidades e recomendações.
            </div>
          </div>
        </div>
      )}

      {/* ── 2b. MISSÃO DO DIA ────────────────────────────────────────────── */}
      {temDados && (
        <MissaoDoDiaCard sinais={missaoDoDia} onNavigate={onNavigate} />
      )}

      {/* ── 3. PRÓXIMA MELHOR AÇÃO ───────────────────────────────────────── */}
      {temDados && (
        <ProximaMelhorAcao acoes={proximasAcoes} onNavigate={onNavigate} />
      )}

      {/* ── 4. IA COMERCIAL · DIRETOR DIGITAL ─────────────────────────────── */}
      {temDados && (
        <DiretorDigitalCard
          narrativa={narrativaDiretor}
          recomendacoes={recomendacoesConsultivas}
          onNavigate={onNavigate}
        />
      )}

      {/* ── 5. RADAR DE OPORTUNIDADES ─────────────────────────────────────── */}
      {temDados && (
        <RadarDeOportunidades
          oportunidades={oportunidadesClientes}
          resumo={resumoRadar}
          onNavigate={onNavigate}
        />
      )}

      {/* ── 6. CENTRAL DE OPORTUNIDADES — sempre renderiza quando há dados;
          estado vazio explicativo (nunca inventa oportunidade) fica a cargo
          do próprio componente quando os 3 tiers estão vazios. */}
      {temDados && (
        <CentralDeOportunidadesCard
          central={centralOportunidades}
          onNavigate={onNavigate}
        />
      )}

      {/* ── 7. INDICADORES EXECUTIVOS ────────────────────────────────────── */}
      <IndicadoresExecutivos
        compromissosHoje={indicadores.compromissosHoje}
        horariosVagosHoje={indicadores.horariosVagosHoje}
        pendentes={indicadores.pendentes}
        atrasados={indicadores.atrasados}
        avaliacoesPendentes={indicadores.avaliacoesPendentes}
        onNavigate={onNavigate}
      />

      {/* ── 8. RESUMO DA IA ───────────────────────────────────────────────── */}
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

      {/* ── 9. AGENDA / PRÓXIMOS COMPROMISSOS ────────────────────────────── */}
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
                onClick={() => onNavigate("/agendamentos")}
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
              onClick={() => onNavigate("/agendamentos")}
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
              onClick={() => onNavigate("/agendamentos")}
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

      {/* ── 10. OPORTUNIDADES ENCONTRADAS ────────────────────────────────── */}
      {temDados && (
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

      {/* ── 11. OBJETIVOS DO DIA ─────────────────────────────────────────── */}
      {temDados && (
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

      {/* ── ONBOARDING / RECURSOS / CONSULTORIA — rodapé (já há inteligência) ─── */}
      {temDados && blocoOnboardingRecursosConsultoria}

    </AdminShell>
  );
}
