"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { gerarCentralOportunidades } from "../../lib/recomendacoes";
import { obterHorariosVagos } from "../../lib/horarios";
import { gerarOportunidadesClientes, gerarResumoRadar, type OportunidadeCliente } from "../../lib/oportunidades-clientes";
import type { Orcamento } from "../../lib/motor-orcamentos";
import type { Tratamento } from "../../lib/motor-tratamento";
import { calcularIndicadoresCobranca, type Cobranca, type IndicadoresCobranca } from "../../lib/motor-cobranca";
import { agregarClientesElegiveisRecompra, type PedidoStatus } from "../../lib/motor-pedidos";
import { calcularAtividadeRecente, type ItemAtividade } from "../../lib/organizapro-trabalhando";

type PedidoRow = {
  id: string; nome_cliente: string; telefone: string | null; valor_centavos: number; status: string; criado_em: string;
  paciente_id?: string | null; pagamento_confirmado_em?: string | null;
  pedido_itens?: { descricao: string }[];
};
import { gerarRecomendacoesConsultivas, gerarNarrativaDiretor, gerarMensagemDadosInsuficientes } from "../../lib/ia-comercial";
import { adaptarOportunidadesClientes, adaptarRecomendacoes, gerarMissaoDoDia, type SinalCanonico } from "../../lib/nucleo-inteligente";
import DashboardView, {
  gerarIdeia, gerarInsights, gerarSaudacaoCard, gerarResumoIA, gerarProximasAcoes,
  type AgItem,
} from "../components/DashboardView";
import AdminShell from "../components/AdminShell";
import PageLoader from "../components/PageLoader";

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
  orcamentosParadosRows: Orcamento[];
  pedidosNaoConcluidosRows: PedidoRow[];
  todosPedidosRows: PedidoRow[];
  tratamentosAtivosRows: Tratamento[];
  cobrancasAbertasRows: Cobranca[];
  todasCobrancasRows: Cobranca[];
  itensAtividade: ItemAtividade[];
  atividadeIndisponivel: boolean;
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
    orcamentosParadosRows: [],
    pedidosNaoConcluidosRows: [],
    todosPedidosRows: [],
    tratamentosAtivosRows: [],
    cobrancasAbertasRows: [],
    todasCobrancasRows: [],
    itensAtividade: [],
    atividadeIndisponivel: false,
  });

  const carregarDados = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push("/login"); return; }
      const cuRes = await fetch("/api/minha-clinica", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      if (!cid) { setLoading(false); return; }
      setClinicaId(cid);

      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const [ano, mes, dia] = hoje.split("-").map(Number);
      const amanha  = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().split("T")[0];
      const fimSete = new Date(Date.UTC(ano, mes - 1, dia + 6)).toISOString().split("T")[0];
      const trintaDiasAtras = new Date(Date.UTC(ano, mes - 1, dia - 30)).toISOString().split("T")[0];

      // Convergência de Orçamentos — public.orcamentos só é acessível via
      // service role (RLS sem policy para authenticated/anon, confirmado no
      // dump de schema real), então a leitura passa pela API já autorizada
      // (/api/orcamentos), nunca por uma query direta do client aqui. Corre
      // em paralelo com o bloco abaixo; falha de rede/autorização nunca
      // fabrica orçamento — só resulta em lista vazia (nenhum sinal novo).
      const orcamentosParadosPromise = fetch(`/api/orcamentos?clinica_id=${cid}&status=apresentado`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (r) => (r.ok ? ((await r.json()).orcamentos as Orcamento[]) ?? [] : []))
        .catch(() => [] as Orcamento[]);

      // E-commerce IA V1 — mesmo raciocínio: public.pedidos só é acessível
      // via service role, leitura via /api/pedidos. Busca TODOS os pedidos
      // de uma vez (a API não filtra por múltiplos status numa única
      // chamada); "não concluídos" e "recompra possível" são dois recortes
      // client-side da MESMA lista, nunca uma segunda consulta — falha
      // nunca fabrica pedido, só lista vazia.
      const todosPedidosPromise = fetch(`/api/pedidos?clinica_id=${cid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (r) => (r.ok ? ((await r.json()).pedidos as PedidoRow[]) ?? [] : []))
        .catch(() => [] as PedidoRow[]);

      // Smart Commerce Canônico — mesmo raciocínio: public.tratamentos e
      // public.cobrancas só são acessíveis via service role, leitura via
      // /api/tratamentos e /api/cobrancas. Sem filtro de status na URL
      // (mesmo padrão de pedidos) — o filtro real acontece aqui e dentro
      // do próprio Radar (estaAtrasada/precisaRetorno). Falha nunca
      // fabrica tratamento/cobrança, só resulta em lista vazia.
      const tratamentosAtivosPromise = fetch(`/api/tratamentos?clinica_id=${cid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (r) => {
          if (!r.ok) return [] as Tratamento[];
          const todos = ((await r.json()).tratamentos as Tratamento[]) ?? [];
          return todos.filter((t) => t.status === "em_andamento" || t.status === "interrompido");
        })
        .catch(() => [] as Tratamento[]);

      // Dinheiro (Bloco F) precisa de TODAS as cobranças (inclusive pagas/
      // canceladas) para calcularIndicadoresCobranca (recebido/recuperado no
      // mês); "abertas" (pendente/em_cobranca) continua um recorte client-side
      // da MESMA lista, nunca uma segunda consulta.
      const todasCobrancasPromise = fetch(`/api/cobrancas?clinica_id=${cid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (r) => (r.ok ? ((await r.json()).cobrancas as Cobranca[]) ?? [] : []))
        .catch(() => [] as Cobranca[]);

      // Bloco G "OrganizaPro trabalhando" — atividade real dos últimos dias,
      // via /api/atividade-recente (eventos_dominio, service role). Falha
      // nunca fabrica atividade, só resulta em lista vazia + indisponivel.
      const atividadeRecentePromise = fetch(`/api/atividade-recente?clinica_id=${cid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (r) => {
          if (!r.ok) return { eventos: [] as { tipo: string; resultado: string | null }[], indisponivel: true };
          const json = await r.json();
          return { eventos: (json.eventos ?? []) as { tipo: string; resultado: string | null }[], indisponivel: !!json.indisponivel };
        })
        .catch(() => ({ eventos: [] as { tipo: string; resultado: string | null }[], indisponivel: true }));

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

      const orcamentosParadosRows = await orcamentosParadosPromise;
      const todosPedidosRows = await todosPedidosPromise;
      const pedidosNaoConcluidosRows = todosPedidosRows.filter((p) => p.status === "criado" || p.status === "confirmado");
      const tratamentosAtivosRows = await tratamentosAtivosPromise;
      const todasCobrancasRows = await todasCobrancasPromise;
      const cobrancasAbertasRows = todasCobrancasRows.filter((c) => c.status === "pendente" || c.status === "em_cobranca");
      const { eventos: eventosAtividade, indisponivel: atividadeIndisponivel } = await atividadeRecentePromise;
      const itensAtividade = calcularAtividadeRecente(eventosAtividade);

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
        orcamentosParadosRows,
        pedidosNaoConcluidosRows,
        todosPedidosRows,
        tratamentosAtivosRows,
        cobrancasAbertasRows,
        todasCobrancasRows,
        itensAtividade,
        atividadeIndisponivel,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // Date helpers
  const agoraIso   = new Date().toISOString(); // referência de "agora" para o motor de orçamentos (timestamptz, não data-only)
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

  // Botões Rápidos — Bloco H da Casa (Convergência Final V1: Orçamentos e
  // Reputação adicionados, ambos já reais e agora diretamente referenciados
  // pela Faixa Executiva/Radar/Dinheiro acima — nunca um menu duplicado,
  // só os atalhos que a própria Casa já cita). WhatsApp e Relatórios ainda
  // não têm uma página própria com esse nome — direcionam para /chatbot e
  // /metricas, as páginas reais mais próximas hoje.
  const botoesRapidos = [
    { icon: "➕", label: "Novo Cliente",     destino: "/clientes"     },
    { icon: "📅", label: "Novo Agendamento", destino: "/agendamentos" },
    { icon: "💰", label: "Orçamentos",       destino: "/orcamentos"   },
    { icon: "⭐", label: "Reputação",        destino: "/reputacao"    },
    { icon: "💬", label: "WhatsApp",         destino: "/chatbot"      },
    { icon: "📊", label: "Relatórios",       destino: "/metricas"     },
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
        agora: agoraIso,
        clientesSemProximoCompromisso: dash.clientesSemProximoRows.map(c => ({
          id: c.id, nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, proximaConsulta: c.proxima_consulta,
        })),
        cancelamentosSemReagendamento: dash.cancelamentosSemReagendamentoRows.map(a => ({
          id: a.id, nome: a.nome, telefone: a.telefone, data: a.data,
        })),
        confirmacoesPendentes: dash.agendaHoje
          .filter(a => a.status === "agendado")
          .map(a => ({ id: a.id, nome: a.paciente_nome, telefone: a.telefone || null, data: a.data })),
        // Convergência de Orçamentos — dados já buscados acima via
        // /api/orcamentos (service role, escopado por clinica_id); o cálculo
        // de "parado" continua delegado ao motor real dentro do Radar.
        orcamentosParados: dash.orcamentosParadosRows.map(o => ({
          id: o.id, pacienteNome: o.paciente_nome, telefone: o.telefone, procedimento: o.procedimento,
          valor: o.valor, apresentadoEm: o.apresentado_em,
        })),
        // E-commerce IA V1 — dados já buscados acima via /api/pedidos
        // (service role, escopado por clinica_id).
        pedidosNaoConcluidos: dash.pedidosNaoConcluidosRows.map(p => ({
          id: p.id, pacienteNome: p.nome_cliente, telefone: p.telefone,
          descricao: p.pedido_itens?.length ? `${p.pedido_itens.length} ${p.pedido_itens.length === 1 ? "item" : "itens"}` : "pedido",
          valor: p.valor_centavos / 100, criadoEm: p.criado_em,
        })),
        // Recompra possível — mesma lista de /api/pedidos usada acima,
        // agregada por cliente (último pedido × ele está pago) pelo motor
        // real (agregarClientesElegiveisRecompra, lib/motor-pedidos.ts).
        // O limiar de 60 dias e o cálculo de "dias" continuam dentro de
        // gerarOportunidadesClientes — este bloco só resolve "qual é o
        // último pedido de cada cliente e ele está pago", nunca infere
        // além disso. Zero consulta nova.
        recomprasPossiveis: agregarClientesElegiveisRecompra(dash.todosPedidosRows.map(p => ({
          pacienteId:            p.paciente_id ?? null,
          telefone:              p.telefone,
          nomeCliente:           p.nome_cliente,
          status:                p.status as PedidoStatus,
          criadoEm:              p.criado_em,
          pagamentoConfirmadoEm: p.pagamento_confirmado_em ?? null,
        }))),
        // Smart Commerce Canônico — Convergência de Tratamentos/Cobranças:
        // dados já buscados acima via /api/tratamentos e /api/cobrancas
        // (service role, escopado por clinica_id).
        tratamentosSemRetorno: dash.tratamentosAtivosRows.map(t => ({
          id: t.id, pacienteNome: t.paciente_nome, telefone: t.paciente_telefone,
          tipoTratamento: t.tipo_tratamento, status: t.status,
          proximaDataPrevista: t.proxima_data_prevista, updatedAt: t.updated_at, interrompidoEm: t.interrompido_em,
        })),
        cobrancasAtrasadas: dash.cobrancasAbertasRows.map(c => ({
          id: c.id, pacienteNome: c.paciente_nome, telefone: c.paciente_telefone,
          descricao: c.descricao, valor: c.valor, vencimento: c.vencimento,
          status: c.status as "pendente" | "em_cobranca",
        })),
      })
    : [];

  // Radar de Oportunidades — frase de abertura na voz do Diretor Digital.
  const resumoRadar = gerarResumoRadar(oportunidadesClientes.length);

  // Bloco F "Dinheiro" — mesmo motor real já usado em app/cobrancas/page.tsx
  // (calcularIndicadoresCobranca), nenhum cálculo novo. null (nunca 0)
  // quando a clínica ainda não tem nenhuma cobrança registrada — a tela não
  // pode fingir ter medido algo que não existe.
  const indicadoresCobranca: IndicadoresCobranca | null =
    dash.todasCobrancasRows.length > 0 ? calcularIndicadoresCobranca(dash.todasCobrancasRows, agoraIso) : null;

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

  // "Próxima Melhor Ação" — mescla de Central de Oportunidades + Radar,
  // nenhuma regra de negócio nova (ver gerarProximasAcoes acima).
  const todasRecomendacoesAcionaveis = [
    ...centralOportunidades.alta, ...centralOportunidades.media, ...centralOportunidades.baixa,
  ];
  const proximasAcoes = insights.temDados
    ? gerarProximasAcoes(todasRecomendacoesAcionaveis, oportunidadesClientes)
    : [];

  // ── 🎯 Missão do Dia (Núcleo Inteligente V1.1, Fase 1) ───────────────────
  // Mesmos sinais canônicos que alimentam a Próxima Melhor Ação — nenhuma
  // regra de priorização própria, nenhuma consulta nova. Ver
  // docs/nucleo-inteligente-v1-arquitetura.md, seção 4.5.
  const sinaisCanonicos = insights.temDados
    ? [...adaptarOportunidadesClientes(oportunidadesClientes), ...adaptarRecomendacoes(todasRecomendacoesAcionaveis)]
    : [];
  const missaoDoDia: SinalCanonico[] = gerarMissaoDoDia(sinaisCanonicos);

  const resumoIA = gerarResumoIA({
    ocupacaoPct,
    horariosVagosHoje: dash.horariosVagosHoje,
    pendentes: dash.pendentes,
  });

  // ── IA Comercial V1 · Diretor Digital (docs/ia-comercial-v1-arquitetura.md) ──
  // Reaproveita 100% os mesmos dados já calculados acima para o Radar e para
  // a Central de Oportunidades — nenhuma consulta nova, nenhuma regra de
  // priorização nova, nenhum dos dois arquivos originais foi alterado.
  const recomendacoesConsultivas = gerarRecomendacoesConsultivas({
    temDadosSuficientes: insights.temDados,
    oportunidadesClientes,
    recomendacoes: todasRecomendacoesAcionaveis,
    ocupacaoPct,
  });
  const narrativaDiretor = insights.temDados
    ? gerarNarrativaDiretor({ ocupacaoPct, recomendacoes: recomendacoesConsultivas })
    : gerarMensagemDadosInsuficientes();

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

  return (
    <DashboardView
      clinicaId={clinicaId}
      dataStr={dataStr}
      saudacaoCard={saudacaoCard}
      temDados={insights.temDados}
      situacaoEmoji={insights.situacao.emoji}
      situacaoTom={insights.situacao.tom}
      ocupacaoPct={ocupacaoPct}
      botoesRapidos={botoesRapidos}
      contaMadura={contaMadura}
      onboarding={{
        temEmpresa: dash.temEmail && dash.temTelefone && dash.temEndereco,
        temWhatsapp: dash.temWhatsapp,
        temCliente: dash.totalPacientes > 0,
        temCompromisso: dash.totalAgendamentos > 0,
      }}
      ideia={ideia}
      missaoDoDia={missaoDoDia}
      proximasAcoes={proximasAcoes}
      indicadores={{
        compromissosHoje: dash.compromissosHoje,
        horariosVagosHoje: dash.horariosVagosHoje,
        pendentes: dash.pendentes,
        atrasados: dash.atrasados,
        avaliacoesPendentes: dash.avaliacoesPendentes,
      }}
      resumoIA={resumoIA}
      narrativaDiretor={narrativaDiretor}
      focoDoDia={focoDoDia}
      hojeStr={hojeStr}
      amanhaStr={amanhaStr}
      diasOrdenados={diasOrdenados}
      gruposDias={gruposDias}
      lembretes={lembretes}
      objetivosDoDia={objetivosDoDia}
      oportunidadesClientes={oportunidadesClientes}
      resumoRadar={resumoRadar}
      orcamentosParadosCount={dash.orcamentosParadosRows.length}
      cobrancasAbertasCount={dash.todasCobrancasRows.length > 0 ? dash.cobrancasAbertasRows.length : null}
      indicadoresCobranca={indicadoresCobranca}
      itensAtividade={dash.itensAtividade}
      atividadeIndisponivel={dash.atividadeIndisponivel}
      onNavigate={(destino) => router.push(destino)}
    />
  );
}
