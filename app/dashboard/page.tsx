"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";

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
  temLogo:          boolean;
  temEmail:         boolean;
  temTelefone:      boolean;
  temEndereco:      boolean;
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
    texto: "Cada cliente cadastrado é um potencial retorno recorrente. Que tal iniciar sua base de clientes hoje?",
    icone: "👥",
    porQueImporta: "Mais clientes cadastrados ajudam a organizar o relacionamento, acompanhar o crescimento e abrir novas oportunidades de venda.",
    impactoEsperado: "Sua operação ficará mais completa e o crescimento do negócio ficará mais fácil de acompanhar.",
    tempoEstimado: "≈ 10 minutos",
    destino: "/pacientes", destino_label: "Cadastrar clientes",
  };
  if (!ctx.temLogo) return {
    texto: "Empresas com identidade visual registrada transmitem mais confiança e profissionalismo. Cadastre o logotipo da sua empresa.",
    icone: "🖼️",
    porQueImporta: "Uma identidade visual forte transmite mais profissionalismo, ganha confiança e faz a marca se destacar.",
    impactoEsperado: "Sua empresa passará uma imagem mais profissional e atrativa para os clientes.",
    tempoEstimado: "≈ 2 minutos",
    destino: "/configuracoes", destino_label: "Acessar configurações",
  };
  if (!ctx.temEmail || !ctx.temTelefone || !ctx.temEndereco) return {
    texto: "Um perfil completo aumenta a credibilidade da sua empresa e facilita que clientes te encontrem. Revise os dados cadastrais.",
    icone: "📋",
    porQueImporta: "Um cadastro completo deixa a operação mais organizada e prepara a empresa para crescer com mais consistência.",
    impactoEsperado: "Sua empresa ficará mais preparada para crescer e oferecer uma experiência melhor.",
    tempoEstimado: "≈ 5 minutos",
    destino: "/configuracoes", destino_label: "Completar perfil",
  };
  if (ctx.atrasados > 0) return {
    texto: `Você tem ${ctx.atrasados} compromisso${ctx.atrasados > 1 ? "s" : ""} em atraso. Resolver isso agora mantém a operação organizada e profissional.`,
    icone: "⏰",
    porQueImporta: "Resolver pendências evita esquecimentos, melhora o atendimento e mantém o negócio sob controle.",
    impactoEsperado: "Menos imprevistos, melhor organização e mais tranquilidade no dia a dia.",
    tempoEstimado: "≈ 10 minutos",
    destino: "/agendamentos", destino_label: "Ver agenda",
  };
  if (ctx.proximosSemana === 0) return {
    texto: "Sua agenda dos próximos dias está vazia. É um bom momento para prospectar e agendar novos compromissos.",
    icone: "📅",
    porQueImporta: "Reabastecer a agenda cria mais oportunidades, mantém o fluxo de atendimento e fortalece a receita.",
    impactoEsperado: "Mais oportunidades de atendimento e um fluxo de trabalho mais constante.",
    tempoEstimado: "≈ 5 minutos",
    destino: "/agendamentos", destino_label: "Agendar compromisso",
  };
  if (ctx.pendentes > 0) return {
    texto: `Há ${ctx.pendentes} compromisso${ctx.pendentes > 1 ? "s" : ""} sem confirmação para hoje. Confirme agora e evite ausências inesperadas.`,
    icone: "✅",
    porQueImporta: "Confirmar compromissos reduz faltas, melhora a rotina e mantém o atendimento mais previsível.",
    impactoEsperado: "Menos ausências e uma rotina mais tranquila para a equipe.",
    tempoEstimado: "≈ 5 minutos",
    destino: "/agendamentos", destino_label: "Confirmar agora",
  };
  const gerais: IdeiaDodia[] = [
    { texto: "Entre em contato com clientes que você não atende há mais de 30 dias. A reativação custa menos do que captar novos clientes.", icone: "📞", porQueImporta: "Reativar clientes antigos é uma forma simples de recuperar receita e fortalecer o relacionamento.", impactoEsperado: "Você pode recuperar vendas e reforçar o relacionamento com clientes antigos.", tempoEstimado: "≈ 5 minutos", destino: "/pacientes", destino_label: "Ver clientes" },
    { texto: "Revise sua base de clientes e complete os dados faltantes. Uma base bem organizada é o ativo mais valioso do seu negócio.", icone: "🗂️", porQueImporta: "Uma base bem organizada ajuda a vender melhor e a tomar decisões com mais confiança.", impactoEsperado: "Seu time ganha mais organização e suas decisões ficam mais acertadas.", tempoEstimado: "≈ 10 minutos", destino: "/pacientes", destino_label: "Ver clientes" },
    { texto: "Considere pedir avaliações aos seus clientes mais recentes. A reputação online cresce uma avaliação de cada vez.", icone: "⭐", porQueImporta: "Boas avaliações aumentam a confiança do cliente e ajudam a atrair novos negócios.", impactoEsperado: "Sua reputação fica mais forte e atrai mais clientes.", tempoEstimado: "≈ 3 minutos", },
    { texto: "Revise os compromissos da próxima semana com antecedência. Empresas organizadas surpreendem positivamente seus clientes.", icone: "📆", porQueImporta: "Planejar com antecedência reduz imprevistos e melhora a experiência do cliente.", impactoEsperado: "Você evita atrasos e entrega um atendimento mais previsível.", tempoEstimado: "≈ 5 minutos", destino: "/agendamentos", destino_label: "Ver agenda" },
    { texto: "Uma empresa bem documentada cresce com mais segurança. Faça backup dos seus documentos e registros importantes.", icone: "💾", porQueImporta: "Manter documentos em ordem protege o negócio e facilita a operação no dia a dia.", impactoEsperado: "Seu negócio fica mais seguro e a rotina fica mais tranquila.", tempoEstimado: "≈ 15 minutos", },
    { texto: "Organize e revise os serviços que você mais oferece. Clareza no que você entrega facilita a venda e o relacionamento com clientes.", icone: "📌", porQueImporta: "Mostrar com clareza o que sua empresa entrega facilita a venda e fortalece a percepção de valor.", impactoEsperado: "Seus clientes entendem melhor o que você oferece e compram com mais facilidade.", tempoEstimado: "≈ 10 minutos", },
    { texto: "Envie uma mensagem para um cliente antigo hoje. Um simples contato pode reativar um relacionamento e gerar nova receita.", icone: "💬", porQueImporta: "Um contato bem feito pode reabrir oportunidades e trazer nova receita sem grandes esforços.", impactoEsperado: "Você pode reacender oportunidades e gerar mais negócios.", tempoEstimado: "≈ 3 minutos", destino: "/pacientes", destino_label: "Ver clientes" },
    { texto: "Atualize o horário de funcionamento da empresa. Clientes que sabem quando te encontrar chegam mais preparados e satisfeitos.", icone: "🕐", porQueImporta: "Informações claras ajudam a atrair clientes certos e evitam frustrações.", impactoEsperado: "Clientes chegam mais preparados e sua comunicação fica mais eficiente.", tempoEstimado: "≈ 3 minutos", destino: "/configuracoes", destino_label: "Configurações" },
    { texto: "Agende os compromissos da próxima semana hoje. Uma agenda planejada reduz imprevistos e transmite profissionalismo.", icone: "🗓️", porQueImporta: "Uma agenda planejada reduz imprevistos e ajuda a empresa a entregar mais com menos estresse.", impactoEsperado: "Você ganha mais controle do tempo e melhora sua produtividade.", tempoEstimado: "≈ 5 minutos", destino: "/agendamentos", destino_label: "Agendar" },
    { texto: "Clientes sem telefone cadastrado ficam fora do alcance dos lembretes automáticos. Vale a pena completar esses dados.", icone: "📱", porQueImporta: "Dados completos melhoram o atendimento e aumentam as chances de gerar retorno recorrente.", impactoEsperado: "Você melhora o alcance dos contatos e fortalece a relação com os clientes.", tempoEstimado: "≈ 5 minutos", destino: "/pacientes", destino_label: "Ver clientes" },
  ];
  const [y, m, d] = ctx.hoje.split("-").map(Number);
  return gerais[(y * 366 + m * 31 + d) % gerais.length];
}

