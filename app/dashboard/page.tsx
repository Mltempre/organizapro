"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgItem = any;

type DashStats = {
  clientes:         number;
  clientesMes:      number;
  compromissosHoje: number;
  proximosSete:     number;
  pendentes:        number;
  confirmadas:      number;
};

function saudacao(): string {
  const h = parseInt(
    new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" })
  );
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function prioridadeLocal(s: DashStats): string {
  if (s.pendentes > 0)
    return `Você tem ${s.pendentes} compromisso${s.pendentes > 1 ? "s" : ""} pendente${s.pendentes > 1 ? "s" : ""} aguardando confirmação`;
  if (s.proximosSete > 0)
    return `${s.proximosSete} compromisso${s.proximosSete > 1 ? "s" : ""} programado${s.proximosSete > 1 ? "s" : ""} para os próximos 7 dias — tudo organizado`;
  if (s.clientes === 0)
    return "Comece cadastrando seus primeiros clientes para organizar sua agenda";
  return "Agenda em dia. Bom momento para cadastrar novos compromissos";
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashStats>({
    clientes: 0, clientesMes: 0, compromissosHoje: 0,
    proximosSete: 0, pendentes: 0, confirmadas: 0,
  });
  const [agendaHoje, setAgendaHoje] = useState<AgItem[]>([]);

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
      const inicioMes    = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fimProxSete  = new Date(Date.UTC(ano, mes - 1, dia + 7)).toISOString().split("T")[0];

      const [
        { count: totalClientes },
        { count: clientesMes },
        { data: agHoje },
        { count: proxSete },
        { count: pendentesTotal },
      ] = await Promise.all([
        supabase.from("pacientes").select("*", { count: "exact", head: true }).eq("clinica_id", cid),
        supabase.from("pacientes").select("*", { count: "exact", head: true }).eq("clinica_id", cid).gte("created_at", inicioMes),
        supabase.from("agendamentos").select("*").eq("clinica_id", cid).eq("data", hoje).order("hora"),
        supabase.from("agendamentos").select("*", { count: "exact", head: true })
          .eq("clinica_id", cid).gt("data", hoje).lte("data", fimProxSete)
          .not("status", "in", '("cancelado","concluido","faltou")'),
        supabase.from("agendamentos").select("*", { count: "exact", head: true })
          .eq("clinica_id", cid).gte("data", hoje).eq("status", "agendado"),
      ]);

      const lista       = agHoje || [];
      const confirmadas = lista.filter((a: AgItem) => ["confirmado","concluido"].includes(a.status)).length;
      const pendentes   = lista.filter((a: AgItem) => a.status === "agendado").length;
      const ativos      = lista.filter((a: AgItem) => !["cancelado","faltou"].includes(a.status));

      setStats({
        clientes:         totalClientes || 0,
        clientesMes:      clientesMes   || 0,
        compromissosHoje: ativos.length,
        proximosSete:     proxSete      || 0,
        pendentes:        (pendentesTotal || 0) + pendentes,
        confirmadas,
      });
      setAgendaHoje(lista);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const hoje = new Date();
  const diasSemana = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = `${diasSemana[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]}`;

  const taxaHoje = stats.compromissosHoje > 0
    ? Math.round((stats.confirmadas / stats.compromissosHoje) * 100) : null;

  const prioridade = prioridadeLocal(stats);

  const chips: Array<{ icon: string; text: string; color?: string }> = [
    {
      icon: "📅",
      text: stats.compromissosHoje === 0
        ? "Nenhum compromisso hoje"
        : `${stats.compromissosHoje} compromisso${stats.compromissosHoje > 1 ? "s" : ""} hoje`,
    },
    ...(taxaHoje !== null ? [{ icon: "✅", text: `${taxaHoje}% confirmados` }] : []),
    ...(stats.pendentes > 0
      ? [{ icon: "⚠", text: `${stats.pendentes} pendente${stats.pendentes > 1 ? "s" : ""}`, color: "#f59e0b" }]
      : []),
    ...(stats.proximosSete > 0
      ? [{ icon: "📆", text: `+${stats.proximosSete} nos próximos 7 dias` }]
      : []),
    ...(stats.pendentes === 0 && stats.compromissosHoje > 0
      ? [{ icon: "✓", text: "Agenda sem pendências" }]
      : []),
  ];

  const stStatus: Record<string, { bg: string; color: string; label: string }> = {
    confirmado: { bg: "#00FF8722", color: "#00FF87", label: "Confirmado" },
    agendado:   { bg: "#00C6FF22", color: "#00C6FF", label: "Agendado"   },
    concluido:  { bg: "#1F4E5F22", color: "#4a9bb0", label: "Concluído"  },
    faltou:     { bg: "#FF444422", color: "#f87171", label: "Faltou"     },
    cancelado:  { bg: "#64748b22", color: "#94a3b8", label: "Cancelado"  },
    reagendar:  { bg: "#ea580c22", color: "#fb923c", label: "Reagendar"  },
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Inter,sans-serif" }}>
      Carregando...
    </div>
  );

  return (
    <AdminShell
      title="Dashboard"
      subtitle={`${dataStr} · ${stats.compromissosHoje} compromisso${stats.compromissosHoje !== 1 ? "s" : ""} hoje`}
      actionLabel="+ Novo Compromisso"
      actionOnClick={() => router.push("/agendamentos")}
    >
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .dc { animation: fadeUp 0.4s ease both; }
        @media (max-width: 900px) { .d4 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 500px) { .d4 { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* ── SAUDAÇÃO ─────────────────────────────────────────────────────────── */}
      <div className="dc" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 2px" }}>
          👋 {saudacao()}!
        </p>
        <div style={{ fontSize: 16, fontWeight: 400, color: "#4a9bb0", margin: "0 0 3px", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 800, fontSize: 17, color: "#4a9bb0" }}>OrganizaPro</span>
          {"  "}
          <span style={{ color: "#475569", fontWeight: 400, fontSize: 13 }}>O sistema mais simples para organizar o seu negócio.</span>
        </div>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
          {stats.compromissosHoje === 0
            ? `${dataStr} • Nenhum compromisso agendado para hoje.`
            : `${dataStr} • ${stats.compromissosHoje} compromisso${stats.compromissosHoje > 1 ? "s" : ""} agendado${stats.compromissosHoje > 1 ? "s" : ""} para hoje.`}
        </p>
      </div>

      {/* ── PRIORIDADE DO DIA ─────────────────────────────────────────────────── */}
      <div className="dc" style={{
        background: "linear-gradient(135deg,rgba(31,78,95,0.12),rgba(74,155,176,0.06))",
        border: "1px solid rgba(31,78,95,0.3)",
        borderRadius: 16, padding: "18px 22px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: "rgba(31,78,95,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>🎯</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#4a9bb0", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>
            Foco do Dia
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.6 }}>
            {prioridade}
          </div>
        </div>
      </div>

      {/* ── CHIPS DE RESUMO ───────────────────────────────────────────────────── */}
      {chips.length > 0 && (
        <div className="dc" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {chips.map((chip, i) => (
            <span key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20, padding: "5px 13px",
              fontSize: 12, color: chip.color ?? "#64748b",
            }}>
              <span style={{ fontSize: 13 }}>{chip.icon}</span>
              {chip.text}
            </span>
          ))}
        </div>
      )}

      {/* ── 4 CARDS MÉTRICAS ─────────────────────────────────────────────────── */}
      <div className="d4 dc" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>

        {/* Clientes */}
        <div style={{ background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)", borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>👥 Clientes</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#00c896", lineHeight: 1, marginBottom: 6 }}>
            {stats.clientes}
          </div>
          <div style={{ fontSize: 11, color: stats.clientesMes > 0 ? "#00c896" : "#475569" }}>
            {stats.clientesMes > 0 ? `▲ +${stats.clientesMes} este mês` : "cadastrados na plataforma"}
          </div>
        </div>

        {/* Compromissos Hoje */}
        <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>📅 Compromissos Hoje</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#818cf8", lineHeight: 1, marginBottom: 6 }}>
            {stats.compromissosHoje}
          </div>
          <div style={{ fontSize: 11, color: "#475569" }}>
            {taxaHoje !== null
              ? `${taxaHoje}% confirmados`
              : "nenhum agendado"}
          </div>
        </div>

        {/* Próximos 7 dias */}
        <div style={{ background: "rgba(31,78,95,0.08)", border: "1px solid rgba(31,78,95,0.2)", borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>📆 Próximos 7 Dias</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#4a9bb0", lineHeight: 1, marginBottom: 6 }}>
            {stats.proximosSete}
          </div>
          <div style={{ fontSize: 11, color: stats.proximosSete > 0 ? "#4a9bb0" : "#475569" }}>
            {stats.proximosSete > 0 ? "compromissos programados" : "agenda livre"}
          </div>
        </div>

        {/* Pendentes */}
        <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.14)", borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>⏳ Pendentes</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: stats.pendentes > 0 ? "#fbbf24" : "#4ade80", lineHeight: 1, marginBottom: 6 }}>
            {stats.pendentes}
          </div>
          <div style={{ fontSize: 11, color: stats.pendentes > 0 ? "#f59e0b" : "#475569" }}>
            {stats.pendentes > 0 ? "aguardando confirmação" : "nenhuma pendência"}
          </div>
        </div>
      </div>

      {/* ── COMPROMISSOS DE HOJE ─────────────────────────────────────────────── */}
      <div className="dc" style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16, padding: "20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>
            Compromissos de Hoje
          </div>
          <button
            onClick={() => router.push("/agendamentos")}
            style={{ fontSize: 12, color: "#4a9bb0", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 8px" }}
          >
            Ver agenda →
          </button>
        </div>

        {agendaHoje.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "#64748b" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
            Nenhum compromisso agendado para hoje.{" "}
            <span
              style={{ color: "#4a9bb0", cursor: "pointer", fontWeight: 600 }}
              onClick={() => router.push("/agendamentos")}
            >
              Agendar agora
            </span>
          </div>
        ) : agendaHoje.map((a: AgItem, i: number) => (
          <div key={a.id} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "12px 0",
            borderBottom: i < agendaHoje.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#4a9bb0", minWidth: 50 }}>{a.hora}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{a.paciente_nome}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {a.procedimento || "Sem descrição"}{a.profissional ? " · " + a.profissional : ""}
              </div>
            </div>
            <span style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 10,
              background: stStatus[a.status]?.bg || "#1a1a2e",
              color:      stStatus[a.status]?.color || "#64748b",
              fontWeight: 600, whiteSpace: "nowrap",
            }}>
              {stStatus[a.status]?.label || a.status}
            </span>
          </div>
        ))}
      </div>

    </AdminShell>
  );
}
