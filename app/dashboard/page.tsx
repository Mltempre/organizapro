"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";
import { nivelAtual, proximoObjetivo } from "../../lib/raio-x";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgItem = any;

type DashStats = {
  pacientes:     number;
  pacientesMes:  number;
  consultasHoje: number;
  agSemana:      number;
  agTotal:       number;
  avaliacoes:    number;
  confirmadas:   number;
  pendentes:     number;
};

type RaioXSnap = {
  indice:          number;
  ai_diagnostico:  string;
  ai_missao:       string;
  ai_oportunidade: string;
};

// ── Cache localStorage (30 min) — evita chamar OpenAI em cada acesso ─────────
const RX_KEY = "rx_snap_v2";
const RX_TTL = 30 * 60 * 1000;

function getRxCache(): RaioXSnap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RX_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: RaioXSnap; ts: number };
    if (Date.now() - ts > RX_TTL) { localStorage.removeItem(RX_KEY); return null; }
    return data;
  } catch { return null; }
}

function setRxCache(d: RaioXSnap) {
  try { localStorage.setItem(RX_KEY, JSON.stringify({ data: d, ts: Date.now() })); } catch { /* */ }
}

// ── Hora de Brasília ──────────────────────────────────────────────────────────
function saudacao(): string {
  const h = parseInt(
    new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" })
  );
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

// ── Prioridade sem Raio-X (instantânea) ──────────────────────────────────────
function prioridadeLocal(s: DashStats): string {
  if (s.pendentes > 0)
    return `Confirmar ${s.pendentes} consulta(s) pendente(s) na agenda de hoje`;
  if (s.avaliacoes === 0)
    return "Solicitar avaliação Google ao próximo paciente atendido";
  return "Completar informações do site para fortalecer sua presença digital";
}

export default function Dashboard() {
  const router = useRouter();
  const [loading,   setLoading]   = useState(true);
  const [rxLoading, setRxLoading] = useState(true);
  const [stats, setStats] = useState<DashStats>({
    pacientes: 0, pacientesMes: 0, consultasHoje: 0,
    agSemana: 0, agTotal: 0, avaliacoes: 0, confirmadas: 0, pendentes: 0,
  });
  const [agendaHoje, setAgendaHoje] = useState<AgItem[]>([]);
  const [raioX, setRaioX] = useState<RaioXSnap | null>(null);

  // ── Carga principal — rápida, sem OpenAI ─────────────────────────────────
  const carregarPrincipal = useCallback(async () => {
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
      const inicioSemana = new Date(Date.UTC(ano, mes - 1, dia - 6)).toISOString().split("T")[0];
      const inicioMes    = `${ano}-${String(mes).padStart(2, "0")}-01`;

      const [
        { count: totalPacientes },
        { count: pacMes },
        { data: agHoje },
        { count: totalAg },
        { count: agSemana },
        { count: totalAval },
      ] = await Promise.all([
        supabase.from("pacientes").select("*", { count: "exact", head: true }).eq("clinica_id", cid),
        supabase.from("pacientes").select("*", { count: "exact", head: true }).eq("clinica_id", cid).gte("created_at", inicioMes),
        supabase.from("agendamentos").select("*").eq("clinica_id", cid).eq("data", hoje).order("hora"),
        supabase.from("agendamentos").select("*", { count: "exact", head: true }).eq("clinica_id", cid),
        supabase.from("agendamentos").select("*", { count: "exact", head: true }).eq("clinica_id", cid).gte("data", inicioSemana).lte("data", hoje),
        supabase.from("avaliacoes").select("*", { count: "exact", head: true }).eq("clinica_id", cid).eq("respondeu", true),
      ]);

      const lista       = agHoje || [];
      const confirmadas = lista.filter((a: AgItem) => ["confirmado","concluido"].includes(a.status)).length;
      const pendentes   = lista.filter((a: AgItem) => a.status === "agendado").length;
      const ativos      = lista.filter((a: AgItem) => !["cancelado","faltou"].includes(a.status));

      setStats({
        pacientes:    totalPacientes || 0,
        pacientesMes: pacMes        || 0,
        consultasHoje: ativos.length,
        agSemana:     agSemana      || 0,
        agTotal:      totalAg       || 0,
        avaliacoes:   totalAval     || 0,
        confirmadas,
        pendentes,
      });
      setAgendaHoje(lista);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // ── Carga Raio-X — background, com cache ────────────────────────────────────
  const carregarRaioX = useCallback(async () => {
    const cached = getRxCache();
    if (cached) { setRaioX(cached); setRxLoading(false); return; }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/raio-x", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const d = await res.json();
      const snap: RaioXSnap = {
        indice:          d.indice,
        ai_diagnostico:  d.ai_diagnostico,
        ai_missao:       d.ai_missao,
        ai_oportunidade: d.ai_oportunidade,
      };
      setRxCache(snap);
      setRaioX(snap);
    } catch (err) {
      console.error(err);
    } finally {
      setRxLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarPrincipal();
    carregarRaioX();
  }, [carregarPrincipal, carregarRaioX]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const hoje = new Date();
  const diasSemana = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = `${diasSemana[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]}`;

  const nivel   = raioX ? nivelAtual(raioX.indice)     : null;
  const proximo = raioX ? proximoObjetivo(raioX.indice) : null;
  const prioridade = raioX?.ai_missao ?? prioridadeLocal(stats);

  const taxaHoje = stats.consultasHoje > 0
    ? Math.round((stats.confirmadas / stats.consultasHoje) * 100) : null;

  // Chips do Resumo Executivo
  const chips: Array<{ icon: string; text: string; color?: string }> = [
    {
      icon: "📅",
      text: stats.consultasHoje === 0
        ? "Nenhuma consulta hoje"
        : `${stats.consultasHoje} consulta(s) hoje`,
    },
    ...(taxaHoje !== null
      ? [{ icon: "✅", text: `${taxaHoje}% confirmadas` }]
      : []),
    ...(stats.pendentes > 0
      ? [{ icon: "⚠", text: `${stats.pendentes} aguardando confirmação`, color: "#f59e0b" }]
      : []),
    ...(nivel ? [{ icon: nivel.emoji, text: nivel.label }] : []),
    ...(stats.pendentes === 0 && stats.consultasHoje > 0
      ? [{ icon: "✓", text: "Nenhuma pendência crítica" }]
      : []),
  ];

  const stStatus: Record<string, { bg: string; color: string; label: string }> = {
    confirmado: { bg: "#00FF8722", color: "#00FF87", label: "Confirmado" },
    agendado:   { bg: "#00C6FF22", color: "#00C6FF", label: "Agendado"   },
    concluido:  { bg: "#7c3aed22", color: "#a78bfa", label: "Concluído"  },
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
      subtitle={`${dataStr} · ${stats.consultasHoje} consultas hoje`}
      actionLabel="+ Nova Consulta"
      actionOnClick={() => router.push("/agendamentos")}
    >
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { to{ background-position: 200% center } }
        .dc { animation: fadeUp 0.4s ease both; }
        .rx-sk {
          background: linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite;
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 20px;
        }
        @media (max-width: 900px) {
          .d4 { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 500px) {
          .d4 { grid-template-columns: 1fr !important; }
          .hero-inner { flex-direction: column !important; }
          .hero-cta { align-self: stretch !important; min-width: unset !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════════════════════
          5. SAUDAÇÃO PREMIUM
          ════════════════════════════════════════════════════════ */}
      <div className="dc" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 2px" }}>
            👋 {saudacao()}!
          </p>
          <div style={{ fontSize: 16, fontWeight: 400, color: "#7c3aed", margin: "0 0 3px", letterSpacing: 0.2, lineHeight: 1.3 }}>
            <span style={{ fontWeight: 800, fontSize: 17 }}>ClínicaFlow</span>
            {" "}
            <span style={{ color: "#475569", fontWeight: 400 }}>• Painel Executivo</span>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
            {stats.consultasHoje === 0
              ? `${dataStr} • Nenhuma consulta agendada para hoje.`
              : `${dataStr} • Sua clínica possui ${stats.consultasHoje} consulta${stats.consultasHoje > 1 ? "s" : ""} agendada${stats.consultasHoje > 1 ? "s" : ""} para hoje.`}
          </p>
        </div>

        {/* 7. Botão Raio-X (substitui o 2º "Nova Consulta") */}
        <button
          onClick={() => router.push("/raio-x")}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 10,
            border: "1px solid rgba(124,58,237,0.3)",
            background: "rgba(124,58,237,0.08)",
            color: "#c4b5fd", fontSize: 13, fontWeight: 600, cursor: "pointer",
            flexShrink: 0,
          }}
        >
          📊 Diagnóstico
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
          1. HERO EXECUTIVO — Índice ClínicaFlow
          ════════════════════════════════════════════════════════ */}
      {rxLoading ? (
        <div className="rx-sk dc" style={{ height: 168, marginBottom: 20 }} />
      ) : raioX && nivel ? (
        <div
          className="dc hero-inner"
          style={{
            display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
            background: `linear-gradient(135deg, rgba(124,58,237,0.07), ${nivel.color}0a)`,
            border: `1px solid ${nivel.color}28`,
            borderRadius: 20, padding: "26px 28px", marginBottom: 20,
          }}
        >
          {/* Score */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              Índice ClínicaFlow
            </div>
            <div style={{ fontSize: 68, fontWeight: 900, color: nivel.color, lineHeight: 1, letterSpacing: -4 }}>
              {raioX.indice}
            </div>
            <div style={{ fontSize: 13, color: "#334155", marginTop: 2 }}>/100</div>
          </div>

          {/* Diagnóstico */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10,
              background: `${nivel.color}18`, border: `1px solid ${nivel.color}2e`,
              borderRadius: 100, padding: "5px 14px",
            }}>
              <span style={{ fontSize: 14 }}>{nivel.emoji}</span>
              <span style={{ color: nivel.color, fontSize: 13, fontWeight: 700 }}>{nivel.label}</span>
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.75, margin: "0 0 8px" }}>
              {raioX.ai_diagnostico.length > 200
                ? raioX.ai_diagnostico.slice(0, 200) + "..."
                : raioX.ai_diagnostico}
            </p>
            {proximo && (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Faltam{" "}
                <span style={{ color: proximo.nivel.color, fontWeight: 700 }}>
                  {proximo.pontosRestantes} ponto(s)
                </span>{" "}
                para{" "}
                <span style={{ color: proximo.nivel.color }}>
                  {proximo.nivel.emoji} {proximo.nivel.label}
                </span>
              </div>
            )}
          </div>

          {/* Barra + CTA */}
          <div className="hero-cta" style={{ display: "flex", flexDirection: "column", gap: 12, flexShrink: 0, minWidth: 160 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#475569" }}>Índice ClínicaFlow</span>
                <span style={{ fontSize: 11, color: nivel.color, fontWeight: 700 }}>{raioX.indice}/100</span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 100, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${raioX.indice}%`, background: nivel.color, borderRadius: 100, transition: "width 1s ease" }} />
              </div>
            </div>
            <button
              onClick={() => router.push("/raio-x")}
              style={{
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: `linear-gradient(135deg,${nivel.color}bb,${nivel.color})`,
                color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              📊 Ver Diagnóstico Completo
            </button>
          </div>
        </div>
      ) : null}

      {/* ════════════════════════════════════════════════════════
          2. PRIORIDADE DO DIA (full-width)
          ════════════════════════════════════════════════════════ */}
      <div className="dc" style={{
        background: "linear-gradient(135deg,rgba(124,58,237,0.09),rgba(192,132,252,0.04))",
        border: "1px solid rgba(124,58,237,0.22)",
        borderRadius: 16, padding: "18px 22px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: "rgba(124,58,237,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>🎯</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>
            Prioridade do Dia
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.6 }}>
            {prioridade}
          </div>
          {rxLoading && (
            <div style={{ fontSize: 11, color: "#334155", marginTop: 5 }}>Consultoria IA carregando...</div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          3. RESUMO EXECUTIVO — chips com emojis
          ════════════════════════════════════════════════════════ */}
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

      {/* ════════════════════════════════════════════════════════
          4. CARDS INTELIGENTES
          ════════════════════════════════════════════════════════ */}
      <div className="d4 dc" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>

        {/* Pacientes */}
        <div style={{ background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)", borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>👥 Pacientes Ativos</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#00c896", lineHeight: 1, marginBottom: 6 }}>
            {stats.pacientes}
          </div>
          <div style={{ fontSize: 11, color: stats.pacientesMes > 0 ? "#00c896" : "#334155" }}>
            {stats.pacientesMes > 0 ? `▲ +${stats.pacientesMes} este mês` : "cadastrados na plataforma"}
          </div>
        </div>

        {/* Consultas hoje */}
        <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>📅 Consultas Hoje</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#818cf8", lineHeight: 1, marginBottom: 6 }}>
            {stats.consultasHoje}
          </div>
          <div style={{ fontSize: 11, color: "#334155" }}>
            {taxaHoje !== null
              ? `${taxaHoje}% confirmadas hoje${stats.pendentes > 0 ? ` · ${stats.pendentes} pendente(s)` : ""}`
              : "nenhuma confirmação"}
          </div>
        </div>

        {/* Agendamentos */}
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.14)", borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>✅ Agendamentos</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#60a5fa", lineHeight: 1, marginBottom: 6 }}>
            {stats.agTotal}
          </div>
          <div style={{ fontSize: 11, color: stats.agSemana > 0 ? "#60a5fa" : "#334155" }}>
            {stats.agSemana > 0 ? `+${stats.agSemana} nesta semana` : "nenhum esta semana"}
          </div>
        </div>

        {/* Avaliações */}
        <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.14)", borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>⭐ Avaliações</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#fbbf24", lineHeight: 1, marginBottom: 6 }}>
            {stats.avaliacoes}
          </div>
          <div style={{ fontSize: 11, color: "#334155" }}>
            {stats.avaliacoes === 0 ? "primeira oportunidade disponível" : "recebidas no sistema"}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          6. OPORTUNIDADE DO DIA (full-width abaixo dos cards)
          ════════════════════════════════════════════════════════ */}
      {rxLoading ? (
        <div className="rx-sk dc" style={{ height: 80, marginBottom: 20, borderRadius: 14 }} />
      ) : raioX ? (
        <div className="dc" style={{
          background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.14)",
          borderRadius: 14, padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "flex-start", gap: 14,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>💡</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>
              Oportunidade do Dia
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
              {raioX.ai_oportunidade.length > 200
                ? raioX.ai_oportunidade.slice(0, 200) + "..."
                : raioX.ai_oportunidade}
            </div>
          </div>
        </div>
      ) : null}

      {/* ════════════════════════════════════════════════════════
          AGENDA DE HOJE
          ════════════════════════════════════════════════════════ */}
      <div className="dc" style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16, padding: "20px 20px",
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#f1f5f9" }}>
          Agenda de Hoje
        </div>
        {agendaHoje.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "#64748b" }}>
            Nenhuma consulta agendada.{" "}
            <span
              style={{ color: "#7c3aed", cursor: "pointer", fontWeight: 600 }}
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
            <span style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed", minWidth: 50 }}>{a.hora}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.paciente_nome}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {a.procedimento}{a.profissional ? " · " + a.profissional : ""}
              </div>
            </div>
            <span style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 10,
              background: stStatus[a.status]?.bg || "#1a1a2e",
              color:      stStatus[a.status]?.color || "#64748b",
              fontWeight: 600,
            }}>
              {stStatus[a.status]?.label || a.status}
            </span>
          </div>
        ))}
      </div>

    </AdminShell>
  );
}
