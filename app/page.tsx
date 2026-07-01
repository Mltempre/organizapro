"use client";
import { useState, useEffect } from "react";

export default function Page() {
  const [scrolled, setScrolled]   = useState(false);
  const [compromissos, setCompromissos] = useState(20);
  const [ticket, setTicket]       = useState(200);
  const [demoModal, setDemoModal] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [isMobile, setIsMobile]   = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const wpp = () => window.open("https://wa.me/5541988379119?text=" + encodeURIComponent("Olá, quero solicitar uma demonstração do OrganizaPro."), "_blank");

  const faltasPorMes = Math.round(compromissos * 4 * 0.18);
  const perdaMensal  = faltasPorMes * ticket;
  const recuperacao  = Math.round(perdaMensal * 0.72);

  return (
    <div style={{ fontFamily: "Inter,sans-serif", background: "#030712", color: "#fff", overflowX: "hidden", maxWidth: "100vw" }}>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .fadeUp { animation: fadeUp 0.7s ease forwards; }
        .btn-primary { background:linear-gradient(135deg,#1F4E5F,#0d3547); color:#fff; border:none; padding:16px 32px; border-radius:12px; font-size:16px; font-weight:700; cursor:pointer; transition:all 0.3s; box-shadow:0 4px 20px rgba(31,78,95,0.3); }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(31,78,95,0.5); }
        .btn-secondary { background:transparent; color:rgba(255,255,255,0.75); border:1px solid rgba(255,255,255,0.12); padding:14px 28px; border-radius:12px; font-size:15px; font-weight:600; cursor:pointer; transition:all 0.3s; }
        .btn-secondary:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.25); }
        .card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:18px; padding:28px; transition:all 0.3s; }
        .card:hover { background:rgba(255,255,255,0.05); border-color:rgba(31,78,95,0.4); transform:translateY(-3px); }
        .ticker-wrap { overflow:hidden; width:100%; }
        .ticker { display:flex; width:max-content; animation:ticker 28s linear infinite; gap:48px; }
        .ticker:hover { animation-play-state:paused; }
        input[type=range] { -webkit-appearance:none; width:100%; height:4px; border-radius:4px; background:rgba(255,255,255,0.1); outline:none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#4a9bb0; cursor:pointer; box-shadow:0 0 8px rgba(74,155,176,0.4); }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); z-index:999; display:flex; align-items:center; justify-content:center; padding:16px; }
        .status-dot-green  { width:8px; height:8px; border-radius:50%; background:#4a9bb0; box-shadow:0 0 6px rgba(74,155,176,0.6); display:inline-block; flex-shrink:0; }
        .status-dot-yellow { width:8px; height:8px; border-radius:50%; background:#fbbf24; display:inline-block; flex-shrink:0; }
        .status-dot-red    { width:8px; height:8px; border-radius:50%; background:#f87171; display:inline-block; flex-shrink:0; }
        .nav-links { display:flex; }
        .nav-cta-desktop { display:flex; }
        .hamburger { display:none; flex-direction:column; gap:5px; background:none; border:none; cursor:pointer; padding:4px; }
        .hero-dash { display:flex; }
        .mobile-menu { display:none; position:fixed; inset:0; top:56px; background:rgba(3,7,18,0.98); z-index:99; flex-direction:column; align-items:center; justify-content:center; gap:32px; }
        .mobile-menu.open { display:flex; }
        @media (max-width:767px) {
          .nav-links        { display:none !important; }
          .nav-cta-desktop  { display:none !important; }
          .hamburger        { display:flex !important; }
          .hero-dash        { display:none !important; }
        }
      `}</style>

      {/* MODAL DEMO */}
      {demoModal && (
        <div className="modal-overlay" onClick={() => setDemoModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0f172a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, padding:isMobile ? 24 : 32, maxWidth:480, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📲</div>
            <h3 style={{ fontSize:isMobile ? 18 : 20, fontWeight:800, margin:"0 0 10px" }}>Ver demonstração completa</h3>
            <p style={{ fontSize:14, color:"rgba(255,255,255,0.6)", margin:"0 0 24px", lineHeight:1.6 }}>Fale com nossa equipe e veja o OrganizaPro em ação com dados reais do seu negócio.</p>
            <button onClick={() => { setDemoModal(false); wpp(); }} className="btn-primary" style={{ width:"100%", marginBottom:12 }}>Solicitar demonstração pelo WhatsApp</button>
            <button onClick={() => setDemoModal(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:13 }}>Fechar</button>
          </div>
        </div>
      )}

      {/* MOBILE MENU */}
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {["Benefícios","Como Funciona","Planos","FAQ"].map(item => (
          <a key={item} href={`#${item.toLowerCase().replace(/í/g,"i").replace(/ã/g,"a").replace(/\s+/g,"-")}`} onClick={() => setMenuOpen(false)} style={{ fontSize:22, color:"rgba(255,255,255,0.85)", textDecoration:"none", fontWeight:600 }}>{item}</a>
        ))}
        <button className="btn-primary" style={{ padding:"12px 28px", fontSize:15 }} onClick={() => { setMenuOpen(false); wpp(); }}>Agendar Demonstração</button>
      </div>

      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, padding:isMobile ? "12px 16px" : "16px 40px", display:"flex", alignItems:"center", justifyContent:"space-between", background:scrolled ? "rgba(3,7,18,0.92)" : "transparent", backdropFilter:scrolled ? "blur(20px)" : "none", borderBottom:scrolled ? "1px solid rgba(255,255,255,0.05)" : "none", transition:"all 0.3s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>📋</span>
          <span style={{ fontSize:17, fontWeight:800, color:"#4a9bb0" }}>OrganizaPro</span>
        </div>
        <div className="nav-links" style={{ display:"flex", gap:28, alignItems:"center" }}>
          {["Benefícios","Como Funciona","Planos","FAQ"].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/í/g,"i").replace(/ã/g,"a").replace(/\s+/g,"-")}`} style={{ fontSize:14, color:"rgba(255,255,255,0.65)", textDecoration:"none", transition:"color 0.2s" }}>{item}</a>
          ))}
        </div>
        <button className="btn-primary nav-cta-desktop" style={{ padding:"10px 22px", fontSize:14 }} onClick={wpp}>Agendar Demonstração</button>
        <button className="hamburger" onClick={() => setMenuOpen(o => !o)} style={{ display:"none", flexDirection:"column", gap:5, background:"none", border:"none", cursor:"pointer", padding:4 }}>
          <span style={{ display:"block", width:22, height:2, background:menuOpen ? "#4a9bb0" : "rgba(255,255,255,0.8)", borderRadius:2, transition:"all 0.2s", transform:menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
          <span style={{ display:"block", width:22, height:2, background:menuOpen ? "transparent" : "rgba(255,255,255,0.8)", borderRadius:2, transition:"all 0.2s" }} />
          <span style={{ display:"block", width:22, height:2, background:menuOpen ? "#4a9bb0" : "rgba(255,255,255,0.8)", borderRadius:2, transition:"all 0.2s", transform:menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
        </button>
      </nav>

      {/* HERO */}
      <section style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:isMobile ? "90px 16px 60px" : "100px 20px 60px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg,rgba(15,23,42,0.8) 0%,rgba(3,7,18,0.95) 100%)" }} />
        <div style={{ position:"absolute", top:"10%", left:"5%", width:isMobile ? 200 : 400, height:isMobile ? 200 : 400, background:"radial-gradient(circle,rgba(31,78,95,0.12),transparent 65%)", borderRadius:"50%", filter:"blur(120px)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:"20%", right:"8%", width:isMobile ? 180 : 440, height:isMobile ? 180 : 440, background:"radial-gradient(circle,rgba(74,155,176,0.08),transparent 65%)", borderRadius:"50%", filter:"blur(140px)", pointerEvents:"none" }} />

        <div style={{ width:"100%", maxWidth:1200, display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 440px", gap:isMobile ? 32 : 48, alignItems:"center", position:"relative", zIndex:10 }}>
          <div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(31,78,95,0.12)", border:"1px solid rgba(31,78,95,0.3)", borderRadius:999, padding:"5px 14px", marginBottom:22, fontSize:13, color:"rgba(255,255,255,0.8)" }}>
              <span className="status-dot-green" />
              <span>312 negócios organizados agora</span>
            </div>

            <h1 style={{ fontSize:"clamp(28px,4.4vw,46px)", fontWeight:800, lineHeight:1.12, margin:"0 0 18px" }}>
              Seu negócio organizado, conectado e pronto para crescer.
            </h1>

            <p style={{ fontSize:isMobile ? 15 : 17, color:"rgba(255,255,255,0.65)", margin:"0 0 28px", lineHeight:1.65 }}>
              Em poucos minutos seu negócio ganha um site profissional, automações no WhatsApp, avaliações Google e gestão completa — sem depender de agência, designer ou programador.
            </p>

            <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:32 }}>
              <button onClick={wpp} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"13px 22px", borderRadius:11, background:"linear-gradient(135deg,#1F4E5F,#0d3547)", color:"#fff", border:"none", fontWeight:700, fontSize:15, cursor:"pointer", boxShadow:"0 6px 24px rgba(31,78,95,0.3)", whiteSpace:"nowrap" }}>
                📲 Agendar Demonstração
              </button>
              <button onClick={() => setDemoModal(true)} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"13px 20px", borderRadius:11, background:"transparent", color:"rgba(255,255,255,0.7)", border:"1px solid rgba(255,255,255,0.12)", fontWeight:600, fontSize:15, cursor:"pointer", whiteSpace:"nowrap" }}>
                ▶ Ver demonstração
              </button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, width:"100%" }}>
              {[
                { label:"94%",  caption:"Taxa de Confirmação",     accent:"#4a9bb0" },
                { label:"37",   caption:"Compromissos Recuperados", accent:"#1F4E5F" },
                { label:"4.9 ⭐", caption:"Avaliação Média",        accent:"#34d399" },
                { label:"248+", caption:"Clientes Gerenciados",     accent:"#64b5c8" },
              ].map(s => (
                <div key={s.caption} style={{ display:"flex", flexDirection:"column", gap:5, padding:13, borderRadius:13, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width:28, height:3, borderRadius:3, background:s.accent }} />
                  <div style={{ fontSize:19, fontWeight:800, color:"#fff" }}>{s.label}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", lineHeight:1.4 }}>{s.caption}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DASHBOARD HERO — oculto no mobile via CSS */}
          <div className="hero-dash" style={{ alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:"100%", maxWidth:440, borderRadius:18, background:"#0d1526", border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 32px 64px rgba(0,0,0,0.5)", overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"#0a1020" }}>
                <div style={{ display:"flex", gap:6 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:"#f87171" }} />
                  <div style={{ width:10, height:10, borderRadius:"50%", background:"#fbbf24" }} />
                  <div style={{ width:10, height:10, borderRadius:"50%", background:"#34d399" }} />
                </div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", fontWeight:600 }}>OrganizaPro — Painel</div>
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#4a9bb0" }}>
                  <span className="status-dot-green" style={{ width:6, height:6 }} />
                  Ao vivo
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"52px 1fr" }}>
                <div style={{ background:"#080f1e", borderRight:"1px solid rgba(255,255,255,0.05)", padding:"14px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:18 }}>
                  {["🏠","👥","📅","💬","⭐","📊"].map((icon,i) => (
                    <div key={i} style={{ width:32, height:32, borderRadius:9, background:i===0?"rgba(31,78,95,0.2)":"transparent", border:i===0?"1px solid rgba(31,78,95,0.4)":"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{icon}</div>
                  ))}
                </div>
                <div style={{ padding:"14px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>Bom dia, João 👋</div>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>Segunda-feira, 03 Jun</div>
                    </div>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#1F4E5F,#0d3547)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 }}>J</div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                    {[
                      { label:"Clientes",      value:"248",   accent:"#4a9bb0", delta:"+3 hoje"  },
                      { label:"Compromissos",  value:"18",    accent:"#1F4E5F", delta:"restam 6" },
                      { label:"Confirmados",   value:"94%",   accent:"#64b5c8", delta:"↑ meta"   },
                      { label:"Avaliação",     value:"4.9⭐", accent:"#34d399", delta:"Google"   },
                    ].map(item => (
                      <div key={item.label} style={{ padding:"9px 10px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginBottom:3 }}>{item.label}</div>
                        <div style={{ fontSize:15, fontWeight:800, color:item.accent }}>{item.value}</div>
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", marginTop:1 }}>{item.delta}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px" }}>Agenda de Hoje</div>
                    {[
                      { time:"09:00", name:"Carlos M.",      status:"green",  label:"Confirmado"   },
                      { time:"10:30", name:"Patrícia Lima",  status:"green",  label:"Confirmado"   },
                      { time:"13:00", name:"Lucas F.",       status:"yellow", label:"Pendente"     },
                      { time:"14:30", name:"Maria Souza",    status:"red",    label:"Não respondeu"},
                    ].map(apt => (
                      <div key={apt.time} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", width:34, flexShrink:0 }}>{apt.time}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{apt.name}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                          <span className={`status-dot-${apt.status}`} style={{ width:6, height:6 }} />
                          <span style={{ fontSize:9, color:apt.status==="green"?"#4a9bb0":apt.status==="yellow"?"#fbbf24":"#f87171", whiteSpace:"nowrap" }}>{apt.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF — TICKER */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)", borderBottom:"1px solid rgba(255,255,255,0.05)", padding:"18px 0", background:"rgba(255,255,255,0.01)", overflow:"hidden" }}>
        <div style={{ fontSize:11, textAlign:"center", color:"rgba(255,255,255,0.3)", marginBottom:12, textTransform:"uppercase", letterSpacing:"1px" }}>Usado por empresas em todo o Brasil</div>
        <div className="ticker-wrap">
          <div className="ticker">
            {[...Array(2)].map((_,ri) =>
              ["Studio Bem Estar — Curitiba","Consultório JM — São Paulo","Assessoria Plena — Florianópolis","Espaço do Sorriso — Belo Horizonte","Espaço Médico — Porto Alegre","Família Assessoria — Goiânia","ServiçosTotal — Recife","Max Soluções — Campinas","Renovar Negócios — Salvador","Vida & Estilo — Brasília"].map((name,i) => (
                <div key={`${ri}-${i}`} style={{ whiteSpace:"nowrap", fontSize:13, color:"rgba(255,255,255,0.35)", padding:"0 24px", borderLeft:"1px solid rgba(255,255,255,0.06)" }}>📋 {name}</div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PLATAFORMA — ORGANIZE · AUTOMATIZE · CRESÇA */}
      <section style={{ padding:isMobile ? "70px 16px" : "90px 40px" }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:isMobile ? 40 : 56 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(31,78,95,0.1)", border:"1px solid rgba(31,78,95,0.3)", borderRadius:999, padding:"5px 16px", marginBottom:20, fontSize:12, color:"#4a9bb0", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>
              A plataforma completa para o seu negócio
            </div>
            <h2 style={{ fontSize:"clamp(26px,3.6vw,44px)", fontWeight:800, margin:"0 0 16px", lineHeight:1.12 }}>
              Seu negócio{" "}
              <span style={{ background:"linear-gradient(90deg,#1F4E5F,#4a9bb0)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>organizado</span>,{" "}
              <span style={{ background:"linear-gradient(90deg,#60a5fa,#818cf8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>automatizado</span>{" "}
              e pronto para{" "}
              <span style={{ background:"linear-gradient(90deg,#c084fc,#e879f9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>crescer</span>.
            </h2>
            <p style={{ fontSize:isMobile ? 15 : 17, color:"rgba(255,255,255,0.48)", maxWidth:620, margin:"0 auto", lineHeight:1.7 }}>
              Organize sua operação, automatize tarefas repetitivas e fortaleça sua presença digital com uma única plataforma.
            </p>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(3,1fr)", gap:20, marginBottom:44 }}>
            {[
              {
                icon:"📋", label:"ORGANIZE", title:"Controle total da sua operação",
                color:"#4a9bb0",
                gradient:"linear-gradient(135deg,rgba(31,78,95,0.12),rgba(31,78,95,0.03))",
                border:"rgba(31,78,95,0.3)",
                items:["Agenda inteligente","Cadastro de clientes","Gestão de compromissos","Histórico completo","Métricas em tempo real","Dashboard unificado"],
              },
              {
                icon:"⚡", label:"AUTOMATIZE", title:"Zero tarefa manual no seu dia",
                color:"#60a5fa",
                gradient:"linear-gradient(135deg,rgba(96,165,250,0.09),rgba(96,165,250,0.02))",
                border:"rgba(96,165,250,0.22)",
                items:["WhatsApp integrado","Lembretes automáticos","Confirmações de compromisso","Avaliações Google","Chatbot IA 24h","Fluxos de automação"],
              },
              {
                icon:"🚀", label:"CRESÇA", title:"Mais visibilidade, mais clientes",
                color:"#c084fc",
                gradient:"linear-gradient(135deg,rgba(192,132,252,0.09),rgba(192,132,252,0.02))",
                border:"rgba(192,132,252,0.22)",
                items:["Site profissional incluso","Conteúdo IA para redes","SEO integrado","Landing pages do negócio","Presença digital completa","Marketing automatizado"],
              },
            ].map(pillar => (
              <div key={pillar.label}
                style={{ background:pillar.gradient, border:`1px solid ${pillar.border}`, borderRadius:20, padding:isMobile ? 24 : 28, transition:"transform 0.2s,box-shadow 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 24px 56px rgba(0,0,0,0.25)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform=""; (e.currentTarget as HTMLDivElement).style.boxShadow=""; }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:22 }}>
                  <div style={{ width:46, height:46, borderRadius:13, background:"rgba(255,255,255,0.06)", border:`1px solid ${pillar.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{pillar.icon}</div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:800, color:pillar.color, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:2 }}>{pillar.label}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#fff", lineHeight:1.2 }}>{pillar.title}</div>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {pillar.items.map(item => (
                    <div key={item} style={{ display:"flex", alignItems:"center", gap:10, fontSize:14, color:"rgba(255,255,255,0.62)" }}>
                      <span style={{ width:5, height:5, borderRadius:"50%", background:pillar.color, flexShrink:0, marginTop:1 }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign:"center" }}>
            <button onClick={wpp} className="btn-primary" style={{ fontSize:isMobile ? 15 : 17, padding:isMobile ? "14px 28px" : "16px 44px" }}>
              Quero conhecer o OrganizaPro
            </button>
            <p style={{ marginTop:12, fontSize:13, color:"rgba(255,255,255,0.28)" }}>
              Demonstração personalizada · Implantação assistida · Sem contrato
            </p>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section style={{ padding:isMobile ? "60px 16px" : "80px 40px", maxWidth:1200, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <h2 style={{ fontSize:"clamp(24px,3.6vw,40px)", fontWeight:800, margin:"0 0 12px" }}>O que dizem nossos clientes</h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.45)", margin:0 }}>Resultados reais de quem já usa o OrganizaPro</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>
          {[
            { name:"Ana Paula F.", role:"Gestora de Negócios", city:"Curitiba, PR",       avatar:"A", text:"Em 3 semanas reduzi os cancelamentos de 22% para 6%. O WhatsApp automático faz um trabalho que eu levaria horas para fazer manualmente. Não consigo imaginar sem.", stars:5, metric:"−74% de ausências" },
            { name:"Carlos M.",    role:"Empreendedor",        city:"São Paulo, SP",      avatar:"C", text:"Minha nota no Google saiu de 3.8 para 4.9 em dois meses. O sistema pede avaliação automaticamente após cada atendimento. Hoje recebo mais de 40 avaliações por mês sem fazer nada.", stars:5, metric:"+51 avaliações/mês" },
            { name:"Mariana L.",   role:"Prestadora de Serviços", city:"Florianópolis, SC", avatar:"M", text:"O que mais me surpreendeu foi a facilidade de configuração. Em 15 minutos já estava funcionando. O suporte é ágil e o painel me dá tudo que preciso para gerenciar meu negócio.", stars:5, metric:"Setup em 15 min" },
          ].map(t => (
            <div key={t.name} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:isMobile ? 20 : 26 }}>
              <div style={{ display:"flex", gap:4, marginBottom:14 }}>
                {Array(t.stars).fill(0).map((_,i) => <span key={i} style={{ color:"#fbbf24", fontSize:14 }}>★</span>)}
              </div>
              <p style={{ fontSize:14, color:"rgba(255,255,255,0.75)", lineHeight:1.7, margin:"0 0 20px" }}>{t.text}</p>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#1F4E5F,#0d3547)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, flexShrink:0 }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{t.name}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{t.role} · {t.city}</div>
                  </div>
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:"#4a9bb0", background:"rgba(31,78,95,0.12)", border:"1px solid rgba(31,78,95,0.25)", borderRadius:999, padding:"3px 10px", whiteSpace:"nowrap" }}>{t.metric}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CALCULADORA ROI */}
      <section style={{ padding:isMobile ? "60px 16px" : "80px 40px", background:"rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth:860, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:40 }}>
            <h2 style={{ fontSize:"clamp(24px,3.6vw,40px)", fontWeight:800, margin:"0 0 12px" }}>Quanto seu negócio perde por mês?</h2>
            <p style={{ fontSize:16, color:"rgba(255,255,255,0.45)", margin:0 }}>Ajuste os valores e veja o impacto em tempo real</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:isMobile ? 24 : 32, alignItems:"start" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <label style={{ fontSize:14, color:"rgba(255,255,255,0.65)" }}>Compromissos por semana</label>
                  <span style={{ fontSize:16, fontWeight:800, color:"#4a9bb0" }}>{compromissos}</span>
                </div>
                <input type="range" min={5} max={80} value={compromissos} onChange={e => setCompromissos(Number(e.target.value))} />
              </div>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <label style={{ fontSize:14, color:"rgba(255,255,255,0.65)" }}>Ticket médio por atendimento</label>
                  <span style={{ fontSize:16, fontWeight:800, color:"#4a9bb0" }}>R${ticket}</span>
                </div>
                <input type="range" min={80} max={800} step={10} value={ticket} onChange={e => setTicket(Number(e.target.value))} />
              </div>
              <div style={{ padding:16, borderRadius:14, background:"rgba(31,78,95,0.08)", border:"1px solid rgba(31,78,95,0.2)", fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.6 }}>
                Cálculo baseado em taxa média de 18% de ausências em negócios sem sistema de confirmação automatizada.
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                { label:"Ausências estimadas por mês",              value:`${faltasPorMes} atendimentos`,              color:"#f87171", bg:"rgba(248,113,113,0.06)",  border:"rgba(248,113,113,0.15)"  },
                { label:"Faturamento perdido/mês",                  value:`R$${perdaMensal.toLocaleString("pt-BR")}`,  color:"#fbbf24", bg:"rgba(251,191,36,0.06)",  border:"rgba(251,191,36,0.15)"  },
                { label:"Recuperação estimada com OrganizaPro",     value:`R$${recuperacao.toLocaleString("pt-BR")}`,  color:"#4a9bb0", bg:"rgba(31,78,95,0.1)",     border:"rgba(31,78,95,0.25)"    },
              ].map(r => (
                <div key={r.label} style={{ padding:"16px 20px", borderRadius:14, background:r.bg, border:`1px solid ${r.border}` }}>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:5 }}>{r.label}</div>
                  <div style={{ fontSize:isMobile ? 18 : 22, fontWeight:800, color:r.color }}>{r.value}</div>
                </div>
              ))}
              <button onClick={wpp} className="btn-primary" style={{ marginTop:4, fontSize:isMobile ? 14 : 16 }}>
                Recuperar R${recuperacao.toLocaleString("pt-BR")}/mês agora →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section id="beneficios" style={{ padding:isMobile ? "60px 16px" : "80px 40px", maxWidth:1200, margin:"0 auto", scrollMarginTop:"80px" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <h2 style={{ fontSize:"clamp(24px,3.6vw,40px)", fontWeight:800, margin:"0 0 12px" }}>Tudo que seu negócio precisa</h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.45)", margin:0 }}>em uma plataforma só</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
          {[
            { icon:"💬", title:"WhatsApp Automático",        desc:"Lembretes, confirmações e mensagens pós-atendimento enviados automaticamente para seus clientes." },
            { icon:"⭐", title:"Avaliações Google",           desc:"Solicite avaliações automaticamente após cada atendimento e aumente sua nota no Google." },
            { icon:"🤖", title:"Conteúdo IA para Instagram", desc:"Gere posts, legendas e hashtags com IA. Mantenha suas redes sociais ativas de forma profissional." },
            { icon:"🌐", title:"Site Profissional",           desc:"Seu negócio ganha uma página profissional com WhatsApp, localização e SEO básico incluso." },
            { icon:"📊", title:"Dashboard Completo",          desc:"Gerencie clientes, compromissos e métricas em tempo real. Tudo em um só lugar." },
            { icon:"🚀", title:"Setup em 5 Minutos",          desc:"Crie sua conta, conecte o WhatsApp e personalize suas mensagens. Sem burocracia." },
          ].map(b => (
            <div key={b.title} className="card">
              <div style={{ fontSize:30, marginBottom:14 }}>{b.icon}</div>
              <h3 style={{ fontSize:16, fontWeight:700, margin:"0 0 8px", color:"#4a9bb0" }}>{b.title}</h3>
              <p style={{ fontSize:14, color:"rgba(255,255,255,0.48)", lineHeight:1.65, margin:0 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DASHBOARD DEMO COMPLETO */}
      <section id="dashboard-demo" style={{ padding:isMobile ? "40px 16px 60px" : "40px 40px 60px", maxWidth:1200, margin:"0 auto", scrollMarginTop:"80px" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <h2 style={{ fontSize:"clamp(24px,3.6vw,40px)", fontWeight:800, margin:"0 0 12px" }}>Um painel feito para o seu dia a dia</h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.45)", maxWidth:560, margin:"0 auto" }}>Interface limpa para acompanhar clientes, compromissos, confirmações e resultados.</p>
        </div>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 32px 64px rgba(0,0,0,0.4)" }}>
          <div style={{ minWidth:680, background:"#0a1020", borderRadius:20, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"#080f1c" }}>
              <div style={{ display:"flex", gap:7 }}>
                {["#f87171","#fbbf24","#34d399"].map(c => <div key={c} style={{ width:11, height:11, borderRadius:"50%", background:c }} />)}
              </div>
              <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.35)" }}>organizapro.com.br/painel</div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span className="status-dot-green" style={{ width:6, height:6 }} />
                <span style={{ fontSize:11, color:"#4a9bb0" }}>Conectado</span>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"60px 1fr" }}>
              <div style={{ background:"#070d1a", borderRight:"1px solid rgba(255,255,255,0.04)", padding:"20px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:"rgba(31,78,95,0.2)", border:"1px solid rgba(31,78,95,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🏠</div>
                {["👥","📅","💬","⭐","📊","⚙️"].map((ic,i) => (
                  <div key={i} style={{ width:32, height:32, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, opacity:0.5 }}>{ic}</div>
                ))}
              </div>
              <div style={{ padding:24 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800 }}>Bom dia, João 👋</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>Segunda-feira, 03 de Junho de 2026</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"6px 12px" }}>Meu Negócio</div>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#1F4E5F,#0d3547)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, flexShrink:0 }}>J</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 }}>
                  {[
                    { label:"Clientes Ativos",   value:"248",     delta:"+3 hoje",           accent:"#4a9bb0" },
                    { label:"Compromissos Hoje", value:"18",      delta:"restam 6",           accent:"#1F4E5F" },
                    { label:"Taxa Confirmação",  value:"94%",     delta:"↑ acima da meta",    accent:"#64b5c8" },
                    { label:"Avaliação Google",  value:"4.9 ⭐",  delta:"51 avaliações",      accent:"#34d399" },
                  ].map(m => (
                    <div key={m.label} style={{ padding:"14px 16px", borderRadius:13, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginBottom:6 }}>{m.label}</div>
                      <div style={{ fontSize:22, fontWeight:800, color:m.accent, marginBottom:3 }}>{m.value}</div>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>{m.delta}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1.3fr 0.7fr", gap:16 }}>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:18 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>Agenda de Hoje</div>
                      <div style={{ fontSize:11, color:"#4a9bb0", background:"rgba(31,78,95,0.12)", border:"1px solid rgba(31,78,95,0.25)", borderRadius:6, padding:"2px 8px" }}>18 compromissos</div>
                    </div>
                    {[
                      { time:"09:00", name:"Carlos M.",      type:"Reunião",      status:"green"  },
                      { time:"10:30", name:"Patrícia Lima",  type:"Atendimento",  status:"green"  },
                      { time:"12:00", name:"Lucas F.",       type:"Retorno",      status:"yellow" },
                      { time:"14:30", name:"Maria Souza",    type:"Apresentação", status:"red"    },
                      { time:"16:00", name:"João Almeida",   type:"Visita",       status:"green"  },
                    ].map(apt => (
                      <div key={apt.time} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", width:40, flexShrink:0 }}>{apt.time}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, color:"rgba(255,255,255,0.85)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{apt.name}</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{apt.type}</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                          <span className={`status-dot-${apt.status}`} />
                          <span style={{ fontSize:10, color:apt.status==="green"?"#4a9bb0":apt.status==="yellow"?"#fbbf24":"#f87171", whiteSpace:"nowrap" }}>
                            {apt.status==="green"?"Confirmado":apt.status==="yellow"?"Pendente":"Sem resposta"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16 }}>
                      <div style={{ fontSize:12, fontWeight:700, marginBottom:12 }}>Avaliações Recentes</div>
                      {["Excelente atendimento ⭐⭐⭐⭐⭐","Muito organizado ⭐⭐⭐⭐⭐","Pontual e atencioso ⭐⭐⭐⭐⭐"].map(f => (
                        <div key={f} style={{ fontSize:12, color:"rgba(255,255,255,0.55)", padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>{f}</div>
                      ))}
                    </div>
                    <div style={{ background:"rgba(31,78,95,0.1)", border:"1px solid rgba(31,78,95,0.25)", borderRadius:14, padding:16 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#4a9bb0", marginBottom:8 }}>✅ 37 compromissos recuperados</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", lineHeight:1.6 }}>Automações de lembrete recuperaram R$7.400 este mês.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {isMobile && <div style={{ textAlign:"center", marginTop:8, fontSize:11, color:"rgba(255,255,255,0.3)" }}>← Arraste para ver mais →</div>}
        <div style={{ textAlign:"center", marginTop:14, fontSize:12, color:"rgba(255,255,255,0.3)" }}>Demonstração ilustrativa da plataforma</div>
      </section>

      {/* SITE PROFISSIONAL */}
      <section style={{ padding:isMobile ? "40px 16px" : "60px 40px", maxWidth:1200, margin:"0 auto" }}>
        <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:20, padding:isMobile ? "28px 20px" : "40px 48px", display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:isMobile ? 28 : 40, alignItems:"center" }}>
          <div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(31,78,95,0.1)", border:"1px solid rgba(31,78,95,0.3)", borderRadius:999, padding:"4px 14px", marginBottom:16, fontSize:12, color:"#4a9bb0", fontWeight:700 }}>PLANO PREMIUM</div>
            <h2 style={{ fontSize:"clamp(22px,3vw,34px)", fontWeight:800, margin:"0 0 14px" }}>Site profissional incluso</h2>
            <p style={{ fontSize:15, color:"rgba(255,255,255,0.55)", margin:"0 0 24px", lineHeight:1.65 }}>Ao contratar o Plano Premium você recebe um site moderno integrado ao WhatsApp para captar novos clientes.</p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:10 }}>
              {["Responsivo para celular","Botão WhatsApp","Google Maps integrado","Página de serviços","Formulário de contato","SEO básico incluso"].map(item => (
                <div key={item} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,0.7)" }}>
                  <span style={{ color:"#4a9bb0", fontSize:12, flexShrink:0 }}>✓</span>{item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:"#080f1c", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", padding:20, fontSize:13, color:"rgba(255,255,255,0.5)" }}>
            <div style={{ borderRadius:8, background:"rgba(31,78,95,0.12)", border:"1px solid rgba(31,78,95,0.25)", padding:"10px 14px", marginBottom:14, fontSize:12, color:"#4a9bb0", fontWeight:700 }}>seunegocio.com.br</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ height:12, borderRadius:6, background:"rgba(255,255,255,0.08)", width:"80%" }} />
              <div style={{ height:8, borderRadius:6, background:"rgba(255,255,255,0.05)", width:"60%" }} />
              <div style={{ height:8, borderRadius:6, background:"rgba(255,255,255,0.05)", width:"72%" }} />
              <div style={{ marginTop:8, height:32, borderRadius:8, background:"rgba(31,78,95,0.15)", border:"1px solid rgba(31,78,95,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#4a9bb0", fontWeight:700 }}>💬 Agendar pelo WhatsApp</div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" style={{ padding:isMobile ? "60px 16px" : "80px 40px", background:"rgba(255,255,255,0.015)", scrollMarginTop:"80px" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", textAlign:"center" }}>
          <h2 style={{ fontSize:"clamp(24px,3.6vw,40px)", fontWeight:800, margin:"0 0 12px" }}>Como funciona</h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.45)", margin:"0 0 52px" }}>Em 3 passos simples</p>
          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(auto-fit,minmax(250px,1fr))", gap:isMobile ? 36 : 32 }}>
            {[
              { n:"01", title:"Agende sua demonstração", desc:"Veja o OrganizaPro em ação com dados reais do seu negócio. Nossa equipe cuida de toda a implantação assistida." },
              { n:"02", title:"Configure seu negócio",   desc:"Adicione seus dados, conecte o WhatsApp e personalize suas mensagens automáticas." },
              { n:"03", title:"Veja os resultados",      desc:"Mais confirmações, mais avaliações Google e mais clientes todo mês." },
            ].map(s => (
              <div key={s.n}>
                <div style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,#1F4E5F,#0d3547)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, margin:"0 auto 18px" }}>{s.n}</div>
                <h3 style={{ fontSize:18, fontWeight:700, margin:"0 0 8px" }}>{s.title}</h3>
                <p style={{ fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.65, margin:0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" style={{ padding:isMobile ? "60px 16px" : "80px 40px", maxWidth:1200, margin:"0 auto", scrollMarginTop:"80px" }}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <h2 style={{ fontSize:"clamp(24px,3.6vw,40px)", fontWeight:800, margin:"0 0 12px" }}>Planos simples e transparentes</h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.45)", margin:0 }}>Demonstração personalizada + implantação assistida inclusa.</p>
        </div>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ display:"inline-block", background:"rgba(31,78,95,0.08)", border:"1px solid rgba(31,78,95,0.25)", borderRadius:10, padding:"10px 20px", fontSize:isMobile ? 13 : 14, color:"rgba(255,255,255,0.7)", lineHeight:1.6, maxWidth:"100%" }}>
            💡 Empresas no Plano Pro recuperam em média <strong style={{ color:"#4a9bb0" }}>R$2.400/mês</strong> em atendimentos que seriam perdidos. O plano custa R$497.
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(auto-fit,minmax(280px,1fr))", gap:22, alignItems:"start" }}>
          {[
            { name:"Start",   price:"R$297", period:"/mês", color:"#64748b", features:["Cadastro de clientes","Agendamentos","Lembretes automáticos"],                                                    cta:"Solicitar Demonstração", msg:"Olá, quero solicitar uma demonstração do Plano Start do OrganizaPro." },
            { name:"Pro",     price:"R$497", period:"/mês", color:"#4a9bb0", popular:true, features:["Tudo do Start","Avaliações Google","WhatsApp automatizado","Relatórios completos"],                 cta:"Solicitar Demonstração", msg:"Olá, quero solicitar uma demonstração do Plano Pro do OrganizaPro." },
            { name:"Premium", price:"R$697", period:"/mês", color:"#94a3b8", features:["Tudo do Pro","🏆 Site Profissional Incluso","Landing page do negócio","Suporte prioritário"],                     cta:"Falar com Vendas",       msg:"Olá, quero conhecer o Plano Premium do OrganizaPro." },
          ].map(p => (
            <div key={p.name} style={{ background:p.popular?"rgba(31,78,95,0.06)":"rgba(255,255,255,0.02)", border:p.popular?"1px solid rgba(31,78,95,0.4)":"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:isMobile ? 24 : 28, position:"relative", marginTop:p.popular && isMobile ? 16 : 0 }}>
              {p.popular && <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#1F4E5F,#0d3547)", borderRadius:999, padding:"4px 16px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>MAIS VENDIDO</div>}
              <div style={{ fontSize:13, color:p.color, fontWeight:600, marginBottom:8 }}>{p.name}</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:22 }}>
                <span style={{ fontSize:36, fontWeight:800 }}>{p.price}</span>
                <span style={{ fontSize:13, color:"rgba(255,255,255,0.35)" }}>{p.period}</span>
              </div>
              <div style={{ marginBottom:22 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:9, marginBottom:9, fontSize:14, color:"rgba(255,255,255,0.65)" }}>
                    <span style={{ color:p.color, flexShrink:0, marginTop:1 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={() => window.open(`https://wa.me/5541988379119?text=${encodeURIComponent(p.msg)}`, "_blank")} style={{ width:"100%", padding:"12px", borderRadius:10, border:p.popular?"none":"1px solid rgba(255,255,255,0.15)", background:p.popular?"linear-gradient(135deg,#1F4E5F,#0d3547)":"transparent", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>{p.cta}</button>
            </div>
          ))}
        </div>
        <p style={{ textAlign:"center", fontSize:13, color:"rgba(255,255,255,0.3)", marginTop:16 }}>✓ Implantação assistida a partir de R$300 • Suporte especializado incluso</p>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding:isMobile ? "60px 16px" : "80px 40px", background:"rgba(255,255,255,0.015)", scrollMarginTop:"80px" }}>
        <div style={{ maxWidth:760, margin:"0 auto" }}>
          <h2 style={{ fontSize:"clamp(24px,3.6vw,40px)", fontWeight:800, margin:"0 0 40px", textAlign:"center" }}>Perguntas frequentes</h2>
          {[
            { q:"Preciso de conhecimento técnico?",              a:"Não! O OrganizaPro foi feito para ser usado por qualquer pessoa. Setup em 5 minutos sem precisar de programador." },
            { q:"Como funciona o WhatsApp automático?",          a:"Você conecta seu WhatsApp Business ao sistema. O OrganizaPro envia lembretes, confirmações e mensagens automaticamente para seus clientes." },
            { q:"Posso cancelar quando quiser?",                 a:"Sim. Sem fidelidade e sem multa. Você pode cancelar quando quiser." },
            { q:"O sistema funciona para qualquer tipo de negócio?", a:"Sim! O OrganizaPro é para qualquer negócio que faz atendimentos, reuniões ou compromissos: serviços, consultórios, estúdios, consultorias e mais." },
            { q:"Como funciona a demonstração personalizada?",   a:"Trabalhamos com demonstração personalizada e implantação assistida para mostrar exatamente como o OrganizaPro funciona na rotina do seu negócio." },
          ].map((faq,i) => (
            <div key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"22px 0" }}>
              <div style={{ fontSize:isMobile ? 14 : 15, fontWeight:600, marginBottom:8 }}>{faq.q}</div>
              <div style={{ fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.65 }}>{faq.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding:isMobile ? "70px 16px" : "100px 40px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 50%,rgba(31,78,95,0.12) 0%,transparent 70%)" }} />
        <div style={{ position:"relative", maxWidth:600, margin:"0 auto" }}>
          <h2 style={{ fontSize:"clamp(26px,3.6vw,42px)", fontWeight:800, margin:"0 0 14px" }}>
            Pronto para transformar<br />
            <span style={{ background:"linear-gradient(135deg,#1F4E5F,#4a9bb0)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>seu negócio?</span>
          </h2>
          <p style={{ fontSize:isMobile ? 15 : 16, color:"rgba(255,255,255,0.45)", margin:"0 0 32px", lineHeight:1.6 }}>Junte-se a mais de 300 empresas que já usam o OrganizaPro. Veja o sistema em ação com dados reais do seu negócio.</p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginBottom:16 }}>
            <button className="btn-primary" style={{ fontSize:isMobile ? 15 : 16, padding:isMobile ? "14px 24px" : "15px 36px" }} onClick={wpp}>📲 Agendar Demonstração</button>
            <button onClick={() => setDemoModal(true)} className="btn-secondary" style={{ fontSize:15, padding:"15px 24px" }}>Ver demonstração</button>
          </div>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.25)" }}>Implantação assistida • Configuração rápida • Suporte especializado</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding:isMobile ? "24px 16px" : "32px 40px", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:isMobile ? "column" : "row", justifyContent:"space-between", alignItems:"center", gap:12, textAlign:isMobile ? "center" : "left" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>📋</span>
          <span style={{ fontSize:15, fontWeight:700, color:"#4a9bb0" }}>OrganizaPro</span>
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)" }}>© 2026 OrganizaPro. Todos os direitos reservados.</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
          <a href={`https://wa.me/5541988379119?text=${encodeURIComponent("Olá, quero falar com o OrganizaPro.")}`} target="_blank" rel="noopener noreferrer" style={{ color:"rgba(255,255,255,0.35)", textDecoration:"none" }}>💬 WhatsApp</a>
        </div>
      </footer>

    </div>
  );
}
