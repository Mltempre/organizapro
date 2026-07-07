"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";
import PageLoader from "../components/PageLoader";
import OnboardingCard from "../components/onboarding/OnboardingCard";
import { gerarRecomendacoes, type CategoriaRecomendacao } from "../../lib/recomendacoes";

type AgItem = {
  id: string;
  hora: string;
  paciente_nome: string;
  tipo_consulta?: string;
  status: string;
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
  nomeNegocio:      string;
  temLogo:          boolean;
  temEmail:         boolean;
  temTelefone:      boolean;
  temEndereco:      boolean;
  temWhatsapp:      boolean;
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
    destino: "/pacientes", destino_label: "Cadastrar clientes",
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
    { texto: "Reative clientes que você não atende há mais de 30 dias — reconquistar custa menos do que conquistar um cliente novo.", icone: "📞", porQueImporta: "Reativar clientes antigos é uma forma simples de recuperar receita e fortalecer o relacionamento.", impactoEsperado: "Mais vendas recuperadas e um relacionamento mais forte com clientes antigos.", tempoEstimado: "≈ 5 minutos", destino: "/pacientes", destino_label: "Ver clientes" },
    { texto: "Revise sua base de clientes e complete os dados faltantes — ela é um dos ativos mais valiosos do seu negócio.", icone: "🗂️", porQueImporta: "Uma base bem organizada ajuda a vender melhor e a tomar decisões com mais confiança.", impactoEsperado: "Mais organização para o time e decisões mais acertadas.", tempoEstimado: "≈ 10 minutos", destino: "/pacientes", destino_label: "Ver clientes" },
    { texto: "Peça avaliações aos clientes mais recentes — a reputação online cresce uma avaliação de cada vez.", icone: "⭐", porQueImporta: "Boas avaliações aumentam a confiança do cliente e ajudam a atrair novos negócios.", impactoEsperado: "Sua reputação fica mais forte e atrai mais clientes.", tempoEstimado: "≈ 3 minutos", },
    { texto: "Revise os compromissos da próxima semana com antecedência — empresas organizadas surpreendem positivamente seus clientes.", icone: "📆", porQueImporta: "Planejar com antecedência reduz imprevistos e melhora a experiência do cliente.", impactoEsperado: "Você evita atrasos e entrega um atendimento mais previsível.", tempoEstimado: "≈ 5 minutos", destino: "/agendamentos", destino_label: "Ver agenda" },
    { texto: "Faça backup dos seus documentos e registros importantes — empresas bem documentadas crescem com mais segurança.", icone: "💾", porQueImporta: "Manter documentos em ordem protege o negócio e facilita a operação no dia a dia.", impactoEsperado: "Seu negócio fica mais seguro e a rotina fica mais tranquila.", tempoEstimado: "≈ 15 minutos", },
    { texto: "Revise os serviços que você mais oferece — clareza sobre o que você entrega facilita a venda e fortalece o relacionamento com clientes.", icone: "📌", porQueImporta: "Mostrar com clareza o que sua empresa entrega facilita a venda e fortalece a percepção de valor.", impactoEsperado: "Seus clientes entendem melhor o que você oferece e compram com mais facilidade.", tempoEstimado: "≈ 10 minutos", },
    { texto: "Envie uma mensagem para um cliente antigo hoje — um contato simples pode reativar o relacionamento e gerar nova receita.", icone: "💬", porQueImporta: "Um contato bem feito pode reabrir oportunidades e trazer nova receita sem grandes esforços.", impactoEsperado: "Você pode reacender oportunidades e gerar mais negócios.", tempoEstimado: "≈ 3 minutos", destino: "/pacientes", destino_label: "Ver clientes" },
    { texto: "Mantenha o horário de funcionamento sempre atualizado — clientes que sabem quando te encontrar chegam mais preparados.", icone: "🕐", porQueImporta: "Informações claras ajudam a atrair clientes certos e evitam frustrações.", impactoEsperado: "Clientes chegam mais preparados e sua comunicação fica mais eficiente.", tempoEstimado: "≈ 3 minutos", destino: "/configuracoes", destino_label: "Configurações" },
    { texto: "Planeje os compromissos da próxima semana com antecedência — uma agenda organizada reduz imprevistos e transmite profissionalismo.", icone: "🗓️", porQueImporta: "Uma agenda planejada reduz imprevistos e ajuda a empresa a entregar mais com menos estresse.", impactoEsperado: "Você ganha mais controle do tempo e melhora sua produtividade.", tempoEstimado: "≈ 5 minutos", destino: "/agendamentos", destino_label: "Agendar" },
    { texto: "Clientes sem telefone cadastrado ficam fora do alcance dos lembretes automáticos — vale a pena completar esses dados.", icone: "📱", porQueImporta: "Dados completos melhoram o atendimento e aumentam as chances de gerar retorno recorrente.", impactoEsperado: "Você melhora o alcance dos contatos e fortalece a relação com os clientes.", tempoEstimado: "≈ 5 minutos", destino: "/pacientes", destino_label: "Ver clientes" },
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
      situacao:      { emoji: "🟢", texto: "Tudo em ordem", tom: "positivo" },
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
        destino: "/pacientes", destino_label: "Ver Clientes",
      }
    : { numero: 0, label: "Nenhuma oportunidade no momento.", tom: "neutro" };

  const situacao: SituacaoDia = ctx.atrasados > 0
    ? { emoji: "🔴", texto: "Prioridade Alta", tom: "critico" }
    : ctx.pendentes > 0
      ? { emoji: "🟡", texto: "Atenção", tom: "atencao" }
      : { emoji: "🟢", texto: "Tudo em ordem", tom: "positivo" };

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
  const subtitulo = "Confira seu plano para hoje e mantenha seu negócio organizado.";
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

