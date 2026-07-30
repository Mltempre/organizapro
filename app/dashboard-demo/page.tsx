"use client";
// ── /dashboard-demo — Etapa 4b do roadmap de Modo Demonstração ────────────
// Ver docs/modo-demonstracao-v1-arquitetura.md, seções 4 e 9. Mesma
// DashboardView do Dashboard real (app/dashboard/page.tsx), alimentada por
// gerarCenarioDemonstracao() em vez de Supabase — "mockar a entrada, não a
// saída": os motores reais (Radar, Central de Oportunidades, Próxima Melhor
// Ação, Diretor Digital, Missão do Dia) processam o cenário fictício
// exatamente como processariam dado real. Esta página nunca consulta o
// Supabase, nunca persiste o cenário, nunca escreve texto final na mão.
//
// Etapa 6 (KENSA Comercial Final): agendaHoje/proximosDias (também vindos do
// gerador) alimentam Foco do Dia, Próximos 7 Dias e Lembretes — mesmos
// componentes, mesma regra de agrupamento por data já usada em
// app/dashboard/page.tsx, só que a partir do cenário sintético em vez de
// dash.agendaHoje/dash.proximos.
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { gerarCenarioDemonstracao } from "../../lib/dados-demonstracao";
import { gerarCentralOportunidades } from "../../lib/recomendacoes";
import { gerarOportunidadesClientes, gerarResumoRadar } from "../../lib/oportunidades-clientes";
import { gerarRecomendacoesConsultivas, gerarNarrativaDiretor, gerarMensagemDadosInsuficientes } from "../../lib/ia-comercial";
import { adaptarOportunidadesClientes, adaptarRecomendacoes, gerarMissaoDoDia, type SinalCanonico } from "../../lib/nucleo-inteligente";
import DashboardView, {
  gerarIdeia, gerarInsights, gerarSaudacaoCard, gerarResumoIA, gerarProximasAcoes,
  type AgItem,
} from "../components/DashboardView";
import AdminShell from "../components/AdminShell";
import PageLoader from "../components/PageLoader";

const diasSemana = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const mesesArr   = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

