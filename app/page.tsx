"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Page() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [isMobile,  setIsMobile]  = useState(false);

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

  const wpp = (msg = "Quero organizar meu negócio com o OrganizaPro") =>
    window.open(`https://wa.me/5541988379119?text=${encodeURIComponent(msg)}`, "_blank");

  const NAV_LINKS: [string, string][] = [
    ["Benefícios",    "#beneficios"   ],
    ["Como funciona", "#como-funciona"],
    ["Oferta",        "#oferta"       ],
    ["Para quem",     "#para-quem"    ],
  ];

  const BENEFITS = [
    { icon: "📅", title: "Agenda simples",               desc: "Visualize todos os seus compromissos do dia em um calendário limpo e intuitivo."                       },
    { icon: "👥", title: "Cadastro de clientes",         desc: "Registre dados, histórico de atendimentos e observações de cada cliente em um único lugar."           },
    { icon: "📞", title: "Central de contatos",          desc: "Acesse rapidamente o WhatsApp, telefone e e-mail de qualquer cliente com um toque."                   },
    { icon: "📊", title: "Dashboard diário",             desc: "Veja de forma clara os números do dia: compromissos, confirmações e pendências."                       },
    { icon: "📄", title: "PDF personalizado",            desc: "Exporte a agenda do dia em PDF com a identidade visual do seu negócio, pronto para imprimir."         },
    { icon: "🌐", title: "Landing page do negócio",      desc: "Página profissional com botão WhatsApp, localização e informações do seu negócio — inclusa no plano." },
    { icon: "📍", title: "Perfil Google e SEO inicial",  desc: "Orientação para configurar seu Perfil da Empresa no Google e aparecer nas buscas locais."             },
  ];

  const STEPS = [
    { n: "01", icon: "🛠️", title: "Implantamos",         desc: "Nossa equipe configura todo o sistema para o seu negócio: agenda, cadastro, landing page e integrações." },
    { n: "02", icon: "✏️", title: "Personalizamos",       desc: "Adaptamos as mensagens, o visual e os campos para ficarem com a cara do seu negócio."                   },
    { n: "03", icon: "🚀", title: "Você começa a usar",   desc: "Em poucos minutos você já está gerenciando clientes e compromissos, sem complicação nenhuma."            },
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

  const DIFERENCIAIS = [
    { icon: "🎯", title: "Sem sistema complicado",                desc: "Interface limpa e botões claros. Você encontra tudo exatamente onde espera encontrar."      },
    { icon: "⚡", title: "Sem treinamento longo",                 desc: "A maioria dos nossos clientes entende o sistema no primeiro uso, sem precisar de ajuda."    },
    { icon: "🕐", title: "Feito para aprender em poucos minutos", desc: "Menos de 10 minutos para cadastrar seu primeiro cliente e criar seu primeiro compromisso."  },
  ];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#F5F7FA", color: "#2C3E50", overflowX: "hidden", maxWidth: "100vw" }}>

      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        .btn-main {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: #1F4E5F; color: #fff; border: none; border-radius: 10px;
          font-family: inherit; font-size: 16px; font-weight: 700; padding: 16px 32px;
          cursor: pointer; transition: all 0.22s; box-shadow: 0 4px 20px rgba(31,78,95,0.28);
          text-decoration: none; white-space: nowrap; line-height: 1;
        }
        .btn-main:hover { background: #174454; transform: translateY(-2px); box-shadow: 0 8px 30px rgba(31,78,95,0.38); }

        .btn-outline {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: transparent; color: rgba(255,255,255,0.85);
          border: 2px solid rgba(255,255,255,0.45); border-radius: 10px;
          font-family: inherit; font-size: 15px; font-weight: 600; padding: 14px 28px;
          cursor: pointer; transition: all 0.22s; text-decoration: none; white-space: nowrap; line-height: 1;
        }
        .btn-outline:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.75); color: #fff; }

        .card-benefit {
          background: #fff; border-radius: 14px; padding: 28px 24px;
          box-shadow: 0 2px 16px rgba(44,62,80,0.07); border: 1px solid rgba(44,62,80,0.07);
          transition: box-shadow 0.22s, transform 0.22s;
        }
        .card-benefit:hover { box-shadow: 0 10px 32px rgba(31,78,95,0.12); transform: translateY(-3px); }

        .card-audience {
          background: #fff; border-radius: 14px; padding: 22px 16px; text-align: center;
          box-shadow: 0 2px 12px rgba(44,62,80,0.07); border: 1px solid rgba(44,62,80,0.06);
          transition: box-shadow 0.22s, transform 0.22s;
        }
        .card-audience:hover { box-shadow: 0 8px 24px rgba(31,78,95,0.14); transform: translateY(-3px); }

        .section-tag {
          display: inline-block; background: rgba(31,78,95,0.1); color: #1F4E5F;
          font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
          text-transform: uppercase; padding: 5px 14px; border-radius: 999px; margin-bottom: 14px;
        }

        .step-connector {
          position: absolute; top: 27px; left: calc(50% + 42px);
          width: calc(100% - 84px); height: 2px; background: rgba(31,78,95,0.14);
          pointer-events: none;
        }
      `}</style>

      {/* ── NAV ────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 16px" : "0 40px", height: 64,
        background: scrolled ? "rgba(255,255,255,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        boxShadow: scrolled ? "0 1px 20px rgba(44,62,80,0.1)" : "none",
        borderBottom: scrolled ? "1px solid rgba(44,62,80,0.07)" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#1F4E5F" }}>OrganizaPro</span>
        </div>

        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {NAV_LINKS.map(([label, href]) => (
              <a key={href} href={href}
                style={{ fontSize: 14, color: "#2C3E50", textDecoration: "none", fontWeight: 500, opacity: 0.7, transition: "opacity 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
              >{label}</a>
            ))}
          </div>
        )}

        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/login" style={{ fontSize: 14, color: "#64748b", textDecoration: "none", fontWeight: 500 }}>Entrar</Link>
            <button className="btn-main" style={{ padding: "10px 20px", fontSize: 14 }} onClick={() => wpp()}>
              💬 Falar pelo WhatsApp
            </button>
          </div>
        )}

        {isMobile && (
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ display: "block", width: 22, height: 2, background: "#2C3E50", borderRadius: 2, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
            <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? "transparent" : "#2C3E50", borderRadius: 2, transition: "all 0.2s" }} />
            <span style={{ display: "block", width: 22, height: 2, background: "#2C3E50", borderRadius: 2, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
          </button>
        )}
      </nav>

      {/* ── MOBILE MENU ────────────────────────────────────────────── */}
      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, top: 64, background: "rgba(255,255,255,0.98)", zIndex: 99, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32 }}>
          {NAV_LINKS.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}
              style={{ fontSize: 22, color: "#2C3E50", textDecoration: "none", fontWeight: 600 }}
            >{label}</a>
          ))}
          <button className="btn-main" style={{ fontSize: 16 }} onClick={() => { setMenuOpen(false); wpp(); }}>
            💬 Falar pelo WhatsApp
          </button>
          <Link href="/login" onClick={() => setMenuOpen(false)}
            style={{ fontSize: 14, color: "#94a3b8", textDecoration: "none" }}>
            Já sou cliente → Entrar
          </Link>
        </div>
      )}

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(145deg, #1F4E5F 0%, #0d3547 100%)",
        padding: isMobile ? "104px 20px 72px" : "130px 40px 90px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 999, padding: "6px 18px", marginBottom: 28,
            fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 600,
          }}>
            📋 O sistema mais simples para organizar o seu negócio.
          </div>

          <h1 style={{
            fontSize: isMobile ? 32 : 52, fontWeight: 900, color: "#fff",
            lineHeight: 1.1, margin: "0 0 22px", letterSpacing: "-0.5px",
          }}>
            Organize seus clientes,{" "}
            <span style={{ color: "rgba(255,255,255,0.72)" }}>compromissos e rotina</span>{" "}
            em um único lugar.
          </h1>

          <p style={{
            fontSize: isMobile ? 16 : 19, color: "rgba(255,255,255,0.68)",
            margin: "0 auto 40px", lineHeight: 1.75, maxWidth: 580,
          }}>
            O OrganizaPro é um sistema simples, bonito e fácil de usar para pequenos negócios
            que precisam controlar agenda, clientes e atendimentos.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#fff", color: "#1F4E5F", border: "none", borderRadius: 10,
                fontFamily: "inherit", fontSize: isMobile ? 15 : 17, fontWeight: 700,
                padding: isMobile ? "14px 24px" : "17px 36px", cursor: "pointer",
                boxShadow: "0 6px 24px rgba(0,0,0,0.15)", transition: "all 0.22s",
                whiteSpace: "nowrap", lineHeight: 1,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 30px rgba(0,0,0,0.22)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.15)"; }}
              onClick={() => wpp()}
            >
              Quero conhecer o OrganizaPro
            </button>
            <a href="#incluso" className="btn-outline"
              style={{ fontSize: isMobile ? 14 : 15, padding: isMobile ? "13px 22px" : "15px 28px" }}>
              Ver o que está incluso ↓
            </a>
          </div>

          <p style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.38)" }}>
            Implantação assistida · Landing page · Suporte inclusos
          </p>
        </div>
      </section>

      {/* ── BENEFÍCIOS ─────────────────────────────────────────────── */}
      <section id="beneficios" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#F5F7FA" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
            <span className="section-tag">Benefícios</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#2C3E50", lineHeight: 1.15, margin: "0 0 14px" }}>
              Tudo que você precisa, sem complicação
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#64748b", lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
              Cada recurso foi pensado para funcionar do jeito mais simples possível.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(290px, 1fr))", gap: 18 }}>
            {BENEFITS.map(b => (
              <div key={b.title} className="card-benefit">
                <div style={{ fontSize: 34, marginBottom: 14 }}>{b.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1F4E5F", margin: "0 0 8px" }}>{b.title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, margin: 0 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ──────────────────────────────────────────── */}
      <section id="como-funciona" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#fff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
            <span className="section-tag">Como funciona</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#2C3E50", lineHeight: 1.15, margin: "0 0 14px" }}>
              Três passos. Zero complicação.
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#64748b", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
              Você não precisa configurar nada. Nossa equipe faz tudo por você.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 36 : 24 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ textAlign: "center", position: "relative" }}>
                {!isMobile && i < 2 && <div className="step-connector" />}
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "#1F4E5F", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 900, margin: "0 auto 18px", position: "relative", zIndex: 1,
                  boxShadow: "0 4px 18px rgba(31,78,95,0.25)",
                }}>{s.n}</div>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#2C3E50", margin: "0 0 10px" }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: isMobile ? 40 : 52 }}>
            <button className="btn-main" style={{ fontSize: isMobile ? 15 : 16, padding: isMobile ? "14px 28px" : "15px 36px" }}
              onClick={() => wpp()}>
              💬 Quero conhecer o OrganizaPro
            </button>
          </div>
        </div>
      </section>

      {/* ── OFERTA ─────────────────────────────────────────────────── */}
      <section id="oferta" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#F5F7FA" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Oferta</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#2C3E50", lineHeight: 1.15, margin: "0 0 14px" }}>
              Investimento claro desde o início
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#64748b", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
              Sem mensalidades surpresa. Sem letras miúdas.
            </p>
          </div>

          <div id="incluso" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, alignItems: "start" }}>

            {/* Implantação */}
            <div style={{ background: "#1F4E5F", borderRadius: 18, padding: isMobile ? "32px 24px" : "40px 36px", color: "#fff" }}>
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
                  "Sistema completo configurado",
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
            <div style={{ background: "#fff", borderRadius: 18, padding: isMobile ? "32px 24px" : "40px 36px", border: "2px solid rgba(31,78,95,0.12)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 10 }}>
                Manutenção — cobrada mensalmente
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 2, marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#94a3b8", marginTop: 14 }}>R$</span>
                <span style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: "#1F4E5F" }}>49</span>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#1F4E5F", lineHeight: 1 }}>,90</span>
                  <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.4 }}>/mês</span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px", lineHeight: 1.65 }}>
                Acesso contínuo ao sistema, hospedagem, atualizações e suporte.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Acesso ao OrganizaPro",
                  "Agenda e cadastro de clientes",
                  "Dashboard e PDF diário",
                  "Suporte via WhatsApp",
                  "Atualizações incluídas",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#2C3E50" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(31,78,95,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, color: "#1F4E5F" }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumo do investimento */}
          <div style={{
            marginTop: 20, background: "#fff", borderRadius: 14, padding: isMobile ? "20px 20px" : "22px 28px",
            border: "1px solid rgba(31,78,95,0.1)",
            display: "flex", alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between", flexWrap: "wrap", gap: 16, flexDirection: isMobile ? "column" : "row",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Primeiro ano completo:</div>
              <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: "#1F4E5F" }}>
                R$997 + 12 × R$49,90 = <span style={{ color: "#2C3E50" }}>R$1.595,80</span>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>Sistema + landing page + Google + suporte por 12 meses</div>
            </div>
            <button className="btn-main" style={{ fontSize: isMobile ? 14 : 15, padding: isMobile ? "13px 22px" : "14px 30px", flexShrink: 0 }}
              onClick={() => wpp("Quero saber mais sobre o OrganizaPro — Implantação + Mensalidade")}>
              Quero saber mais
            </button>
          </div>

        </div>
      </section>

      {/* ── PARA QUEM ──────────────────────────────────────────────── */}
      <section id="para-quem" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#fff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Para quem</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#2C3E50", lineHeight: 1.15, margin: "0 0 14px" }}>
              Para qualquer negócio<br />que atende pessoas
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#64748b", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
              Se você tem uma agenda e precisa organizar seus clientes, o OrganizaPro é para você.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: 14, maxWidth: 800, margin: "0 auto",
          }}>
            {AUDIENCE.map(p => (
              <div key={p.label} className="card-audience">
                <div style={{ fontSize: 36, marginBottom: 10 }}>{p.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2C3E50", lineHeight: 1.4 }}>{p.label}</div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", marginTop: 28, fontSize: 14, color: "#94a3b8" }}>
            e qualquer outro profissional autônomo ou pequeno negócio de serviços.
          </p>
        </div>
      </section>

      {/* ── DIFERENCIAL ────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#1F4E5F" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span style={{
              display: "inline-block", background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)",
              fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "5px 14px", borderRadius: 999, marginBottom: 14,
            }}>Diferencial</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 14px" }}>
              Feito para quem não tem tempo a perder
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, maxWidth: 540, margin: "0 auto" }}>
              Você não precisa aprender um sistema complicado. O OrganizaPro funciona do jeito que você já pensa.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 18 }}>
            {DIFERENCIAIS.map(d => (
              <div key={d.title} style={{
                background: "rgba(255,255,255,0.07)", borderRadius: 14,
                padding: isMobile ? "24px 20px" : "28px 24px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{d.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>{d.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.56)", lineHeight: 1.7, margin: 0 }}>{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? "72px 20px" : "100px 40px", background: "#F5F7FA", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>

          <div style={{ fontSize: 52, marginBottom: 22 }}>📋</div>

          <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 900, color: "#2C3E50", lineHeight: 1.12, margin: "0 0 16px", letterSpacing: "-0.3px" }}>
            Pronto para organizar<br />
            <span style={{ color: "#1F4E5F" }}>seu negócio?</span>
          </h2>

          <p style={{ fontSize: isMobile ? 16 : 18, color: "#64748b", margin: "0 0 38px", lineHeight: 1.7 }}>
            Fale com a gente agora e veja como o OrganizaPro pode transformar a rotina do seu negócio.
          </p>

          <button className="btn-main"
            style={{ fontSize: isMobile ? 16 : 18, padding: isMobile ? "16px 24px" : "18px 44px" }}
            onClick={() => wpp()}>
            💬 Quero organizar meu negócio com o OrganizaPro
          </button>

          <p style={{ marginTop: 16, fontSize: 13, color: "#b0bec5" }}>
            Atendimento via WhatsApp · Resposta rápida
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{
        background: "#2C3E50", padding: isMobile ? "24px 20px" : "28px 40px",
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: "center", justifyContent: "space-between",
        gap: 14, textAlign: isMobile ? "center" : "left",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>📋</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>OrganizaPro</span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          © 2026 OrganizaPro. Todos os direitos reservados.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/login" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
            Entrar no sistema
          </Link>
          <a href={`https://wa.me/5541988379119?text=${encodeURIComponent("Quero falar com o OrganizaPro")}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
            💬 WhatsApp
          </a>
        </div>
      </footer>

    </div>
  );
}
