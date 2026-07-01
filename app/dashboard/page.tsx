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
};

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

    </AdminShell>
  );
}
