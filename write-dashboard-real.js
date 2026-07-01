const fs = require('fs');
const code = `"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const router = useRouter();
  const [totalAgendamentos, setTotalAgendamentos] = useState(0);
  const [totalPacientes, setTotalPacientes] = useState(0);
  const [agendaHoje, setAgendaHoje] = useState<any[]>([]);

  const hoje = new Date().toISOString().split("T")[0];

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const [{ count: ca }, { count: cp }, { data: ag }] = await Promise.all([
      supabase.from("agendamentos").select("*", { count: "exact", head: true }),
      supabase.from("pacientes").select("*", { count: "exact", head: true }),
      supabase.from("agendamentos").select("*").eq("data", hoje).order("hora"),
    ]);
    setTotalAgendamentos(ca || 0);
    setTotalPacientes(cp || 0);
    setAgendaHoje(ag || []);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const st: any = {
    confirmado: { bg: "#dcfce7", color: "#166534", label: "Confirmado" },
    aguardando: { bg: "#fef9c3", color: "#854d0e", label: "Aguardando" },
    novo: { bg: "#dbeafe", color: "#1e40af", label: "Novo" },
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f8fafc", fontFamily: "Inter,sans-serif" }}>
      <aside style={{ width: 220, minWidth: 220, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", padding: "20px 0" }}>
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid #e2e8f0", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>BOLÃO SHORTS AI</span>
            <span style={{ fontSize: 10, background: "#ede9fe", color: "#7c3aed", padding: "2px 7px", borderRadius: 6, fontWeight: 600 }}>Beta</span>
          </div>
        </div>
        {[{ l: "Dashboard", h: "/" }, { l: "Agenda", h: "/agendamentos" }, { l: "Pacientes", h: "/pacientes" }, { l: "Automacoes", h: "/automacao" }].map(item => (
          <div key={item.h} onClick={() => router.push(item.h)} style={{ padding: "8px 20px", fontSize: 13, cursor: "pointer", color: item.h === "/" ? "#7c3aed" : "#475569", background: item.h === "/" ? "#f5f3ff" : "transparent", fontWeight: item.h === "/" ? 600 : 400, borderRight: item.h === "/" ? "3px solid #7c3aed" : "3px solid transparent" }}>
            {item.l}
          </div>
        ))}
        <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>BOLÃO SHORTS AI</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Administrador</div>
          <button onClick={logout} style={{ marginTop: 8, width: "100%", padding: "6px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff5f5", fontSize: 11, color: "#ef4444", cursor: "pointer", fontWeight: 600 }}>Sair</button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: 0 }}>Bom dia, BOLÃO SHORTS AI 👋</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Consultas hoje", value: agendaHoje.length, sub: "agendamentos para hoje" },
            { label: "Total agendamentos", value: totalAgendamentos, sub: "no banco de dados" },
            { label: "Total pacientes", value: totalPacientes, sub: "cadastrados" },
          ].map((card, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{card.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1e293b" }}>{card.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{card.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 16 }}>Agenda de hoje — {agendaHoje.length} consultas</div>
          {agendaHoje.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Nenhuma consulta hoje. Acesse a Agenda para adicionar!</div>
          ) : agendaHoje.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < agendaHoje.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", minWidth: 50 }}>{a.hora}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{a.paciente_nome}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{a.procedimento}{a.profissional ? " - " + a.profissional : ""}</div>
              </div>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, background: st[a.status]?.bg || "#f1f5f9", color: st[a.status]?.color || "#64748b", fontWeight: 600 }}>{st[a.status]?.label || a.status}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}`;
fs.writeFileSync('app/page.tsx', code, 'utf8');
console.log('Dashboard com dados reais!');
