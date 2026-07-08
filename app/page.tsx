"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

// ── Landing Page Premium 2.0 ─────────────────────────────────────────────
//
// Reposicionamento: o OrganizaPro deixa de ser vendido como "sistema de
// gestão" e passa a ser vendido como o primeiro Diretor Digital para
// pequenas empresas de serviços (docs/organizapro-intelligence-engine-
// v1.html). A ordem das seções é deliberada: transformação e narrativa
// primeiro, lista de módulos só depois de o visitante entender o conceito.
//
// Paleta e tipografia reaproveitam o tema escuro real do produto logado
// (AdminShell/Dashboard: bg #0f1117, acento #1F4E5F/#0d3547, fonte Inter),
// não os tokens legados de app/globals.css — a continuidade visual deve
// ser com o Dashboard que o cliente vê todo dia, não com um tema não usado.

export default function Page() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const wpp = (msg = "Quero um Diretor Digital cuidando do meu negócio") =>
    window.open(`https://wa.me/5541988379119?text=${encodeURIComponent(msg)}`, "_blank");

  const NAV_LINKS: [string, string][] = [
    ["Como funciona", "#como-funciona"],
    ["O que ele faz",  "#modulos"      ],
    ["Para quem",      "#para-quem"    ],
    ["Investimento",   "#oferta"       ],
  ];

  const MOMENTOS = [
    { icone: "🌅", titulo: "Abertura do sistema",      desc: "Antes de você abrir o dia, ele já revisou tudo — o resumo já está pronto." },
    { icone: "🕐", titulo: "Durante o expediente",       desc: "Observa sua agenda em tempo real e avisa antes de um atraso virar um cliente perdido." },
    { icone: "💬", titulo: "Em segundo plano",           desc: "Acompanha WhatsApp e site enquanto você está ocupado atendendo." },
    { icone: "🔕", titulo: "Quando você está ausente",   desc: "Percebe uma avaliação sem resposta, um cliente que sumiu, um horário livre." },
    { icone: "🌙", titulo: "Durante a noite",            desc: "Consolida o dia que passou e já deixa amanhã organizado." },
  ];

  const MODULOS = [
    { icon: "👥", papel: "Conhece cada cliente",          titulo: "Gestão de Clientes",  desc: "Histórico, contato e observações sempre à mão — nenhum relacionamento esfria por falta de memória." },
    { icon: "📅", papel: "Vigia sua rotina",               titulo: "Agenda",              desc: "Atrasos e confirmações pendentes tratados antes de virarem prejuízo." },
    { icon: "🎯", papel: "Decide a prioridade do dia",     titulo: "Dashboard",           desc: "A cada manhã, escolhe uma única ação mais importante — e diz por quê. Já em produção." },
    { icon: "🌐", papel: "Mantém sua vitrine pronta",      titulo: "Site Profissional",   desc: "Presença profissional sempre no ar, sem esforço nenhum da sua parte." },
    { icon: "⭐", papel: "Protege sua imagem",             titulo: "Gestão da Reputação", desc: "Avaliações acompanhadas e respondidas a tempo, antes de virarem um problema público." },
    { icon: "✍️", papel: "Mantém sua presença viva",       titulo: "Conteúdo IA",         desc: "Conteúdo pronto para suas redes sociais, sem você precisar sentar para criar." },
  ];

  const AUDIENCE = [
    { icon: "⚖️", label: "Advogados"               },
    { icon: "🧠", label: "Psicólogos"              },
    { icon: "🦴", label: "Fisioterapeutas"         },
    { icon: "✂️", label: "Barbearias"              },
    { icon: "💅", label: "Estéticas"               },
    { icon: "💼", label: "Consultores"             },
    { icon: "🔧", label: "Prestadores de serviço"  },
  ];

  return (
    <div style={{ fontFamily: "Inter, -apple-system, sans-serif", background: "#0f1117", color: "#e2e8f0", overflowX: "hidden", maxWidth: "100vw" }}>

      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        .btn-main {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: linear-gradient(135deg,#1F4E5F,#0d3547); color: #fff; border: none; border-radius: 10px;
          font-family: inherit; font-size: 16px; font-weight: 700; padding: 16px 32px;
          cursor: pointer; transition: all 0.22s; box-shadow: 0 4px 20px rgba(31,78,95,0.4);
          text-decoration: none; white-space: nowrap; line-height: 1;
        }
        .btn-main:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(31,78,95,0.55); }

        .btn-outline {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: transparent; color: rgba(255,255,255,0.8);
          border: 1px solid rgba(255,255,255,0.18); border-radius: 10px;
          font-family: inherit; font-size: 15px; font-weight: 600; padding: 14px 28px;
          cursor: pointer; transition: all 0.22s; text-decoration: none; white-space: nowrap; line-height: 1;
        }
        .btn-outline:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.35); color: #fff; }

        .card-soft {
          background: rgba(255,255,255,0.03); border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          transition: border-color 0.22s, transform 0.22s;
        }
        .card-soft:hover { border-color: rgba(74,155,176,0.4); transform: translateY(-3px); }

        .section-tag {
          display: inline-block; background: rgba(74,155,176,0.12); color: #4a9bb0;
          font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
          text-transform: uppercase; padding: 5px 14px; border-radius: 999px; margin-bottom: 14px;
        }

        .momento-connector {
          position: absolute; top: 27px; left: calc(50% + 42px);
          width: calc(100% - 84px); height: 2px; background: rgba(255,255,255,0.08);
          pointer-events: none;
        }
      `}</style>

      {/* ── NAV ────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 16px" : "0 40px", height: 64,
        background: scrolled ? "rgba(15,17,23,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        boxShadow: scrolled ? "0 1px 20px rgba(0,0,0,0.3)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>👔</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9" }}>OrganizaPro</span>
        </div>

        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {NAV_LINKS.map(([label, href]) => (
              <a key={href} href={href}
                style={{ fontSize: 14, color: "#e2e8f0", textDecoration: "none", fontWeight: 500, opacity: 0.7, transition: "opacity 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
              >{label}</a>
            ))}
          </div>
        )}

        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/login" style={{ fontSize: 14, color: "#94a3b8", textDecoration: "none", fontWeight: 500 }}>Entrar</Link>
            <button className="btn-main" style={{ padding: "10px 20px", fontSize: 14 }} onClick={() => wpp()}>
              💬 Falar agora
            </button>
          </div>
        )}

        {isMobile && (
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ display: "block", width: 22, height: 2, background: "#e2e8f0", borderRadius: 2, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
            <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? "transparent" : "#e2e8f0", borderRadius: 2, transition: "all 0.2s" }} />
            <span style={{ display: "block", width: 22, height: 2, background: "#e2e8f0", borderRadius: 2, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
          </button>
        )}
      </nav>

      {/* ── MOBILE MENU ────────────────────────────────────────────── */}
      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, top: 64, background: "rgba(15,17,23,0.98)", zIndex: 99, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 }}>
          {NAV_LINKS.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}
              style={{ fontSize: 22, color: "#e2e8f0", textDecoration: "none", fontWeight: 600 }}
            >{label}</a>
          ))}
          <button className="btn-main" style={{ fontSize: 16 }} onClick={() => { setMenuOpen(false); wpp(); }}>
            💬 Falar agora
          </button>
          <Link href="/login" onClick={() => setMenuOpen(false)}
            style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
            Já sou cliente → Entrar
          </Link>
        </div>
      )}

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section style={{
        background: "radial-gradient(ellipse at top, rgba(31,78,95,0.35), #0f1117 65%)",
        padding: isMobile ? "104px 20px 72px" : "140px 40px 100px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(74,155,176,0.12)", border: "1px solid rgba(74,155,176,0.3)",
            borderRadius: 999, padding: "6px 18px", marginBottom: 28,
            fontSize: 13, color: "#4a9bb0", fontWeight: 700,
          }}>
            👔 Não é mais um sistema. É um Diretor Digital.
          </div>

          <h1 style={{
            fontSize: isMobile ? 32 : 54, fontWeight: 900, color: "#f8fafc",
            lineHeight: 1.12, margin: "0 0 22px", letterSpacing: "-0.5px",
          }}>
            O OrganizaPro cuida do seu negócio{" "}
            <span style={{ color: "#4a9bb0" }}>enquanto você cuida dos seus clientes.</span>
          </h1>

          <p style={{
            fontSize: isMobile ? 16 : 19, color: "#94a3b8",
            margin: "0 auto 40px", lineHeight: 1.75, maxWidth: 580,
          }}>
            Ele observa sua agenda, seus clientes e sua reputação — e decide, todos os dias,
            qual é a ação mais importante agora. Você só precisa executar.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-main" style={{ fontSize: isMobile ? 15 : 17, padding: isMobile ? "14px 24px" : "17px 36px" }}
              onClick={() => wpp()}>
              Quero um Diretor Digital no meu negócio
            </button>
            <a href="#como-funciona" className="btn-outline"
              style={{ fontSize: isMobile ? 14 : 15, padding: isMobile ? "13px 22px" : "15px 28px" }}>
              Ver como ele trabalha ↓
            </a>
          </div>

          <p style={{ marginTop: 20, fontSize: 13, color: "#64748b" }}>
            Já em produção: Agenda · Clientes · Dashboard · Site · Reputação · Conteúdo IA
          </p>
        </div>
      </section>

      {/* ── CENA DO DIA A DIA ──────────────────────────────────────── */}
      <section id="cena" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0f1117" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Antes de tudo</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Um chatbot pergunta.<br />O Diretor Digital já resolveu.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18, alignItems: "stretch" }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: isMobile ? "22px 20px" : "28px 26px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 14 }}>
                Sistema comum
              </div>
              <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
                &ldquo;Olá! 👋 Como posso ajudar você hoje?&rdquo;
              </p>
            </div>

            <div style={{ background: "rgba(74,155,176,0.08)", border: "1px solid rgba(74,155,176,0.3)", borderRadius: 16, padding: isMobile ? "22px 20px" : "28px 26px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 14 }}>👔</span>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a9bb0" }}>
                  Diretor Digital · OrganizaPro
                </span>
              </div>
              <p style={{ fontSize: 16, color: "#e2e8f0", lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
                &ldquo;Bom dia. 3 clientes estão sem retorno há mais de 15 dias.
                Preparei as mensagens — quer revisar antes de enviar?&rdquo;
              </p>
            </div>
          </div>

          <p style={{ textAlign: "center", marginTop: 28, fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>
            Ele não espera você perguntar. Já olhou os números antes de você abrir o sistema.
          </p>
        </div>
      </section>

      {/* ── COMO ELE TRABALHA (5 momentos) ────────────────────────── */}
      <section id="como-funciona" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0c0e14" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
            <span className="section-tag">Rotina</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Ele trabalha mesmo quando ninguém está olhando
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
              Cinco momentos do seu dia em que o Diretor Digital já está de olho.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(5, 1fr)", gap: isMobile ? 28 : 20 }}>
            {MOMENTOS.map((m, i) => (
              <div key={m.titulo} style={{ textAlign: "center", position: "relative" }}>
                {!isMobile && i < MOMENTOS.length - 1 && <div className="momento-connector" />}
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "linear-gradient(135deg,#1F4E5F,#0d3547)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, margin: "0 auto 18px", position: "relative", zIndex: 1,
                  boxShadow: "0 4px 18px rgba(31,78,95,0.35)",
                }}>{m.icone}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px" }}>{m.titulo}</h3>
                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MÓDULOS (o que ele enxerga e entrega) ─────────────────── */}
      <section id="modulos" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0f1117" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
            <span className="section-tag">Como ele age</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Um Diretor Digital, seis frentes de trabalho
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
              Cada módulo é uma parte de como ele cuida do seu negócio — não recursos soltos.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
            {MODULOS.map(m => (
              <div key={m.titulo} className="card-soft" style={{ padding: 26 }}>
                <div style={{ fontSize: 30, marginBottom: 14 }}>{m.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#4a9bb0", marginBottom: 6 }}>
                  {m.papel}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px" }}>{m.titulo}</h3>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROVA VISUAL (mockup real do Dashboard) ───────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0c0e14" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Prova, não promessa</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Isto já roda na conta de todo cliente OrganizaPro
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
              O card &ldquo;Prioridade do Diretor&rdquo;, direto do Dashboard real.
            </p>
          </div>

          <div style={{
            borderRadius: 18, background: "linear-gradient(135deg, rgba(74,155,176,0.12), rgba(31,78,95,0.22))",
            border: "1px solid rgba(74,155,176,0.3)", padding: isMobile ? "22px 20px" : "28px 30px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg,#1F4E5F,#0d3547)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>
                👔
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9" }}>Diretor Digital</span>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                    color: "#4a9bb0", background: "rgba(74,155,176,0.12)", border: "1px solid rgba(74,155,176,0.25)",
                    borderRadius: 999, padding: "2px 8px",
                  }}>
                    OrganizaPro Intelligence
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
                  Bom dia. Enquanto você cuidava do seu negócio, analisei sua rotina.
                  Se eu estivesse administrando sua empresa hoje, começaria exatamente por esta ação.
                </p>
              </div>
            </div>

            <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 14, padding: isMobile ? "18px 18px" : "18px 20px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f87171", marginBottom: 10 }}>
                🎯 Prioridade do Diretor
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>
                Analisei sua agenda e encontrei 2 compromissos em atraso.
              </div>
              <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55, margin: "0 0 8px" }}>
                Compromissos atrasados costumam virar clientes esquecidos se não forem resolvidos rápido.
                Vale sua atenção agora.
              </p>
              <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4, margin: "0 0 14px", fontStyle: "italic" }}>
                Por quê: 2 compromissos passaram da data sem confirmação ou reagendamento.
              </p>
              <span style={{ display: "inline-flex", padding: "8px 18px", borderRadius: 9, background: "#f87171", color: "#0a0d14", fontSize: 13, fontWeight: 700 }}>
                Executar agora →
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PARA QUEM ──────────────────────────────────────────────── */}
      <section id="para-quem" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0f1117" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Para quem</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Para qualquer negócio<br />que atende pessoas
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
              Se você tem uma agenda e precisa administrar clientes, o Diretor Digital é para você.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: 14, maxWidth: 800, margin: "0 auto",
          }}>
            {AUDIENCE.map(p => (
              <div key={p.label} className="card-soft" style={{ padding: "22px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>{p.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.4 }}>{p.label}</div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", marginTop: 28, fontSize: 14, color: "#64748b" }}>
            e qualquer outro profissional autônomo ou pequeno negócio de serviços.
          </p>
        </div>
      </section>

      {/* ── OFERTA ─────────────────────────────────────────────────── */}
      <section id="oferta" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0c0e14" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Investimento</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Ter um Diretor Digital custa menos que um estagiário
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
              Sem mensalidades surpresa. Sem letras miúdas.
            </p>
          </div>

          <div id="incluso" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, alignItems: "start" }}>

            {/* Implantação */}
            <div style={{ background: "linear-gradient(135deg,#1F4E5F,#0d3547)", borderRadius: 18, padding: isMobile ? "32px 24px" : "40px 36px", color: "#fff" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
                Implantação — paga uma única vez
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.65)", marginTop: 12 }}>R$</span>
                <span style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: "#fff" }}>997</span>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.58)", margin: "0 0 28px", lineHeight: 1.65 }}>
                Pago uma única vez. Inclui configuração completa, landing page e orientação de Google.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Diretor Digital configurado",
                  "Landing page do seu negócio",
                  "Configuração do Perfil Google",
                  "SEO inicial básico",
                  "Treinamento incluso",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Mensalidade */}
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 18, padding: isMobile ? "32px 24px" : "40px 36px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginBottom: 10 }}>
                Manutenção — cobrada mensalmente
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 2, marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#64748b", marginTop: 14 }}>R$</span>
                <span style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: "#f1f5f9" }}>49</span>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", lineHeight: 1 }}>,90</span>
                  <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.4 }}>/mês</span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 28px", lineHeight: 1.65 }}>
                Acesso contínuo ao Diretor Digital, hospedagem, atualizações e suporte.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Acesso ao OrganizaPro",
                  "Agenda e cadastro de clientes",
                  "Prioridade do Diretor todo dia",
                  "Suporte via WhatsApp",
                  "Atualizações incluídas",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#e2e8f0" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(74,155,176,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, color: "#4a9bb0" }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumo do investimento */}
          <div style={{
            marginTop: 20, background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: isMobile ? "20px 20px" : "22px 28px",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between", flexWrap: "wrap", gap: 16, flexDirection: isMobile ? "column" : "row",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>Primeiro ano completo:</div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: "#4a9bb0" }}>
                R$997 + 12 × R$49,90 = <span style={{ color: "#f1f5f9" }}>R$1.595,80</span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Diretor Digital + landing page + Google + suporte por 12 meses</div>
            </div>
            <button className="btn-main" style={{ fontSize: isMobile ? 14 : 15, padding: isMobile ? "13px 22px" : "14px 30px", flexShrink: 0 }}
              onClick={() => wpp("Quero saber mais sobre o OrganizaPro — Implantação + Mensalidade")}>
              Quero saber mais
            </button>
          </div>

        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "72px 20px" : "100px 40px", background: "#0f1117", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>

          <div style={{ fontSize: 52, marginBottom: 22 }}>👔</div>

          <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 900, color: "#f1f5f9", lineHeight: 1.12, margin: "0 0 16px", letterSpacing: "-0.3px" }}>
            Pronto para parar<br />
            <span style={{ color: "#4a9bb0" }}>de administrar sozinho?</span>
          </h2>

          <p style={{ fontSize: isMobile ? 16 : 18, color: "#94a3b8", margin: "0 0 38px", lineHeight: 1.7 }}>
            A partir de hoje, alguém pode estar de olho no seu negócio — todos os dias, o dia inteiro.
          </p>

          <button className="btn-main"
            style={{ fontSize: isMobile ? 16 : 18, padding: isMobile ? "16px 24px" : "18px 44px" }}
            onClick={() => wpp()}>
            Quero um Diretor Digital no meu negócio
          </button>

          <p style={{ marginTop: 16, fontSize: 13, color: "#64748b" }}>
            Atendimento via WhatsApp · Resposta rápida
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{
        background: "#0a0b10", padding: isMobile ? "24px 20px" : "28px 40px",
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: "center", justifyContent: "space-between",
        gap: 14, textAlign: isMobile ? "center" : "left",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>👔</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>OrganizaPro</span>
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          © 2026 OrganizaPro. Todos os direitos reservados.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/login" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            Entrar no sistema
          </Link>
          <a href={`https://wa.me/5541988379119?text=${encodeURIComponent("Quero falar com o OrganizaPro")}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            💬 WhatsApp
          </a>
        </div>
      </footer>

    </div>
  );
}
