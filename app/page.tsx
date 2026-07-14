"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import LandingHero from "./components/landing/LandingHero";

// ── Landing Page Premium 2.0 · Diretor Digital ──────────────────────────
//
// Missão de posicionamento/conversão: a home deve transmitir "produto SaaS
// premium com inteligência própria", nunca "sistema de gestão". Ordem das
// seções: Hero (painel vivo) → Dashboard como protagonista → rotina do
// Diretor Digital → comparação de posicionamento → seis frentes como uma
// única inteligência → prova visual (Prioridade do Diretor) → oferta →
// CTA final. Paleta e tipografia seguem o dark theme real do produto
// logado (AdminShell/Dashboard: bg #0f1117, acento #1F4E5F/#0d3547).

// `useReveal` dá o efeito de fade+slide ao entrar na viewport — a única
// microinteração que precisa de JS (as demais são CSS puro). Cada seção
// chama o hook uma vez; a observação para assim que revela, então não há
// custo contínuo de scroll. Um timeout de segurança força a revelação
// mesmo se o IntersectionObserver nunca disparar (ex.: navegação direta
// por âncora, aba em segundo plano) — uma seção de venda nunca pode
// ficar invisível por causa de uma microinteração.
function useReveal<T extends HTMLElement>(): [React.RefObject<T | null>, string] {
  const elRef = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const reveal = () => setVisible(true);
    const el = elRef.current;
    if (!el) { reveal(); return; }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { reveal(); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    const fallback = setTimeout(reveal, 1500);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);
  return [elRef, "reveal" + (visible ? " reveal-visible" : "")];
}

const TRABALHO = [
  { icone: "🌅", titulo: "Pela manhã",           desc: "Organiza prioridades."          },
  { icone: "☀️", titulo: "Durante o expediente", desc: "Acompanha clientes e agenda."   },
  { icone: "🌤️", titulo: "Em segundo plano",     desc: "Analisa indicadores."           },
  { icone: "🌇", titulo: "Enquanto você atende",  desc: "Cuida da reputação."            },
  { icone: "🌙", titulo: "No fim do dia",         desc: "Entrega recomendações."         },
];

const COMPARACAO_OUTROS = ["Apenas armazenam dados.", "Esperam comandos.", "Mostram relatórios.", "São ferramentas."];
const COMPARACAO_ORGANIZAPRO = ["Analisa informações.", "Identifica prioridades.", "Recomenda ações.", "Atua como Diretor Digital."];

