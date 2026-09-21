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
// Correção Visual Final V1: a Home foi enxugada (ver app/components/
// DashboardView.tsx) — Foco do Dia/Próximos 7 Dias/Lembretes saíram do
// centro (viraram profundidade de /agendamentos), então agendaHoje/
// proximosDias do cenário sintético não são mais consumidos aqui.
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { gerarCenarioDemonstracao } from "../../lib/dados-demonstracao";
import { gerarCentralOportunidades } from "../../lib/recomendacoes";
import { gerarOportunidadesClientes, gerarResumoRadar } from "../../lib/oportunidades-clientes";
import { gerarRecomendacoesConsultivas, gerarNarrativaDiretor, gerarMensagemDadosInsuficientes } from "../../lib/ia-comercial";
import { adaptarOportunidadesClientes, adaptarRecomendacoes, gerarMissaoDoDia, type SinalCanonico } from "../../lib/nucleo-inteligente";
import DashboardView, {
  gerarIdeia, gerarInsights, gerarSaudacaoCard,
} from "../components/DashboardView";
import AdminShell from "../components/AdminShell";
import PageLoader from "../components/PageLoader";

const diasSemana = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const mesesArr   = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

export default function DashboardDemo() {
  const router = useRouter();
  const [cenario, setCenario] = useState<ReturnType<typeof gerarCenarioDemonstracao> | null>(null);

  useEffect(() => {
    // Gerado em memória, no navegador — sempre relativo ao momento real da
    // visita (nunca uma data fixa gravada no código), nunca uma consulta ao
    // Supabase, nunca persistido. Deliberadamente client-only (nunca no
    // useState inicial): gerarCenarioDemonstracao() usa a data/hora real do
    // momento — computá-lo durante o render (inclusive o render de servidor
    // do Next.js) causaria um cenário diferente entre servidor e cliente
    // (erro de hidratação); o useEffect garante que só roda no navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState único, mount-only, client-only por design (ver comentário acima); não é um "derived state" sincronizável de outro jeito.
    setCenario(gerarCenarioDemonstracao());
  }, []);

  if (!cenario) return (
    <AdminShell title="Painel Executivo">
      <PageLoader title="Preparando seu painel..." />
    </AdminShell>
  );

  const { hoje: hojeStr, entradaOportunidades, contextoNegocio: ctxNegocio } = cenario;

  const [ano, mes, dia] = hojeStr.split("-").map(Number);
  const hojeDate  = new Date(ano, mes - 1, dia);
  const dataStr   = `${diasSemana[hojeDate.getDay()]}, ${hojeDate.getDate()} de ${mesesArr[hojeDate.getMonth()]}`;

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

  const sinaisCanonicos = insights.temDados
    ? [...adaptarOportunidadesClientes(oportunidadesClientes), ...adaptarRecomendacoes(todasRecomendacoesAcionaveis)]
    : [];
  const missaoDoDia: SinalCanonico[] = gerarMissaoDoDia(sinaisCanonicos);

  const recomendacoesConsultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: insights.temDados,
    oportunidadesClientes,
    recomendacoes: todasRecomendacoesAcionaveis,
    ocupacaoPct,
  });
  const narrativaDiretor = insights.temDados
    ? gerarNarrativaDiretor({ ocupacaoPct, recomendacoes: recomendacoesConsultivas })
    : gerarMensagemDadosInsuficientes();

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
        { icon: "💰", label: "Orçamentos",       destino: "/orcamentos"   },
        { icon: "⭐", label: "Reputação",        destino: "/reputacao"    },
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
      indicadores={{
        compromissosHoje: ctxNegocio.compromissosHoje,
        horariosVagosHoje: ctxNegocio.horariosVagosHoje,
        pendentes: ctxNegocio.pendentesHoje,
        atrasados: ctxNegocio.atrasados,
        avaliacoesPendentes: ctxNegocio.avaliacoesPendentes,
      }}
      narrativaDiretor={narrativaDiretor}
      oportunidadesClientes={oportunidadesClientes}
      resumoRadar={resumoRadar}
      orcamentosParadosCount={0}
      cobrancasAbertasCount={null}
      indicadoresCobranca={null}
      itensAtividade={[]}
      atividadeIndisponivel={false}
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
