"use client";
// ── AdminShellFrame — chrome persistente (Gate Funcional da Navegação V1) ──
// Causa raiz do "sidebar não permanece estável / parece reordenar ao
// navegar" (auditoria desta missão): AdminShell.tsx era instanciado DENTRO
// de cada page.tsx — cada troca de rota desmontava e remontava a barra
// lateral inteira (nenhum layout.tsx compartilhado existia). A estrutura
// em si (navGrupos, ordem, itens) sempre foi idêntica em todas as páginas
// — o problema nunca foi os DADOS reordenarem, era o React desmontar e
// remontar o DOM inteiro da sidebar a cada navegação.
//
// Correção: este componente vive em app/layout.tsx (a raiz de verdade do
// Next.js, que NUNCA desmonta entre navegações client-side) — a sidebar e
// a barra de topo são montadas UMA VEZ só. Cada página continua chamando
// <AdminShell title="..." subtitle="...">{conteúdo}</AdminShell> exatamente
// como antes (ver AdminShell.tsx) — só o título/subtítulo/ação viajam via
// Context (AdminShellContext) para esta chrome persistente atualizar,
// nunca remontando o <aside>.
import { ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AdminShellContext, type AdminShellHeader } from "./AdminShellContext";
import NegocioNaoVinculado from "./NegocioNaoVinculado";

export const navGrupos: { titulo: string; itens: { l: string; h: string; i: string }[] }[] = [
  {
    titulo: "Início",
    itens: [
      { l: "Visão Geral",   h: "/dashboard",     i: "⚡" },
      { l: "Oportunidades", h: "/oportunidades", i: "📡" },
      { l: "Dinheiro",      h: "/financeiro",    i: "💵" },
    ],
  },
  {
    titulo: "Comercial",
    itens: [
      { l: "Clientes",        h: "/clientes",        i: "👤" },
      { l: "Orçamentos",      h: "/orcamentos",       i: "💰" },
      { l: "Follow-up",       h: "/follow-up",        i: "🔁" },
      { l: "Cobranças",       h: "/cobrancas",        i: "🧾" },
      { l: "E-commerce IA",   h: "/pedidos",          i: "🛒" },
      { l: "Tratamentos",     h: "/tratamentos",      i: "🩺" },
      { l: "Receita Perdida", h: "/receita-perdida",  i: "📉" },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { l: "Agenda",          h: "/agendamentos",    i: "📅" },
      { l: "Agenda Autônoma", h: "/agenda-autonoma", i: "🔄" },
      { l: "Chatbot",         h: "/chatbot",          i: "💬" },
      { l: "Automação",       h: "/automacao",        i: "🤖" },
    ],
  },
  {
    titulo: "Presença",
    itens: [
      { l: "Google",     h: "/google-presenca", i: "📍" },
      { l: "Reputação",  h: "/reputacao",        i: "⭐" },
      { l: "Site",       h: "/site",             i: "🌍" },
      { l: "Conteúdo IA", h: "/conteudo",        i: "✍️" },
    ],
  },
  {
    titulo: "Inteligência",
    itens: [
      { l: "Copiloto",              h: "/copiloto",              i: "🧑‍💼" },
      { l: "Métricas",              h: "/metricas",              i: "📈" },
      { l: "Raio-X",                h: "/raio-x",                i: "🔍" },
      { l: "Previsor de Faturamento", h: "/previsor-faturamento", i: "🔮" },
      { l: "Linha Econômica",       h: "/linha-economica",       i: "📐" },
      { l: "Atribuição",            h: "/atribuicao",            i: "🎯" },
      { l: "Pesquisa de Preços",    h: "/pesquisa-precos",       i: "💲" },
      { l: "NotaFácil",             h: "/notafacil",             i: "📄" },
      { l: "Fechamento Contábil",   h: "/fechamento-contabil",   i: "🧮" },
    ],
  },
];

// Rotas que recebem a chrome persistente — derivado de navGrupos (única
// fonte de verdade, nunca duplicada) + Configurações (fora dos grupos,
// mesmo padrão de sempre) + dashboard-demo (ferramenta interna de
// demonstração, não fica no menu, mas usa o mesmo AdminShell/chrome).
export const ROTAS_COM_SHELL: readonly string[] = [
  ...navGrupos.flatMap((g) => g.itens.map((i) => i.h)),
  "/configuracoes",
  "/dashboard-demo",
];