// Categoria da recomendação (lib/recomendacoes.ts) → estilo visual + emoji.
// Reaproveita as mesmas cores de `stTom` já usadas nos tiles acima.
const stCategoria: Record<CategoriaRecomendacao, { emoji: string; label: string; tom: keyof typeof stTom }> = {
  atencao:      { emoji: "🔴", label: "Atenção",      tom: "critico"  },
  oportunidade: { emoji: "🟡", label: "Oportunidade", tom: "atencao"  },
  organizacao:  { emoji: "🟢", label: "Organização",  tom: "positivo" },
  sugestao:     { emoji: "💡", label: "Sugestão",     tom: "neutro"   },
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clinicaId, setClinicaId] = useState("");
  const [dash, setDash] = useState<DashData>({
    compromissosHoje: 0, pendentes: 0, atrasados: 0,
    agendaHoje: [], proximos: [], atrasadosList: [],
    totalPacientes: 0, clientesParaReativar: 0, totalAgendamentos: 0, nomeNegocio: "",
    temLogo: false, temEmail: false, temTelefone: false, temEndereco: false, temWhatsapp: false,
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

      const [
        { data: agHoje },
        { data: prox },
        { data: atrasados },
        { count: pacCount },
        { count: reativarCount },
        { count: agTotalCount },
        { data: cfg },
      ] = await Promise.all([
        supabase.from("agendamentos")
          .select("id, hora, paciente_nome, tipo_consulta, status, data")
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
        supabase.from("clinica_config")
          .select("logo_url, email, telefone, endereco, nome_clinica, zapi_instance, zapi_token")
          .eq("clinica_id", cid)
          .maybeSingle(),
      ]);

      const lista         = (agHoje       || []) as AgItem[];
      const ativos        = lista.filter(a => !["cancelado", "faltou"].includes(a.status));
      const pendentesHoje = lista.filter(a => a.status === "agendado");
      const atrasadosList = (atrasados    || []) as AgItem[];

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
        nomeNegocio:      cfg?.nome_clinica || "",
        temLogo:          !!cfg?.logo_url,
        temEmail:         !!cfg?.email,
        temTelefone:      !!cfg?.telefone,
        temEndereco:      !!cfg?.endereco,
        temWhatsapp:      !!cfg?.zapi_instance && !!cfg?.zapi_token,
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

  const botoesRapidos = [
    { icon: "➕", label: "Novo Cliente",      action: () => router.push("/pacientes")    },
    { icon: "📅", label: "Novo Compromisso",  action: () => router.push("/agendamentos") },
    { icon: "🔍", label: "Pesquisar Cliente", action: () => router.push("/pacientes")    },
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

  // Intelligence 1.5 — primeiro módulo oficial do Diretor Digital
  // (docs/organizapro-intelligence-engine-v1.html). Regras de negócio
  // determinísticas, sem IA generativa; usa só dados já carregados acima.
  const recomendacoes = insights.temDados
    ? gerarRecomendacoes({
        totalPacientes:       dash.totalPacientes,
        totalAgendamentos:    dash.totalAgendamentos,
        compromissosHoje:     dash.compromissosHoje,
        pendentesHoje:        dash.pendentes,
        atrasados:            dash.atrasados,
        proximosSemana:       dash.proximos.length,
        clientesParaReativar: dash.clientesParaReativar,
        temEmail:             dash.temEmail,
        temTelefone:          dash.temTelefone,
        temEndereco:          dash.temEndereco,
        temWhatsapp:          dash.temWhatsapp,
      })
    : [];

  // V2: ambienteProducao virá de um sinal real de conta/ambiente. Mantido
  // desligado em V1 para nunca personalizar em contas de demonstração.
  const saudacaoCard = gerarSaudacaoCard({
    nomeNegocio:      dash.nomeNegocio,
    ambienteProducao: false,
  });

  if (loading) return (
    <AdminShell title="Central de Gestão" subtitle={dataStr}>
      <PageLoader title="Preparando seu painel..." />
    </AdminShell>
  );

  return (
    <AdminShell title="Central de Gestão" subtitle={dataStr}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .dc  { animation: fadeUp 0.35s ease both; }
        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 700px) { .dash-grid { grid-template-columns: 1fr; } }
        .insights-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 860px) { .insights-grid { grid-template-columns: 1fr; } }
        .btn-rapido:hover { background: rgba(31,78,95,0.25) !important; border-color: rgba(31,78,95,0.55) !important; }
      `}</style>

      {/* ── ONBOARDING ────────────────────────────────────────────────────────── */}
      <OnboardingCard
        clinicaId={clinicaId}
        temEmpresa={dash.temEmail && dash.temTelefone && dash.temEndereco}
        temWhatsapp={dash.temWhatsapp}
        temCliente={dash.totalPacientes > 0}
        temCompromisso={dash.totalAgendamentos > 0}
        onNavigate={(path) => router.push(path)}
      />

      {/* ── SEU PLANO PARA HOJE ──────────────────────────────────────────────── */}
      <div className="dc" style={{
        background: "linear-gradient(135deg, rgba(74,155,176,0.12), rgba(31,78,95,0.22))",
        border: "1px solid rgba(74,155,176,0.3)",
        borderRadius: 16, padding: "22px 24px", marginBottom: 20,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(74,155,176,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, flexShrink: 0,
            }}>
              🎯
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
              Seu Plano para Hoje
            </div>
          </div>
          {insights.temDados && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 999,
              background: stTom[insights.situacao.tom].bg,
              border: `1px solid ${stTom[insights.situacao.tom].border}`,
              color: stTom[insights.situacao.tom].color,
              fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            }}>
              {insights.situacao.emoji} {insights.situacao.texto}
            </span>
          )}
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1", margin: "6px 0 4px" }}>
          {saudacaoCard.linha1}
          {saudacaoCard.linha2 && <><br />{saudacaoCard.linha2}</>}
        </div>
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 20px" }}>
          {saudacaoCard.subtitulo}
        </p>

        {!insights.temDados ? (
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            Ainda não há informações suficientes para gerar recomendações. Continue utilizando o OrganizaPro e os Insights ficarão cada vez mais úteis.
          </div>
        ) : (
          <>
            <div className="insights-grid">
              {/* Prioridades */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  Prioridades
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, margin: "0 0 6px", color: stTom[insights.prioridades.tom].color }}>
                  {insights.prioridades.numero}
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4, margin: "0 0 12px" }}>
                  {insights.prioridades.label}
                </p>
                {insights.prioridades.destino && (
                  <button
                    onClick={() => router.push(insights.prioridades.destino!)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.1)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {insights.prioridades.destino_label} →
                  </button>
                )}
              </div>

              {/* Agenda */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  Agenda
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, margin: "0 0 6px", color: stTom[insights.agenda.tom].color }}>
                  {insights.agenda.numero}
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4, margin: "0 0 12px" }}>
                  {insights.agenda.label}
                </p>
                {insights.agenda.destino && (
                  <button
                    onClick={() => router.push(insights.agenda.destino!)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(74,155,176,0.3)", background: "rgba(74,155,176,0.1)", color: "#4a9bb0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {insights.agenda.destino_label} →
                  </button>
                )}
              </div>

              {/* Oportunidades */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  Oportunidades
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, margin: "0 0 6px", color: stTom[insights.oportunidades.tom].color }}>
                  {insights.oportunidades.numero}
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4, margin: "0 0 12px" }}>
                  {insights.oportunidades.label}
                </p>
                {insights.oportunidades.destino && (
                  <button
                    onClick={() => router.push(insights.oportunidades.destino!)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.1)", color: "#4ade80", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {insights.oportunidades.destino_label} →
                  </button>
                )}
              </div>
            </div>

            {/* Recomendação do Dia */}
            {recomendacoes.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                  🧭 O Diretor Digital recomenda
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recomendacoes.map(r => {
                    const cat = stCategoria[r.categoria];
                    const cor = stTom[cat.tom];
                    return (
                      <div key={r.id} style={{
                        background: "rgba(255,255,255,0.03)", border: `1px solid ${cor.border}`,
                        borderRadius: 12, padding: "14px 16px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 13 }}>{cat.emoji}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: cor.color }}>
                            {cat.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
                          {r.titulo}
                        </div>
                        <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 6px" }}>
                          {r.explicacao}
                        </p>
                        <p style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.4, margin: "0 0 12px", fontStyle: "italic" }}>
                          Por quê: {r.motivo}
                        </p>
                        {r.destino ? (
                          <button
                            onClick={() => router.push(r.destino!)}
                            style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${cor.border}`, background: cor.bg, color: cor.color, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            {r.acao} →
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, color: cor.color }}>
                            ✓ {r.acao}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CARD PRINCIPAL ──────────────────────────────────────────────────── */}
      <div className="dc" style={{
        background: "linear-gradient(135deg,rgba(31,78,95,0.18),rgba(13,53,71,0.25))",
        border: "1px solid rgba(31,78,95,0.35)",
        borderRadius: 16, padding: "24px 28px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 3 }}>
          {saudacao()}! 👋
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>{dataStr}</div>

        <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, marginBottom: 14 }}>
          Panorama do seu dia
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16 }}>🟢</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#4ade80", minWidth: 36, lineHeight: 1 }}>
              {dash.compromissosHoje}
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>
              compromisso{dash.compromissosHoje !== 1 ? "s" : ""} hoje
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16 }}>🟡</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#fbbf24", minWidth: 36, lineHeight: 1 }}>
              {dash.pendentes}
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>
              aguardando confirmação
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16 }}>🔴</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: dash.atrasados > 0 ? "#f87171" : "#475569", minWidth: 36, lineHeight: 1 }}>
              {dash.atrasados}
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>
              em atraso
            </span>
          </div>
        </div>
      </div>

      {/* ── PRÓXIMA IDEIA ────────────────────────────────────────────────────── */}
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

      {/* ── BOTÕES RÁPIDOS ──────────────────────────────────────────────────── */}
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

      {/* ── FOCO DO DIA + PRÓXIMOS 7 DIAS ──────────────────────────────────── */}
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

      {/* ── LEMBRETES ────────────────────────────────────────────────────────── */}
      {lembretes.length > 0 && (
        <div className="dc" style={{
          background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)",
          borderRadius: 14, padding: "20px",
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

    </AdminShell>
  );
}