function saudacao(): string {
  const h = parseInt(
    new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" })
  );
  if (h >= 6 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
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

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<DashData>({
    compromissosHoje: 0, pendentes: 0, atrasados: 0,
    agendaHoje: [], proximos: [], atrasadosList: [],
    totalPacientes: 0, temLogo: false, temEmail: false, temTelefone: false, temEndereco: false,
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

      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const [ano, mes, dia] = hoje.split("-").map(Number);
      const amanha  = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().split("T")[0];
      const fimSete = new Date(Date.UTC(ano, mes - 1, dia + 6)).toISOString().split("T")[0];

      const [
        { data: agHoje },
        { data: prox },
        { data: atrasados },
        { count: pacCount },
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
        supabase.from("clinica_config")
          .select("logo_url, email, telefone, endereco")
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
        temLogo:          !!cfg?.logo_url,
        temEmail:         !!cfg?.email,
        temTelefone:      !!cfg?.telefone,
        temEndereco:      !!cfg?.endereco,
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

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Inter,sans-serif" }}>
      Carregando...
    </div>
  );

  return (
    <AdminShell title="Dashboard" subtitle={dataStr}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .dc  { animation: fadeUp 0.35s ease both; }
        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 700px) { .dash-grid { grid-template-columns: 1fr; } }
        .btn-rapido:hover { background: rgba(31,78,95,0.25) !important; border-color: rgba(31,78,95,0.55) !important; }
      `}</style>

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
          Hoje você possui:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16 }}>🟢</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#4ade80", minWidth: 36, lineHeight: 1 }}>
              {dash.compromissosHoje}
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>
              compromisso{dash.compromissosHoje !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16 }}>🟡</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#fbbf24", minWidth: 36, lineHeight: 1 }}>
              {dash.pendentes}
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>
              pendente{dash.pendentes !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16 }}>🔴</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: dash.atrasados > 0 ? "#f87171" : "#475569", minWidth: 36, lineHeight: 1 }}>
              {dash.atrasados}
            </span>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>
              atrasado{dash.atrasados !== 1 ? "s" : ""}
            </span>
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
              Nenhum compromisso para hoje.{" "}
              <span
                style={{ color: "#4a9bb0", cursor: "pointer", fontWeight: 600 }}
                onClick={() => router.push("/agendamentos")}
              >
                Agendar agora
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
              Nenhum compromisso nos próximos 7 dias.
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

      {/* ── PRÓXIMA IDEIA ────────────────────────────────────────────────────── */}
      <div className="dc" style={{
        background: "linear-gradient(135deg, rgba(74,155,176,0.07), rgba(31,78,95,0.12))",
        border: "1px solid rgba(74,155,176,0.2)",
        borderRadius: 14, padding: "20px 22px", marginTop: 20,
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
              💡 Próxima Ideia · Consultoria do dia
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
                💡 Por que isso importa?
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

    </AdminShell>
  );
}