const DEFAULT_HEADER: AdminShellHeader = { title: "" };

export default function AdminShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [header, setHeaderState] = useState<AdminShellHeader>(DEFAULT_HEADER);

  // ── P1.1: Fechar a Casa — causa raiz do vínculo negócio/usuário ────────
  // Verificado UMA vez aqui (chrome persistente, nunca desmonta entre
  // navegações) em vez de cada page.tsx repetir a mesma checagem e
  // degradar de um jeito diferente (branco, lista vazia, texto de erro
  // sem ação) — mesmo /api/minha-clinica que todas as páginas já usam,
  // nenhuma consulta nova. "sem_sessao" e erros ambíguos nunca bloqueiam
  // — cada página continua responsável pelo próprio redirect de login,
  // exatamente como antes; só um 404 confirmado (usuário autenticado,
  // sem vínculo real) troca o conteúdo pela tela de provisionamento.
  const [semVinculo, setSemVinculo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || cancelado) return;
      const res = await fetch("/api/minha-clinica", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!cancelado) setSemVinculo(res.status === 404);
    })();
    return () => { cancelado = true; };
  }, []);

  // Defesa em profundidade contra o loop de render corrigido em
  // AdminShell.tsx: descarta a atualização quando o conteúdo é idêntico
  // ao já exibido — devolver a MESMA referência de estado faz o React
  // pular o re-render (nunca dispara os efeitos das páginas de novo).
  const setHeader = useCallback((novo: AdminShellHeader) => {
    setHeaderState((atual) =>
      atual.title === novo.title && atual.subtitle === novo.subtitle
        && atual.actionLabel === novo.actionLabel && atual.actionOnClick === novo.actionOnClick
        ? atual
        : novo
    );
  }, []);

  const navigate = (path: string) => {
    router.push(path);
    setSidebarOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <AdminShellContext.Provider value={{ setHeader }}>
      <div
        className="ash-root"
        style={{ display: "flex", minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "Inter, sans-serif" }}
      >
        <style>{`
          /* ── Desktop default ── */
          .ash-sidebar {
            width: 220px;
            flex-shrink: 0;
            background: #0a0d14;
            border-right: 1px solid #1e2130;
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            z-index: 50;
            transform: translateX(0);
            transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: none;
          }
          .ash-main {
            margin-left: 220px;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            overflow-x: hidden;
          }
          .ash-header {
            padding: 20px 32px;
          }
          .ash-content {
            flex: 1;
            padding: 28px 32px;
            overflow-y: auto;
            overflow-x: hidden;
          }
          .ash-hamburger { display: none; }
          .ash-close-btn { display: none; }
          .ash-action-btn { transition: filter 0.15s; }
          .ash-action-btn:hover { filter: brightness(1.12); }
          .ash-backdrop {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(2px);
            z-index: 49;
          }

          /* ── Mobile ── */
          @media (max-width: 767px) {
            .ash-sidebar {
              transform: translateX(-100%);
              box-shadow: none;
            }
            .ash-sidebar.open {
              transform: translateX(0);
              box-shadow: 4px 0 24px rgba(0, 0, 0, 0.45);
            }
            .ash-main {
              margin-left: 0;
              max-width: 100vw;
            }
            .ash-header {
              padding: 14px 16px;
            }
            .ash-content {
              padding: 16px;
            }
            .ash-hamburger {
              display: flex !important;
              align-items: center;
              justify-content: center;
            }
            .ash-close-btn {
              display: flex !important;
            }
            .ash-sidebar.open ~ .ash-backdrop,
            .ash-backdrop.open {
              display: block;
            }
          }
        `}</style>

        {/* BACKDROP */}
        <div
          className={`ash-backdrop${sidebarOpen ? " open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* SIDEBAR — montada uma única vez; nunca desmonta ao navegar. */}
        <aside className={`ash-sidebar${sidebarOpen ? " open" : ""}`}>

          {/* Logo + close button */}
          <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #1e2130", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#1F4E5F,#0d3547)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                📋
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2 }}>OrganizaPro</div>
                <div style={{ fontSize: 10, color: "#4a9bb0", lineHeight: 1.35, marginTop: 2, maxWidth: 138, textWrap: "balance" as React.CSSProperties["textWrap"] }}>Organize sua empresa com inteligência.</div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 4, letterSpacing: "0.02em" }}>✨ Assistente de Gestão</div>
              </div>
            </div>

            <button
              className="ash-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
              style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", padding: "4px 6px", lineHeight: 1, borderRadius: 6 }}
            >
              ✕
            </button>
          </div>

          {/* Nav — agrupada por área (Início/Comercial/Operação/Presença/
              Inteligência), uma única barra lateral (nunca duas), mesmo
              comportamento de drawer em mobile já existente abaixo. */}
          <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            {navGrupos.map((grupo) => (
              <div key={grupo.titulo}>
                <div style={{ padding: "0 12px 6px", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3d4360" }}>
                  {grupo.titulo}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {grupo.itens.map((item) => {
                    const active = pathname === item.h || pathname.startsWith(item.h + "/");
                    return (
                      <div
                        key={`${grupo.titulo}-${item.h}-${item.l}`}
                        onClick={() => navigate(item.h)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 12px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: active ? 600 : 400,
                          color: active ? "#f1f5f9" : "#64748b",
                          background: active ? "rgba(31,78,95,0.25)" : "transparent",
                          borderLeft: active ? "2px solid #1F4E5F" : "2px solid transparent",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          userSelect: "none",
                        }}
                        onMouseEnter={e => {
                          if (!active) {
                            (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                            (e.currentTarget as HTMLDivElement).style.color = "#94a3b8";
                          }
                        }}
                        onMouseLeave={e => {
                          if (!active) {
                            (e.currentTarget as HTMLDivElement).style.background = "transparent";
                            (e.currentTarget as HTMLDivElement).style.color = "#64748b";
                          }
                        }}
                      >
                        <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{item.i}</span>
                        {item.l}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Configurações + Logout */}
          <div style={{ padding: "12px 10px 16px", borderTop: "1px solid #1e2130", display: "flex", flexDirection: "column", gap: 4 }}>
            {(() => {
              const active = pathname === "/configuracoes" || pathname.startsWith("/configuracoes/");
              return (
                <div
                  onClick={() => navigate("/configuracoes")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 8, fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#f1f5f9" : "#64748b",
                    background: active ? "rgba(31,78,95,0.25)" : "transparent",
                    borderLeft: active ? "2px solid #1F4E5F" : "2px solid transparent",
                    cursor: "pointer", userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>⚙️</span>
                  Configurações
                </div>
              );
            })()}
            <button
              onClick={handleSignOut}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #1e2130", background: "transparent", color: "#64748b", fontSize: 13, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.08)";
                (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.2)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e2130";
              }}
            >
              <span style={{ fontSize: 15 }}>→</span>
              Sair
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="ash-main">

          {/* TOP BAR — título/subtítulo/ação vêm do Context, atualizados
              pela página atual via AdminShell.tsx (shim), sem remontar
              nada aqui. */}
          <header
            className="ash-header"
            style={{
              borderBottom: "1px solid #1e2130",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "#0a0d14",
              position: "sticky",
              top: 0,
              zIndex: 40,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>

              {/* Hamburger — visible only on mobile via CSS */}
              <button
                className="ash-hamburger"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
                style={{
                  display: "none",
                  background: "none",
                  border: "1px solid #1e2130",
                  borderRadius: 8,
                  color: "#94a3b8",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: "6px 10px",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ☰
              </button>

              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {header.title}
                </h1>
                {header.subtitle && (
                  <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {header.subtitle}
                  </p>
                )}
              </div>
            </div>

            {header.actionLabel && header.actionOnClick && (
              <button
                className="ash-action-btn"
                onClick={header.actionOnClick}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg,#1F4E5F,#0d3547)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {header.actionLabel}
              </button>
            )}
          </header>

          {/* CONTENT — troca a cada navegação; a sidebar acima, não. */}
          <main className="ash-content">
            {semVinculo
              ? <NegocioNaoVinculado onProvisionado={() => setSemVinculo(false)} />
              : children}
          </main>
        </div>
      </div>
    </AdminShellContext.Provider>
  );
}