export default function DashboardDemo() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cenario, setCenario] = useState<ReturnType<typeof gerarCenarioDemonstracao> | null>(null);

  useEffect(() => {
    // Gerado em memória, no navegador — sempre relativo ao momento real da
    // visita (nunca uma data fixa gravada no código), nunca uma consulta ao
    // Supabase, nunca persistido.
    setCenario(gerarCenarioDemonstracao());
    setLoading(false);
  }, []);

  if (loading || !cenario) return (
    <AdminShell title="Painel Executivo">
      <PageLoader title="Preparando seu painel..." />
    </AdminShell>
  );

  const { hoje: hojeStr, entradaOportunidades, contextoNegocio: ctxNegocio, agendaHoje, proximosDias } = cenario;

  const [ano, mes, dia] = hojeStr.split("-").map(Number);
  const hojeDate  = new Date(ano, mes - 1, dia);
  const amanhaStr = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().split("T")[0];
  const dataStr   = `${diasSemana[hojeDate.getDay()]}, ${hojeDate.getDate()} de ${mesesArr[hojeDate.getMonth()]}`;

  // Foco do Dia — próximo compromisso de hoje ainda não concluído/cancelado
  // (mesma regra de app/dashboard/page.tsx).
  const focoDoDia: AgItem | null = agendaHoje.find(
    a => !["concluido", "cancelado", "faltou"].includes(a.status)
  ) ?? null;

  // Próximos 7 Dias — agrupa hoje (não cancelado/faltou) + próximos dias por
  // data, mesma regra de app/dashboard/page.tsx.
  const gruposDias: Record<string, AgItem[]> = {};
  agendaHoje
    .filter(a => !["cancelado", "faltou"].includes(a.status))
    .forEach(a => { (gruposDias[a.data] ??= []).push(a); });
  proximosDias.forEach(a => { (gruposDias[a.data] ??= []).push(a); });
  const diasOrdenados = Object.keys(gruposDias).sort();

  // Lembretes = atrasados (sempre nenhum no cenário sintético) + pendentes
  // de hoje — mesma regra de app/dashboard/page.tsx.
  const lembretes: AgItem[] = agendaHoje.filter(a => a.status === "agendado");

  const ideia = gerarIdeia({
    totalPacientes: ctxNegocio.totalPacientes,
    atrasados:      ctxNegocio.atrasados,
    pendentes:      ctxNegocio.pendentesHoje,
    proximosSemana: ctxNegocio.proximosSemana,
    temLogo:        true,
    temEmail:       ctxNegocio.temEmail,
    temTelefone:    ctxNegocio.temTelefone,
    temEndereco:    ctxNegocio.temEndereco,
    hoje:           hojeStr,
  });

  const insights = gerarInsights({
    totalPacientes: ctxNegocio.totalPacientes,
    pendentes:      ctxNegocio.pendentesHoje,
    atrasados:      ctxNegocio.atrasados,
  });

  const centralOportunidades = insights.temDados
    ? gerarCentralOportunidades(ctxNegocio)
    : { alta: [], media: [], baixa: [] };

  const oportunidadesClientes = insights.temDados
    ? gerarOportunidadesClientes(entradaOportunidades)
    : [];

  const resumoRadar = gerarResumoRadar(oportunidadesClientes.length);

  // Padrão institucional (V1): saudação sempre genérica, nunca personalizada
  // — mesma regra do Dashboard real (nunca personalizar em demonstração).
  const saudacaoCard = gerarSaudacaoCard({ nomeNegocio: "", ambienteProducao: false });

  const totalSlotsHoje = ctxNegocio.compromissosHoje + ctxNegocio.horariosVagosHoje;
  const ocupacaoPct = insights.temDados && totalSlotsHoje > 0
    ? Math.round((ctxNegocio.compromissosHoje / totalSlotsHoje) * 100)
    : null;

  const todasRecomendacoesAcionaveis = [
    ...centralOportunidades.alta, ...centralOportunidades.media, ...centralOportunidades.baixa,
  ];
  const proximasAcoes = insights.temDados
    ? gerarProximasAcoes(todasRecomendacoesAcionaveis, oportunidadesClientes)
    : [];

  const sinaisCanonicos = insights.temDados
    ? [...adaptarOportunidadesClientes(oportunidadesClientes), ...adaptarRecomendacoes(todasRecomendacoesAcionaveis)]
    : [];
  const missaoDoDia: SinalCanonico[] = gerarMissaoDoDia(sinaisCanonicos);

  const resumoIA = gerarResumoIA({
    ocupacaoPct,
    horariosVagosHoje: ctxNegocio.horariosVagosHoje,
    pendentes: ctxNegocio.pendentesHoje,
  });

  const recomendacoesConsultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: insights.temDados,
    oportunidadesClientes,
    recomendacoes: todasRecomendacoesAcionaveis,
    ocupacaoPct,
  });
  const narrativaDiretor = insights.temDados
    ? gerarNarrativaDiretor({ ocupacaoPct, recomendacoes: recomendacoesConsultivas })
    : gerarMensagemDadosInsuficientes();

  const oportunidadesResumo = [
    ctxNegocio.clientesParaReativar > 0 ? `${ctxNegocio.clientesParaReativar} cliente${ctxNegocio.clientesParaReativar > 1 ? "s" : ""} sem retorno` : null,
    ctxNegocio.horariosVagosHoje    > 0 ? `${ctxNegocio.horariosVagosHoje} horário${ctxNegocio.horariosVagosHoje > 1 ? "s" : ""} livre${ctxNegocio.horariosVagosHoje > 1 ? "s" : ""}` : null,
    ctxNegocio.avaliacoesPendentes  > 0 ? `${ctxNegocio.avaliacoesPendentes} avaliaç${ctxNegocio.avaliacoesPendentes > 1 ? "ões" : "ão"} pendente${ctxNegocio.avaliacoesPendentes > 1 ? "s" : ""}` : null,
  ].filter((s): s is string => s !== null);

  const objetivosDoDia = [
    { label: "Confirmar todos os atendimentos", feito: ctxNegocio.pendentesHoje === 0 && ctxNegocio.atrasados === 0 },
    { label: "Preencher horários livres",       feito: ctxNegocio.horariosVagosHoje === 0 },
    { label: "Solicitar avaliações",            feito: ctxNegocio.avaliacoesPendentes === 0 },
    { label: "Encerrar o dia sem pendências",   feito: ctxNegocio.atrasados === 0 && ctxNegocio.pendentesHoje === 0 },
  ];

  const contaMadura = ctxNegocio.temEmail && ctxNegocio.temTelefone && ctxNegocio.temEndereco
    && ctxNegocio.temWhatsapp && ctxNegocio.totalPacientes > 0 && ctxNegocio.totalAgendamentos > 0;

  return (
    <DashboardView
      clinicaId="demo"
      dataStr={dataStr}
      saudacaoCard={saudacaoCard}
      temDados={insights.temDados}
      situacaoEmoji={insights.situacao.emoji}
      situacaoTom={insights.situacao.tom}
      ocupacaoPct={ocupacaoPct}
      botoesRapidos={[
        { icon: "➕", label: "Novo Cliente",     destino: "/clientes"     },
        { icon: "📅", label: "Novo Agendamento", destino: "/agendamentos" },
        { icon: "💬", label: "WhatsApp",         destino: "/chatbot"      },
        { icon: "📊", label: "Relatórios",       destino: "/metricas"     },
      ]}
      contaMadura={contaMadura}
      onboarding={{
        temEmpresa: ctxNegocio.temEmail && ctxNegocio.temTelefone && ctxNegocio.temEndereco,
        temWhatsapp: ctxNegocio.temWhatsapp,
        temCliente: ctxNegocio.totalPacientes > 0,
        temCompromisso: ctxNegocio.totalAgendamentos > 0,
      }}
      ideia={ideia}
      missaoDoDia={missaoDoDia}
      proximasAcoes={proximasAcoes}
      indicadores={{
        compromissosHoje: ctxNegocio.compromissosHoje,
        horariosVagosHoje: ctxNegocio.horariosVagosHoje,
        pendentes: ctxNegocio.pendentesHoje,
        atrasados: ctxNegocio.atrasados,
        avaliacoesPendentes: ctxNegocio.avaliacoesPendentes,
      }}
      resumoIA={resumoIA}
      narrativaDiretor={narrativaDiretor}
      recomendacoesConsultivas={recomendacoesConsultivas}
      focoDoDia={focoDoDia}
      hojeStr={hojeStr}
      amanhaStr={amanhaStr}
      diasOrdenados={diasOrdenados}
      gruposDias={gruposDias}
      lembretes={lembretes}
      oportunidadesResumo={oportunidadesResumo}
      objetivosDoDia={objetivosDoDia}
      oportunidadesClientes={oportunidadesClientes}
      resumoRadar={resumoRadar}
      centralOportunidades={centralOportunidades}
      onNavigate={(destino) => router.push(destino)}
      exibirWelcomeModal={false}
      textoBemVindo={{
        titulo: "📈 Seu negócio, sempre organizado",
        texto1: "É assim, todos os dias: cada cliente, cada agenda e cada oportunidade acompanhados automaticamente, sem depender da sua memória.",
        texto2: "Continue explorando o painel para ver como cada bloco acima chegou a essas prioridades.",
      }}
    />
  );
}