const FRENTES = [
  { icon: "👥", texto: "Organiza clientes."             },
  { icon: "📅", texto: "Controla a agenda."              },
  { icon: "📊", texto: "Analisa indicadores."            },
  { icon: "🌐", texto: "Fortalece a presença digital."   },
  { icon: "⭐", texto: "Cuida da reputação online."      },
  { icon: "🤖", texto: "Produz conteúdo com IA."         },
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

const VALOR_OFERTA = ["Diretor Digital", "Dashboard Inteligente", "Atualizações", "IA integrada", "Suporte"];

export default function Page() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const wpp = (msg = "Quero um Diretor Digital cuidando do meu negócio") =>
    window.open(`https://wa.me/5541988379119?text=${encodeURIComponent(msg)}`, "_blank");

  const [refDash, classDash]     = useReveal<HTMLDivElement>();
  const [refTrab, classTrab]     = useReveal<HTMLDivElement>();
  const [refComp, classComp]     = useReveal<HTMLDivElement>();
  const [refFrent, classFrent]   = useReveal<HTMLDivElement>();
  const [refProva, classProva]   = useReveal<HTMLDivElement>();
  const [refOferta, classOferta] = useReveal<HTMLDivElement>();

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
          text-decoration: none; text-align: center; line-height: 1.3; max-width: 100%;
        }
        .btn-main:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(31,78,95,0.55); }

        .btn-hero { animation: ctaGlow 2.6s ease-in-out infinite; }

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

        .reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .reveal-visible { opacity: 1; transform: translateY(0); }

        @keyframes floatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .dash-float { animation: floatY 6s ease-in-out infinite; }

        @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .live-dot { animation: pulseDot 1.6s ease-in-out infinite; }

        @keyframes ctaGlow {
          0%, 100% { box-shadow: 0 4px 20px rgba(31,78,95,0.4); }
          50%      { box-shadow: 0 6px 34px rgba(31,78,95,0.75); }
        }

        .frentes-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
        .frente-item { padding: 26px 22px; border-top: 1px solid rgba(255,255,255,0.07); transition: background 0.2s; }
        .frente-item:hover { background: rgba(255,255,255,0.02); }
        .frente-item:nth-child(-n+3) { border-top: none; }
        .frente-item:not(:nth-child(3n+1)) { border-left: 1px solid rgba(255,255,255,0.07); }
        @media (max-width: 860px) {
          .frentes-grid { grid-template-columns: repeat(2, 1fr); }
          .frente-item { border-top: 1px solid rgba(255,255,255,0.07) !important; border-left: none !important; }
          .frente-item:nth-child(-n+2) { border-top: none !important; }
          .frente-item:not(:nth-child(2n+1)) { border-left: 1px solid rgba(255,255,255,0.07) !important; }
        }
        @media (max-width: 560px) {
          .frentes-grid { grid-template-columns: 1fr; }
          .frente-item { border-left: none !important; }
          .frente-item:first-child { border-top: none !important; }
        }
      `}</style>

      <LandingHero onPrimaryCta={() => wpp()} />

      {/* ── DASHBOARD PROTAGONISTA ─────────────────────────────────── */}
      <section style={{ padding: isMobile ? "20px 20px 90px" : "10px 40px 130px", background: "#0f1117" }}>
        <div ref={refDash} className={classDash} style={{ maxWidth: 980, margin: "0 auto" }}>
          <div className="dash-float" style={{
            borderRadius: 24, background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
            border: "1px solid rgba(255,255,255,0.1)", padding: isMobile ? 8 : 14,
            boxShadow: "0 50px 110px rgba(0,0,0,0.55), 0 0 90px rgba(31,78,95,0.3)",
          }}>
            <div style={{ borderRadius: 18, overflow: "hidden", background: "#0a0d14" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0a0f1c",
              }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["#f87171", "#fbbf24", "#4ade80"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>OrganizaPro — Painel</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#4ade80" }}>
                  <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                  Ao vivo
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "56px 1fr" }}>
                {!isMobile && (
                  <div style={{ background: "#080b13", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "16px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                    {["🏠", "👥", "📅", "🌐", "⭐", "📊"].map((icon, i) => (
                      <div key={i} style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: i === 0 ? "rgba(74,155,176,0.18)" : "transparent",
                        border: i === 0 ? "1px solid rgba(74,155,176,0.35)" : "none",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                      }}>{icon}</div>
                    ))}
                  </div>
                )}

                <div style={{ padding: isMobile ? "18px 16px" : "22px 26px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Bom dia, Studio Bella 👋</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Segunda-feira, 08 Jun</div>
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#1F4E5F,#0d3547)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>SB</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
                    {[
                      { label: "Compromissos", value: "8",       accent: "#4a9bb0" },
                      { label: "Confirmados",  value: "6",       accent: "#4ade80" },
                      { label: "Aguardando",   value: "2",       accent: "#fbbf24" },
                      { label: "Receita prev.", value: "R$2.480", accent: "#4ade80" },
                    ].map(item => (
                      <div key={item.label} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: item.accent }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Agenda de hoje</div>
                    {[
                      { time: "09:00", name: "Cliente 1", status: "#4ade80", label: "Confirmado" },
                      { time: "10:30", name: "Cliente 2", status: "#4ade80", label: "Confirmado" },
                      { time: "13:00", name: "Cliente 3", status: "#fbbf24", label: "Pendente" },
                      { time: "14:30", name: "Cliente 4", status: "#f87171", label: "Não respondeu" },
                    ].map(apt => (
                      <div key={apt.time} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 38, flexShrink: 0 }}>{apt.time}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", flex: 1, minWidth: 0 }}>{apt.name}</div>
                        <div style={{ fontSize: 10.5, color: apt.status, flexShrink: 0, whiteSpace: "nowrap" }}>{apt.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: "rgba(74,155,176,0.1)", border: "1px solid rgba(74,155,176,0.3)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>🎯</span>
                    <span style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>
                      <strong style={{ color: "#4a9bb0" }}>Prioridade do Diretor:</strong> confirmar os atendimentos da tarde.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── O ORGANIZAPRO TRABALHA (rotina do Diretor Digital) ────── */}
      <section id="como-funciona" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0c0e14" }}>
        <div ref={refTrab} className={classTrab} style={{ maxWidth: 1100, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
            <span className="section-tag">Rotina</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              O OrganizaPro trabalha o dia inteiro
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
              Do primeiro ao último minuto do expediente, ele está de olho no seu negócio.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(5, 1fr)", gap: isMobile ? 28 : 20 }}>
            {TRABALHO.map((m, i) => (
              <div key={m.titulo} style={{ textAlign: "center", position: "relative" }}>
                {!isMobile && i < TRABALHO.length - 1 && <div className="momento-connector" />}
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

      {/* ── COMPARAÇÃO DE POSICIONAMENTO ───────────────────────────── */}
      <section style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0f1117" }}>
        <div ref={refComp} className={classComp} style={{ maxWidth: 900, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Posicionamento</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Sistema é uma coisa. Diretor Digital é outra.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? "26px 22px" : "32px 30px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 18 }}>
                Outros sistemas
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {COMPARACAO_OUTROS.map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: "#64748b" }}>
                    <span style={{ flexShrink: 0 }}>✕</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "rgba(74,155,176,0.08)", border: "1px solid rgba(74,155,176,0.35)", borderRadius: 16, padding: isMobile ? "26px 22px" : "32px 30px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a9bb0", marginBottom: 18 }}>
                OrganizaPro
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {COMPARACAO_ORGANIZAPRO.map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: "#e2e8f0", fontWeight: 500 }}>
                    <span style={{ flexShrink: 0, color: "#4a9bb0" }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEIS FRENTES · UMA ÚNICA INTELIGÊNCIA ─────────────────── */}
      <section id="modulos" style={{ padding: isMobile ? "64px 20px" : "90px 40px", background: "#0c0e14" }}>
        <div ref={refFrent} className={classFrent} style={{ maxWidth: 1000, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Como ele age</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Seis frentes. Uma única inteligência.
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
              Não são recursos isolados — é o mesmo Diretor Digital agindo em seis frentes do seu negócio.
            </p>
          </div>

          <div className="card-soft" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "20px 22px" : "22px 30px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{
                width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg,#1F4E5F,#0d3547)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
              }}>👔</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>Diretor Digital</span>
            </div>

            <div className="frentes-grid">
              {FRENTES.map(f => (
                <div key={f.texto} className="frente-item">
                  <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.5 }}>{f.texto}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROVA VISUAL (Prioridade do Diretor) ──────────────────── */}
      <section style={{ padding: isMobile ? "72px 20px" : "110px 40px", background: "radial-gradient(ellipse at center, rgba(248,113,113,0.08), #0f1117 65%)" }}>
        <div ref={refProva} className={classProva} style={{ maxWidth: 800, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <span className="section-tag">Prova, não promessa</span>
            <h2 style={{ fontSize: isMobile ? 26 : 42, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Isto já roda na conta de todo cliente OrganizaPro
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
              O card &ldquo;Prioridade do Diretor&rdquo;, direto do Dashboard real.
            </p>
          </div>

          <div style={{
            borderRadius: 22, background: "linear-gradient(135deg, rgba(74,155,176,0.14), rgba(31,78,95,0.26))",
            border: "1px solid rgba(74,155,176,0.35)", padding: isMobile ? "26px 22px" : "34px 38px",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45), 0 0 60px rgba(74,155,176,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 22 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg,#1F4E5F,#0d3547)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                👔
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>Diretor Digital</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                    color: "#4a9bb0", background: "rgba(74,155,176,0.12)", border: "1px solid rgba(74,155,176,0.25)",
                    borderRadius: 999, padding: "2px 8px",
                  }}>
                    OrganizaPro Intelligence
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#4ade80", fontWeight: 700 }}>
                    <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                    ao vivo
                  </span>
                </div>
                <p style={{ fontSize: 13.5, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
                  Bom dia. Enquanto você cuidava do seu negócio, analisei sua rotina.
                  Se eu estivesse administrando sua empresa hoje, começaria exatamente por esta ação.
                </p>
              </div>
            </div>

            <div style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 16, padding: isMobile ? "20px 20px" : "24px 26px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f87171", marginBottom: 12 }}>
                🎯 Prioridade do Diretor
              </div>
              <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
                Analisei sua agenda e encontrei 2 compromissos em atraso.
              </div>
              <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 10px" }}>
                Compromissos atrasados costumam virar clientes esquecidos se não forem resolvidos rápido.
                Vale sua atenção agora.
              </p>
              <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.4, margin: "0 0 18px", fontStyle: "italic" }}>
                Por quê: 2 compromissos passaram da data sem confirmação ou reagendamento.
              </p>
              <span style={{ display: "inline-flex", padding: "10px 22px", borderRadius: 10, background: "#f87171", color: "#0a0d14", fontSize: 14, fontWeight: 700 }}>
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
        <div ref={refOferta} className={classOferta} style={{ maxWidth: 860, margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: isMobile ? 28 : 36 }}>
            <span className="section-tag">Investimento</span>
            <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 14px" }}>
              Ter um Diretor Digital custa menos que um estagiário
            </h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "#94a3b8", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
              Sem mensalidades surpresa. Sem letras miúdas.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: isMobile ? 32 : 44 }}>
            {VALOR_OFERTA.map(v => (
              <span key={v} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999,
                background: "rgba(74,155,176,0.1)", border: "1px solid rgba(74,155,176,0.28)",
                color: "#4a9bb0", fontSize: 13, fontWeight: 700,
              }}>
                ✔ {v}
              </span>
            ))}
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

          <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 900, color: "#f1f5f9", lineHeight: 1.25, margin: "0 0 16px", letterSpacing: "-0.3px" }}>
            Sua empresa já conquistou clientes.<br />
            <span style={{ color: "#4a9bb0" }}>Agora ela merece um Diretor Digital.</span>
          </h2>

          <button className="btn-main btn-hero"
            style={{ fontSize: isMobile ? 16 : 18, padding: isMobile ? "16px 24px" : "18px 44px", marginTop: 22 }}
            onClick={() => wpp("Quero conhecer o OrganizaPro")}>
            Quero conhecer o OrganizaPro
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
