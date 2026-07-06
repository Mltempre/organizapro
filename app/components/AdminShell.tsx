"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const nav = [
  { l: "Dashboard",      h: "/dashboard",     i: "⚡" },
  { l: "Clientes",       h: "/pacientes",     i: "👤" },
  { l: "Agenda",         h: "/agendamentos",  i: "📅" },
  { l: "Raio-X",         h: "/raio-x",        i: "📊" },
  { l: "Configurações",  h: "/configuracoes", i: "⚙️" },
];

interface AdminShellProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionOnClick?: () => void;
  children: ReactNode;
}

export default function AdminShell({
  title,
  subtitle,
  actionLabel,
  actionOnClick,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const navigate = (path: string) => {
    router.push(path);
    setSidebarOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
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

      {/* SIDEBAR */}
      <aside className={`ash-sidebar${sidebarOpen ? " open" : ""}`}>

        {/* Logo + close button */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #1e2130", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#1F4E5F,#0d3547)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              📋
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>OrganizaPro</div>
              <div style={{ fontSize: 10, color: "#4a9bb0", lineHeight: 1.35 }}>Organize sua empresa com inteligência.</div>
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

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map((item) => {
            const active = pathname === item.h;
            return (
              <div
                key={item.h}
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
        </nav>

        {/* Logout */}
        <div style={{ padding: "16px 10px", borderTop: "1px solid #1e2130" }}>
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

        {/* TOP BAR */}
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
                {title}
              </h1>
              {subtitle && (
                <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actionLabel && actionOnClick && (
            <button
              onClick={actionOnClick}
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
              {actionLabel}
            </button>
          )}
        </header>

        {/* CONTENT */}
        <main className="ash-content">
          {children}
        </main>
      </div>
    </div>
  );
}
